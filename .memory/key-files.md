# Key Files — gerber-caserne
> Derniere mise a jour : 2026-04-12

## packages/mcp/src/

| Fichier | Role |
|---------|------|
| `index.ts` | Entry point — parse args, ouvre DB, cree McpServer (name: "gerber"), lance HTTP si `--ui` |
| `db/index.ts` | Ouvre SQLite, pragmas (WAL, busy_timeout), retourne Database |
| `db/migrate.ts` | Applique les migrations SQL sequentiellement |
| `db/backup.ts` | Checkpoint WAL + copie DB vers ~/.agent-brain/backups/ |
| `tools/index.ts` | `registerAllTools()` — enregistre tous les tools sur le McpServer |
| `tools/notes.ts` | CRUD notes, list avec filtres, tags via json_each() |
| `tools/tasks.ts` | CRUD tasks, kanban 7 colonnes, subtasks, reorder |
| `tools/issues.ts` | CRUD issues, 4 colonnes, severity/priority |
| `tools/messages.ts` | Bus inter-sessions (context/reminder), status pending/done |
| `tools/search.ts` | Recherche hybrid/semantic/fulltext, RRF k=60 |
| `tools/maintenance.ts` | backup_brain, get_stats |
| `tools/contracts.ts` | Zod envelopes pour les reponses |
| `embeddings/embed.ts` | Embed text avec prefixe E5 (passage:/query:) |
| `embeddings/chunking.ts` | AST chunker Remark — split documents en chunks |
| `embeddings/pipeline.ts` | Singleton pipeline @huggingface/transformers |
| `embeddings/tokenizer.ts` | Token count avec prefixe (9 chars) |
| `http/server.ts` | Express 5, sert UI static + /mcp + /health |

## packages/ui/src/

| Fichier | Role |
|---------|------|
| `main.tsx` | Entry React, QueryClient, import fontsource |
| `app.tsx` | Router (react-router) |
| `globals.css` | Tailwind + shadcn theme |
| `components/tasks-board.tsx` | Kanban 7 colonnes tasks |
| `components/issues-board.tsx` | Kanban 4 colonnes issues |
| `components/kanban-column.tsx` | Colonne kanban generique + QuickAddInput |
| `components/kanban-card.tsx` | Card kanban (titre, priority, tags, assignee) |
| `components/sidebar.tsx` | Navigation projets + liens |
| `pages/project-view.tsx` | Vue projet 3 tabs (Taches/Issues/Memoire) |
| `api/mcp-client.ts` | Client MCP thin (fetch → /mcp JSON-RPC) |
| `api/hooks/use-tasks.ts` | React Query hooks tasks |
| `api/hooks/use-issues.ts` | React Query hooks issues |

## Config

| Fichier | Role |
|---------|------|
| `CLAUDE.md` | Instructions projet + section Gerber |
| `.gerber-slug` | Slug projet pour le hook poll (gitignored) |
| `packages/mcp/tsup.config.ts` | Build config — bundle @agent-brain/shared |
| `packages/ui/vite.config.ts` | Vite config — proxy /mcp, chunkSizeWarningLimit 1000 |
