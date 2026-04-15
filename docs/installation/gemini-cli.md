# Gemini CLI

How to configure Gerber with the Google Gemini CLI.

> **Prerequisites**: Make sure you've [built Gerber](../getting-started/quickstart.md) first (`pnpm build`).

## Config file location

```
~/.gemini/settings.json
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

## Verify

Restart the Gemini CLI. You should see **26 Gerber tools** available, including `project_list`, `note_create`, `search`, `task_list`, and `issue_list`.

Run the following to list connected MCP servers:

```bash
gemini /mcp
```

The `gerber` server should appear with status `connected`.

## Troubleshooting

**Tools not showing up**
Make sure you ran `pnpm build` first. The file `packages/mcp/dist/index.js` must exist before Gemini CLI can start the server.

**Connection error**
Verify the path is absolute. The `~` shortcut does not work inside JSON — use the full path like `/Users/yourname/dev/agent-brain/packages/mcp/dist/index.js`.

**"Permission denied" or `node` not found**
Ensure `node` is in your `PATH`. Run `which node` in a terminal to confirm. The script file must also be readable.
