# Codex CLI

How to configure Gerber with the OpenAI Codex CLI.

> **Prerequisites**: Make sure you've [built Gerber](../getting-started/quickstart.md) first (`pnpm build`).

## Config file location

```
~/.codex/config.toml
```

If the file does not exist yet, create it.

## Configuration

Codex CLI uses TOML format for its configuration:

```toml
[mcp_servers.gerber]
command = "node"
args = ["/absolute/path/to/agent-brain/packages/mcp/dist/index.js"]
enabled = true
startup_timeout_sec = 30
tool_timeout_sec = 60
```

Replace `/absolute/path/to/agent-brain` with the actual path on your machine (e.g. `/Users/yourname/dev/agent-brain`).

## Verify

Restart the Codex CLI. You should see **26 Gerber tools** available, including `project_list`, `note_create`, `search`, `task_list`, and `issue_list`.

## Troubleshooting

**Tools not showing up**
Make sure you ran `pnpm build` first. The file `packages/mcp/dist/index.js` must exist before Codex CLI can start the server.

**Server startup timeout**
If the server takes too long to start (e.g. first-run model download), increase `startup_timeout_sec` to `60` or higher.

**"Permission denied" or `node` not found**
Ensure `node` is in your `PATH`. Run `which node` in a terminal to confirm. The script file must also be readable.
