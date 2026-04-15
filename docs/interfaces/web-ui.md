# Web UI

The web interface provides a full graphical environment for browsing and managing Gerber data: notes, tasks, issues, messages, and search — all rendered in a React 19 application with Tailwind CSS 4 and shadcn/ui components.

## Launching

```bash
node packages/mcp/dist/index.js --ui
```

The UI is served at **http://127.0.0.1:4000**.

> **Important:** `--ui` mode and stdio mode (used by Claude Code) cannot coexist in the same process. Run two separate MCP instances if you need both simultaneously — one for Claude Code via stdio, and one with `--ui` for the browser.

## Development Mode

```bash
pnpm --filter @agent-brain/ui dev
```

Starts Vite on `:5173`. All `/mcp` requests are proxied to `:4000`, so you need the MCP server running separately.

## Pages

### Dashboard

Overview of all projects with aggregate stats: note counts, task/issue breakdowns, recent activity.

### Project View

Dedicated view for a single project, grouping its notes, tasks, and issues in one place.

### Notes

Browse and create notes with full markdown preview. Supports atom and document types.

### Search

Hybrid search interface combining semantic (E5 embeddings) and fulltext (FTS5) modes. Filters by project, tags, and result type.

### Messages

Inter-session message inbox. Read context and reminder messages sent by Claude Code sessions via `gerber:send`.

### Settings

Server configuration and user preferences.

## Screenshots

![Tasks kanban](../../assets/screenshot-tasks.png)

![Task detail](../../assets/screenshot-task-info.png)

![Issues board](../../assets/screenshot-issues.png)

![Memory](../../assets/screenshot-memory.png)

## Features

- **Command palette** — keyboard-driven quick navigation and action launcher
- **Import zone** — drag-and-drop document ingestion
- **Markdown rendering** — full markdown support with syntax highlighting
- **Kanban boards** — 7-column task board (inbox → brainstorming → specification → plan → implementation → test → done) and 4-column issue board (inbox → in_progress → in_review → closed)
