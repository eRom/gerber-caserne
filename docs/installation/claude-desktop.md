# Claude Desktop

How to configure Gerber with Claude Desktop (or Claude Cowork).

> **Prerequisites**: Make sure you've [built Gerber](../getting-started/quickstart.md) first (`pnpm build`).

## Config file location

```
~/Library/Application Support/Claude/claude_desktop_config.json
```

If the file does not exist yet, create it.

## Configuration

```json
{
  "mcpServers": {
    "gerber": {
      "command": "node",
      "args": ["/absolute/path/to/agent-brain/packages/mcp/dist/index.js"]
    }
  }
}
```

Replace `/absolute/path/to/agent-brain` with the actual path on your machine (e.g. `/Users/yourname/dev/agent-brain`). Do not use `~` — JSON does not expand shell shortcuts.

Note: the `type` field is not required for Claude Desktop.

## Verify

Quit and relaunch Claude Desktop. Open a new conversation — Gerber's **26 tools** should appear in the tool list. Look for `project_list`, `note_create`, `search`, `task_list`, and `issue_list` as confirmation.

You can also open **Settings > Developer > MCP Servers** to see the server connection status.

## Troubleshooting

**Tools not showing up**
Make sure you ran `pnpm build` first. The file `packages/mcp/dist/index.js` must exist before Claude Desktop can start the server.

**Server fails to connect**
Verify the path is absolute. The `~` shortcut does not work inside JSON — use the full path like `/Users/yourname/dev/agent-brain/packages/mcp/dist/index.js`.

**"Permission denied" or `node` not found**
Claude Desktop may run with a restricted `PATH`. Use the full absolute path to your Node.js binary instead of just `node`. Run `which node` to get it (e.g. `/usr/local/bin/node` or `/opt/homebrew/bin/node`).
