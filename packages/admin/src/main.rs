mod config;
mod process;
mod ui;

use std::io;
use std::time::Duration;

use crossterm::event::{self, Event, KeyCode, KeyModifiers};
use crossterm::execute;
use crossterm::terminal::{
    disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen,
};
use ratatui::backend::CrosstermBackend;
use ratatui::Terminal;
use tokio::sync::mpsc;

use config::Config;
use process::{LogSource, ProcessManager};
use ui::{AppState, Pane};

const MAX_LOG_LINES: usize = 2000;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let cfg = Config::detect();

    // Terminal setup
    enable_raw_mode()?;
    let mut stdout = io::stdout();
    execute!(stdout, EnterAlternateScreen)?;
    let backend = CrosstermBackend::new(stdout);
    let mut terminal = Terminal::new(backend)?;

    // Log channel
    let (log_tx, mut log_rx) = mpsc::unbounded_channel();
    let mut pm = ProcessManager::new(log_tx.clone());
    let mut state = AppState::new(cfg.mcp_version.clone());

    // Initial log
    let _ = log_tx.send(process::LogLine {
        source: LogSource::Mcp,
        text: format!("Project root: {}", cfg.project_root.display()),
        timestamp: chrono::Local::now().format("%H:%M:%S").to_string(),
    });
    let _ = log_tx.send(process::LogLine {
        source: LogSource::Mcp,
        text: "Press [S] to start, [B] to build, [Q] to quit".to_string(),
        timestamp: chrono::Local::now().format("%H:%M:%S").to_string(),
    });

    loop {
        // Drain log messages
        while let Ok(log) = log_rx.try_recv() {
            match log.source {
                LogSource::Mcp | LogSource::Build => {
                    state.mcp_logs.push(log);
                    if state.mcp_logs.len() > MAX_LOG_LINES {
                        state.mcp_logs.drain(0..500);
                    }
                }
                LogSource::Tunnel => {
                    state.tunnel_logs.push(log);
                    if state.tunnel_logs.len() > MAX_LOG_LINES {
                        state.tunnel_logs.drain(0..500);
                    }
                }
            }
        }

        // Poll child process state
        pm.poll().await;
        state.mcp_running = pm.is_mcp_running();
        state.tunnel_running = pm.is_tunnel_running();

        // Draw
        terminal.draw(|f| {
            ui::draw(f, &state);
            // Auto-scroll to bottom
            let area_h = f.area().height.saturating_sub(2); // title + status
            state.auto_scroll_mcp(area_h);
            state.auto_scroll_tunnel(area_h);
        })?;

        // Handle input (non-blocking, 100ms tick)
        if event::poll(Duration::from_millis(100))? {
            if let Event::Key(key) = event::read()? {
                match key.code {
                    KeyCode::Char('q') | KeyCode::Char('Q') => {
                        pm.stop().await;
                        break;
                    }
                    KeyCode::Char('c') if key.modifiers.contains(KeyModifiers::CONTROL) => {
                        pm.stop().await;
                        break;
                    }
                    KeyCode::Char('s') | KeyCode::Char('S') => {
                        if pm.is_mcp_running() {
                            pm.stop().await;
                        } else {
                            pm.start(&cfg.project_root, &cfg.mcp_dist, &cfg.tunnel_name)
                                .await;
                        }
                    }
                    KeyCode::Char('b') | KeyCode::Char('B') => {
                        let root = cfg.project_root.clone();
                        let tx = log_tx.clone();
                        let pm_ref = ProcessManager::new(tx);
                        tokio::spawn(async move {
                            pm_ref.build(&root).await;
                        });
                    }
                    KeyCode::Tab => {
                        state.focus = match state.focus {
                            Pane::Mcp => Pane::Tunnel,
                            Pane::Tunnel => Pane::Mcp,
                        };
                    }
                    KeyCode::Char('c') | KeyCode::Char('C') => {
                        state.clear_logs();
                    }
                    KeyCode::Char('w') | KeyCode::Char('W') => {
                        let _ = std::process::Command::new("open")
                            .arg("http://127.0.0.1:4000")
                            .spawn();
                    }
                    KeyCode::Char('1') => state.focus = Pane::Mcp,
                    KeyCode::Char('2') => state.focus = Pane::Tunnel,
                    KeyCode::Up => state.scroll_up(),
                    KeyCode::Down => state.scroll_down(),
                    _ => {}
                }
            }
        }
    }

    // Restore terminal
    disable_raw_mode()?;
    execute!(terminal.backend_mut(), LeaveAlternateScreen)?;
    terminal.show_cursor()?;

    Ok(())
}
