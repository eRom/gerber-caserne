# agent-brain

Cross-project memory system for developers. Store, search, and retrieve knowledge atoms and documents with full-text and semantic search.

## Quick Start

```bash
pnpm install
pnpm build
```

## Development

```bash
pnpm dev          # Start MCP stdio + UI dev servers
pnpm test         # Run all tests
pnpm typecheck    # Type-check all packages
```

## Architecture

- `packages/shared/` — Constants, Drizzle schema, Zod schemas, TypeScript types
- `packages/mcp/` — MCP server (stdio + HTTP), SQLite database, E5 embeddings, AST chunker

## Claude Code Integration (stdio)

Add to your Claude Code MCP config:

```json
{
  "mcpServers": {
    "agent-brain": {
      "command": "node",
      "args": ["<path-to-repo>/packages/mcp/dist/index.js"]
    }
  }
}
```

## HTTP Mode (for UI)

```bash
node packages/mcp/dist/index.js --ui
# Serves on http://127.0.0.1:4000
```

## Database

- Location: `~/.agent-brain/brain.db` (SQLite)
- Override: `--db-path /path/to/brain.db`

## Scripts

```bash
pnpm mcp:restore <backup-path>  # Restore from backup
pnpm mcp:reindex                # Re-chunk all documents
```

## Spec & Plan

- Design spec: `docs/superpowers/specs/2026-04-08-agent-brain-mvp-design.md`
- Implementation plan: `docs/superpowers/plans/2026-04-08-agent-brain-mcp-backend.md`
