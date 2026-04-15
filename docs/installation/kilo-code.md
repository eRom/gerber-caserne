# Kilo Code

How to configure Gerber with Kilo Code.

> **Prerequisites**: Make sure you've [built Gerber](../getting-started/quickstart.md) first (`pnpm build`).

## Config file location

You can configure Kilo Code either globally or per-project:

- **Global**: `~/.config/kilo/kilo.json`
- **Per-project**: `./kilo.json` at the root of your project

## Configuration

```json
{
  "mcpServers": {
    "gerber": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/agent-brain/packages/mcp/dist/index.js"],
      "disabled": false
    }
  }
}
```

Replace `/absolute/path/to/agent-brain` with the actual path on your machine (e.g. `/Users/yourname/dev/agent-brain`). Do not use `~` — JSON does not expand shell shortcuts.

## Verify

Restart Kilo Code. You should see **26 Gerber tools** available, including `project_list`, `note_create`, `search`, `task_list`, and `issue_list`.

## Troubleshooting

**Tools not showing up**
Make sure you ran `pnpm build` first. The file `packages/mcp/dist/index.js` must exist before Kilo Code can start the server. Also confirm `"disabled": false` is set (or remove the field entirely — it defaults to enabled).

**Connection error**
Verify the path is absolute. The `~` shortcut does not work inside JSON — use the full path like `/Users/yourname/dev/agent-brain/packages/mcp/dist/index.js`.

**"Permission denied" or `node` not found**
Ensure `node` is in your `PATH`. Run `which node` in a terminal to confirm. The script file must also be readable.
