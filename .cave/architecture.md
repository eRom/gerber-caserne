# Architecture — gerber-caserne
> Derniere mise a jour : 2026-04-15

## Vue d'ensemble

Gerber est un systeme de memoire cross-projets pour agents IA. Il stocke des notes (atoms/documents), tasks, issues et messages inter-sessions, avec recherche semantique (E5) et fulltext (FTS5).

**Stack** : TypeScript, SQLite (better-sqlite3), Express 5, React 19, Tailwind CSS 4, shadcn/ui (radix-nova)

## Structure monorepo (pnpm workspaces)

```
packages/
  shared/     Pure TS — Drizzle schema, Zod types, constantes (GLOBAL_PROJECT_ID)
  mcp/        MCP server — tools, DB, embeddings, HTTP/UI server, Streamable HTTP
  ui/         React SPA — kanban, notes, search, project views
  admin/      Rust TUI (ratatui) — manage MCP + tunnel from one place
skills/       13 skills Claude Code (gerber-*)
agents/       Sub-agents markdown (gerber-agent-vault, gerber-agent-status)
hooks/        SessionStart hook (gerber-poll.sh)
assets/       Logos, screenshots
```

## Triple transport

- **stdio** : utilise par Claude Code / Gemini CLI / Codex via MCP protocol (JSON-RPC)
- **HTTP** : Express 5 sur port 4000 avec `--ui`, sert l'UI React en static + endpoint `/mcp` JSON-RPC (pont custom pour l'UI)
- **Streamable HTTP** : endpoint `/mcp/stream` (MCP officiel, active via `--stream`), consomme par Claude Managed Agents. Bearer auth via token persistant dans `~/.config/gerber/config.json`. Chaque session cree son propre McpServer (SDK ne supporte qu'un transport par instance).

`/mcp` ≠ `/mcp/stream` — le premier est un pont JSON-RPC maison pour l'UI, le second est le transport MCP officiel.

## Flux de donnees

```
Agent (Claude/Gemini)   --stdio-----------> McpServer --> tool handler --> SQLite
Browser                 --HTTP /mcp-------> Express   --> jsonrpc.ts   --> tool handler --> SQLite
Managed Agent (cloud)   --Streamable HTTP-> tunnel --> Express /mcp/stream --> transport --> McpServer --> SQLite
                                                          |
                                                          +--> E5 embeddings (local, @huggingface/transformers)
```

## Cloudflare Tunnel (bridge local → cloud)

Named tunnel `gerber` sur `gerber.romain-ecarnot.com` → `localhost:4000`. URL immutable (gravee dans la credential Vault Anthropic). Auth via Vault `static_bearer`.

## Admin TUI (Rust)

`packages/admin/` — binaire `gerber-admin` (ratatui + tokio). Manage MCP + tunnel ensemble : start/stop, build, logs colores, version display. Lance via `pnpm admin`.

## Entites principales

| Entite | Stockage | Recherche |
|--------|----------|-----------|
| Notes (atom/document) | SQLite + FTS5 + embeddings | hybrid/semantic/fulltext |
| Tasks | SQLite | list avec filtres |
| Issues | SQLite | list avec filtres |
| Messages | SQLite | list par projet/status |

## DB

- Fichier : `~/.agent-brain/brain.db`
- WAL mode + busy_timeout 5000ms
- Migrations via Drizzle
- FTS5 avec triggers pour sync
- Embeddings E5-base 768d stockes en BLOB

## Cold storage (NotebookLM)

Pipeline de cold storage via Google NotebookLM pour archiver des documents projet (pdf, md, txt...) et les interroger via l'IA de Google.

```
Skill /gerber-cold-storage --> Agent gerber-agent-notebook (Haiku)
                                    |
                                    +--> nlm CLI --> NotebookLM API
```

- Notebook ID persiste dans `.gerber-nlm` (gitignored)
- 4 operations : init, archive, status, query
- Agent dedie Haiku (~11k tokens/appel vs ~63k avec agent generique)
- CLI `nlm` uniquement (MCP tools notebooklm casses — bug FastMCP TaskContextSnapshot)
