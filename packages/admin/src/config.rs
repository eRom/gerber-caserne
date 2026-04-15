use std::path::{Path, PathBuf};

pub struct Config {
    pub project_root: PathBuf,
    pub mcp_dist: PathBuf,
    pub tunnel_name: String,
    pub mcp_version: String,
}

impl Config {
    pub fn detect() -> Self {
        // Walk up from the binary or CWD to find the monorepo root (has pnpm-workspace.yaml)
        let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
        let root = find_project_root(&cwd).unwrap_or(cwd);
        let mcp_dist = root.join("packages/mcp/dist/index.js");
        let mcp_version = read_mcp_version(&root);

        Self {
            project_root: root,
            mcp_dist,
            tunnel_name: "gerber".to_string(),
            mcp_version,
        }
    }
}

fn read_mcp_version(root: &Path) -> String {
    let pkg = root.join("packages/mcp/package.json");
    let content = match std::fs::read_to_string(pkg) {
        Ok(s) => s,
        Err(_) => return "?".to_string(),
    };
    // Find "version": "x.y.z" — good enough for package.json
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("\"version\"") {
            if let Some(start) = trimmed.rfind('"') {
                let before = &trimmed[..start];
                if let Some(end) = before.rfind('"') {
                    return before[end + 1..].to_string();
                }
            }
        }
    }
    "?".to_string()
}

fn find_project_root(start: &Path) -> Option<PathBuf> {
    let mut dir = start.to_path_buf();
    loop {
        if dir.join("pnpm-workspace.yaml").exists() {
            return Some(dir);
        }
        if !dir.pop() {
            return None;
        }
    }
}
