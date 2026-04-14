# Architecture — gerber-caserne
> Derniere mise a jour : 2026-04-12

## Vue d'ensemble

Gerber est un systeme de memoire cross-projets pour agents IA. Il stocke des notes (atoms/documents), tasks, issues et messages inter-sessions, avec recherche semantique (E5) et fulltext (FTS5).

**Stack** : TypeScript, SQLite (better-sqlite3), Express 5, React 19, Tailwind CSS 4, shadcn/ui (radix-nova)

## Structure monorepo (pnpm workspaces)

```
packages/
  shared/     Pure TS — Drizzle schema, Zod types, constantes (GLOBAL_PROJECT_ID)
  mcp/        MCP server — tools, DB, embeddings, HTTP/UI server
  ui/         React SPA — kanban, notes, search, project views
skills/       11 skills Claude Code (gerber-*)
agents/       Sub-agents markdown (gerber-agent-notebook)
hooks/        SessionStart hook (gerber-poll.sh)
assets/       Logos, screenshots
```

## Dual transport

- **stdio** : utilise par Claude Code / Gemini CLI via MCP protocol (JSON-RPC)
- **HTTP** : Express 5 sur port 4000 avec `--ui`, sert l'UI React en static + endpoint `/mcp` JSON-RPC

Un seul jeu de tool handlers, enregistres une fois dans `registerAllTools()`.

## Flux de donnees

```
Agent (Claude/Gemini) --stdio--> McpServer --> tool handler --> SQLite
Browser               --HTTP---> Express   --> tool handler --> SQLite
                                     |
                                     +--> E5 embeddings (local, @huggingface/transformers)
```

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
