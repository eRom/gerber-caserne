# Claude Code

How to configure Gerber with Claude Code (Anthropic's official CLI).

> **Prerequisites**: Make sure you've [built Gerber](../getting-started/quickstart.md) first (`pnpm build`).

## Config file location

You can register Gerber either per-project or globally:

- **Per-project**: `.mcp.json` at the root of your project
- **Global**: `~/.claude/mcp.json`

## Configuration

Add the following to your chosen config file:

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

Restart Claude Code (or run `/mcp` to reload servers). You should see **26 Gerber tools** available, including `project_list`, `note_create`, `search`, `task_list`, and `issue_list`.

You can confirm with:

```
/mcp
```

The `gerber` server should appear with status `connected`.

## Troubleshooting

**Tools not showing up**
Make sure you ran `pnpm build` first. The file `packages/mcp/dist/index.js` must exist before Claude Code can start the server.

**Connection error / server fails to start**
Verify the path is absolute. The `~` shortcut does not work inside JSON — use the full path like `/Users/yourname/dev/agent-brain/packages/mcp/dist/index.js`.

**"Permission denied" or `node` not found**
Ensure `node` is in your `PATH`. Run `which node` in a terminal to confirm. The script file must also be readable (`chmod 644 packages/mcp/dist/index.js`).
