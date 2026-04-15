# Cline

How to configure Gerber with Cline (VS Code extension).

> **Prerequisites**: Make sure you've [built Gerber](../getting-started/quickstart.md) first (`pnpm build`).

## Config file location

Cline stores its MCP server configuration in:

```
cline_mcp_settings.json
```

To open it: in VS Code, go to the Cline sidebar > **MCP Servers** > **Configure** (gear icon). This opens the file directly in the editor.

## Configuration

```json
{
  "mcpServers": {
    "gerber": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/agent-brain/packages/mcp/dist/index.js"]
    }
  }
}
```

Replace `/absolute/path/to/agent-brain` with the actual path on your machine (e.g. `/Users/yourname/dev/agent-brain`). Do not use `~` — JSON does not expand shell shortcuts.

## Verify

Save the config file — Cline picks up changes without restarting VS Code. Open the **MCP Servers** panel. The `gerber` server should appear with a green connected indicator and **26 tools** listed, including `project_list`, `note_create`, `search`, `task_list`, and `issue_list`.

## Troubleshooting

**Tools not showing up**
Make sure you ran `pnpm build` first. The file `packages/mcp/dist/index.js` must exist before Cline can start the server.

**Connection error / server shows red in MCP panel**
Verify the path is absolute. The `~` shortcut does not work inside JSON — use the full path like `/Users/yourname/dev/agent-brain/packages/mcp/dist/index.js`. After fixing the path, click the refresh button in the MCP Servers panel.

**"Permission denied" or `node` not found**
VS Code may use a different `PATH` than your terminal. Use the full absolute path to your Node.js binary instead of just `node`. Run `which node` in your terminal to get it (e.g. `/opt/homebrew/bin/node`).
