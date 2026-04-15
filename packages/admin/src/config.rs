use std::path::{Path, PathBuf};

pub struct Config {
    pub project_root: PathBuf,
    pub mcp_dist: PathBuf,
    pub tunnel_name: String,
}

impl Config {
    pub fn detect() -> Self {
        // Walk up from the binary or CWD to find the monorepo root (has pnpm-workspace.yaml)
        let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
        let root = find_project_root(&cwd).unwrap_or(cwd);
        let mcp_dist = root.join("packages/mcp/dist/index.js");

        Self {
            project_root: root,
            mcp_dist,
            tunnel_name: "gerber".to_string(),
        }
    }
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
