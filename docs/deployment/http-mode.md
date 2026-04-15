# HTTP Mode

Gerber's MCP server can run in two modes simultaneously: **stdio** for Claude Code integration, and **HTTP** for the Web UI.

## The `--ui` Flag

Passing `--ui` starts an HTTP server on port **4000** alongside the MCP stdio transport.

```bash
node packages/mcp/dist/index.js --ui
```

This exposes a **JSON-RPC bridge** at `/mcp` — the endpoint the Web UI uses to communicate with the MCP server. This is a custom bridge, not the Streamable HTTP MCP transport (that lives at `/mcp/stream`, see [Managed Agent](./managed-agent.md)).

## Database Location

By default, Gerber stores its SQLite database at:

```
~/.agent-brain/brain.db
```

Override with `--db-path`:

```bash
node packages/mcp/dist/index.js --ui --db-path /path/to/brain.db
```

## Two-Process Setup

Claude Code uses the **stdio** transport to communicate with the MCP server. The Web UI requires the **HTTP** server. These are two separate processes that share the same database file.

| Process | Command | Purpose |
|---------|---------|---------|
| Process 1 | `node packages/mcp/dist/index.js` | Stdio — Claude Code integration |
| Process 2 | `node packages/mcp/dist/index.js --ui` | HTTP on :4000 — Web UI |

Both processes point to the same `brain.db`. Concurrent writes are safe: Gerber runs SQLite in **WAL mode** with `busy_timeout = 5000ms`, which prevents `SQLITE_BUSY` errors under normal concurrent load.

> **Note:** Both processes must use the same `--db-path` if you override the default location.

## Launch Commands

```bash
# Production — HTTP mode only
node packages/mcp/dist/index.js --ui

# Production — with custom DB path
node packages/mcp/dist/index.js --ui --db-path ~/.agent-brain/brain.db

# Development
pnpm --filter @agent-brain/mcp dev -- --ui --db-path ~/.agent-brain/brain.db
```

## Dev Mode Notes

In development, `pnpm dev` runs the server via `tsx` with hot-reload. The `--` separator passes arguments through to the underlying script.

The Web UI (separate package) is typically started independently:

```bash
# In another terminal
pnpm --filter @agent-brain/ui dev
```

Both the UI dev server and the MCP HTTP server must be running for the browser interface to work.
