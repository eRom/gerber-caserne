use std::path::Path;
use std::process::Stdio;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::mpsc;

#[derive(Debug, Clone)]
pub struct LogLine {
    pub source: LogSource,
    pub text: String,
    pub timestamp: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LogSource {
    Mcp,
    Tunnel,
    Build,
}

pub struct ProcessManager {
    mcp: Option<Child>,
    tunnel: Option<Child>,
    log_tx: mpsc::UnboundedSender<LogLine>,
}

impl ProcessManager {
    pub fn new(log_tx: mpsc::UnboundedSender<LogLine>) -> Self {
        Self {
            mcp: None,
            tunnel: None,
            log_tx,
        }
    }

    pub fn is_mcp_running(&self) -> bool {
        self.mcp.is_some()
    }

    pub fn is_tunnel_running(&self) -> bool {
        self.tunnel.is_some()
    }

    pub async fn start(&mut self, project_root: &Path, mcp_dist: &Path, tunnel_name: &str) {
        if self.mcp.is_some() {
            return;
        }

        // Start MCP
        self.emit(LogSource::Mcp, "Starting MCP server...");
        match Command::new("node")
            .arg(mcp_dist)
            .arg("--ui")
            .arg("--stream")
            .current_dir(project_root)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true)
            .spawn()
        {
            Ok(mut child) => {
                self.pipe_output(&mut child, LogSource::Mcp);
                self.mcp = Some(child);
            }
            Err(e) => {
                self.emit(LogSource::Mcp, &format!("Failed to start: {e}"));
                return;
            }
        }

        // Start tunnel
        self.emit(LogSource::Tunnel, "Starting Cloudflare tunnel...");
        match Command::new("cloudflared")
            .arg("tunnel")
            .arg("run")
            .arg(tunnel_name)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true)
            .spawn()
        {
            Ok(mut child) => {
                self.pipe_output(&mut child, LogSource::Tunnel);
                self.tunnel = Some(child);
            }
            Err(e) => {
                self.emit(LogSource::Tunnel, &format!("Failed to start: {e}"));
            }
        }
    }

    pub async fn stop(&mut self) {
        // Stop tunnel first, then MCP
        if let Some(mut child) = self.tunnel.take() {
            self.emit(LogSource::Tunnel, "Stopping tunnel...");
            let _ = child.kill().await;
            self.emit(LogSource::Tunnel, "Stopped.");
        }
        if let Some(mut child) = self.mcp.take() {
            self.emit(LogSource::Mcp, "Stopping MCP server...");
            let _ = child.kill().await;
            self.emit(LogSource::Mcp, "Stopped.");
        }
    }

    pub async fn build(&self, project_root: &Path) {
        self.emit(LogSource::Build, "Building MCP...");
        let start = std::time::Instant::now();

        match Command::new("pnpm")
            .arg("--filter")
            .arg("@agent-brain/mcp")
            .arg("build")
            .current_dir(project_root)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .await
        {
            Ok(output) => {
                let elapsed = start.elapsed();
                let stdout = String::from_utf8_lossy(&output.stdout);
                let stderr = String::from_utf8_lossy(&output.stderr);
                for line in stdout.lines().chain(stderr.lines()) {
                    if !line.trim().is_empty() {
                        self.emit(LogSource::Build, line);
                    }
                }
                if output.status.success() {
                    self.emit(
                        LogSource::Build,
                        &format!("Build OK ({:.1}s)", elapsed.as_secs_f64()),
                    );
                } else {
                    self.emit(LogSource::Build, "Build FAILED");
                }
            }
            Err(e) => {
                self.emit(LogSource::Build, &format!("Build error: {e}"));
            }
        }
    }

    /// Check if child processes have exited and clean up handles.
    pub async fn poll(&mut self) {
        if let Some(ref mut child) = self.mcp {
            if let Ok(Some(status)) = child.try_wait() {
                self.emit(
                    LogSource::Mcp,
                    &format!("Process exited ({})", status),
                );
                self.mcp = None;
            }
        }
        if let Some(ref mut child) = self.tunnel {
            if let Ok(Some(status)) = child.try_wait() {
                self.emit(
                    LogSource::Tunnel,
                    &format!("Process exited ({})", status),
                );
                self.tunnel = None;
            }
        }
    }

    fn pipe_output(&self, child: &mut Child, source: LogSource) {
        if let Some(stdout) = child.stdout.take() {
            let tx = self.log_tx.clone();
            tokio::spawn(async move {
                let reader = BufReader::new(stdout);
                let mut lines = reader.lines();
                while let Ok(Some(line)) = lines.next_line().await {
                    let _ = tx.send(LogLine {
                        source,
                        text: line,
                        timestamp: now(),
                    });
                }
            });
        }
        if let Some(stderr) = child.stderr.take() {
            let tx = self.log_tx.clone();
            tokio::spawn(async move {
                let reader = BufReader::new(stderr);
                let mut lines = reader.lines();
                while let Ok(Some(line)) = lines.next_line().await {
                    let _ = tx.send(LogLine {
                        source,
                        text: line,
                        timestamp: now(),
                    });
                }
            });
        }
    }

    fn emit(&self, source: LogSource, text: &str) {
        let _ = self.log_tx.send(LogLine {
            source,
            text: text.to_string(),
            timestamp: now(),
        });
    }
}

fn now() -> String {
    chrono::Local::now().format("%H:%M:%S").to_string()
}
