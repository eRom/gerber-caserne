# OpenCode

How to configure Gerber with OpenCode.

> **Prerequisites**: Make sure you've [built Gerber](../getting-started/quickstart.md) first (`pnpm build`).

## Config file location

Place the config file at the root of your project:

```
opencode.json
```

or, if you prefer comments in your config:

```
opencode.jsonc
```

## Configuration

OpenCode uses a single `command` array (combining the executable and its arguments) rather than separate `command` and `args` fields:

```json
{
  "mcp": {
    "gerber": {
      "type": "local",
      "command": ["node", "/absolute/path/to/agent-brain/packages/mcp/dist/index.js"],
      "enabled": true
    }
  }
}
```

Replace `/absolute/path/to/agent-brain` with the actual path on your machine (e.g. `/Users/yourname/dev/agent-brain`). Do not use `~` — JSON does not expand shell shortcuts.

## Verify

Restart OpenCode. You should see **26 Gerber tools** available, including `project_list`, `note_create`, `search`, `task_list`, and `issue_list`.

## Troubleshooting

**Tools not showing up**
Make sure you ran `pnpm build` first. The file `packages/mcp/dist/index.js` must exist before OpenCode can start the server. Also confirm `"enabled": true` is set.

**Connection error**
Verify the path inside the `command` array is absolute. The `~` shortcut does not work inside JSON — use the full path like `/Users/yourname/dev/agent-brain/packages/mcp/dist/index.js`.

**"Permission denied" or `node` not found**
Ensure `node` is in your `PATH`. Run `which node` in a terminal to confirm. The script file must also be readable.
