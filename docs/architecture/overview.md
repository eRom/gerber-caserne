# Architecture Overview

Gerber is a personal knowledge and project management MCP server. It runs locally, exposes tools over the MCP protocol, and stores everything in a single SQLite database.

![Architecture](../assets/gerber-full-architecture.png)

## Monorepo Structure

The project uses pnpm workspaces. All packages live under `packages/`.

```
agent-brain/
├── packages/
│   ├── shared/      # Pure TypeScript — no native deps
│   ├── mcp/         # MCP server (Node.js, SQLite, Express 5)
│   ├── ui/          # React 19 web frontend
│   ├── tui/         # Ink-based terminal UI
│   └── admin/       # Rust TUI (ratatui) — standalone binary
├── docs/
└── .cave/           # Persistent project cartography
```

### packages/shared

Pure TypeScript with no native dependencies. Contains:

- Drizzle ORM schema (`src/db/schema.ts`)
- Zod schemas and validation envelopes (`src/schemas/`)
- Shared TypeScript types and constants

### packages/mcp

The MCP server core. Depends on `shared`. Contains:

- SQLite database layer via `better-sqlite3`
- E5 embedding pipeline (`@huggingface/transformers`)
- All MCP tool handlers (notes, tasks, issues, messages, projects, search, backup)
- Express 5 HTTP server with three transports (see below)

### packages/ui

React 19 frontend, built with Vite. Served as static files by the MCP server when built (`packages/ui/dist`). Uses:

- React 19
- Tailwind CSS 4
- shadcn/ui components

### packages/tui

Ink-based terminal UI (React for terminal). Depends on `shared`.

### packages/admin

Rust TUI built with Ratatui. Standalone binary — does not depend on any TypeScript package. Manages the MCP server process and Cloudflare tunnel. See `packages/admin/src/` for the Rust source.

## Package Dependency Graph

```
shared
  ├── mcp (runtime dep)
  ├── ui  (runtime dep)
  └── tui (runtime dep)

admin (standalone Rust — no dependency on shared)
```

## Data Flow

The canonical flow for a tool call from an AI agent:

```
Agent
  └─[MCP protocol]─> Transport (stdio | HTTP | Streamable HTTP)
       └─> McpServer (tool dispatch)
            └─> Tool handler
                 ├─> SQLite (read/write via better-sqlite3)
                 └─> Embeddings pipeline (search tools only)
                          └─> Float32Array stored as BLOB
```

## Transports

Three transports are available simultaneously when running the HTTP server:

| Transport | Path | Consumer |
|-----------|------|----------|
| stdio | — | Claude Desktop, local MCP clients |
| JSON-RPC bridge | `POST /mcp` | Web UI (`packages/ui`) |
| Streamable HTTP | `POST /mcp/stream` | Anthropic Managed Agents (`type: "url"`) |

**Important**: `/mcp` and `/mcp/stream` are distinct endpoints with different protocols. Do not merge them. The JSON-RPC bridge is a custom protocol; the Streamable HTTP endpoint implements the official MCP transport spec.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js 20+ |
| Language | TypeScript 5.x, Rust (admin only) |
| Database | SQLite via better-sqlite3 |
| ORM | Drizzle ORM |
| Embeddings | multilingual-e5-base via @huggingface/transformers |
| HTTP | Express 5 |
| Frontend | React 19, Tailwind CSS 4, shadcn/ui |
| Terminal UI | Ink (React for terminal) |
| Admin TUI | Ratatui (Rust) |
| Build | tsup (TS packages), Vite (UI), Cargo (Rust) |
| Package manager | pnpm with workspaces |

## Key Commands

```bash
pnpm install              # Install all workspace deps
pnpm build                # Build mcp package (tsup)
pnpm test                 # Run all tests (vitest)
pnpm typecheck            # Type-check all packages
pnpm mcp:token            # Print the Streamable HTTP bearer token
pnpm mcp:reindex          # Re-chunk and re-embed all documents
pnpm mcp:restore <path>   # Restore DB from a backup file
```
