# Patterns — gerber-caserne
> Derniere mise a jour : 2026-04-12

## Nommage

- **Fichiers** : kebab-case (`kanban-column.tsx`, `use-tasks.ts`)
- **Composants React** : PascalCase (`TasksBoard`, `KanbanCard`)
- **Tools MCP** : snake_case (`task_list`, `note_create`)
- **DB colonnes** : snake_case (`project_id`, `created_at`)
- **TS interfaces** : camelCase cote code, snake_case cote SQL — mapping via `toProject()`/`toNote()` helpers

## Architecture

- **Tool handler pattern** : Zod input parse → DB query → Zod envelope response
- **Dual transport** : memes handlers pour stdio et HTTP, enregistres via `registerAllTools()`
- **React Query** : hooks dans `api/hooks/`, invalidation sur mutation via queryKey
- **Kanban generique** : `KanbanColumn` + `KanbanCard` reutilises par tasks et issues boards

## Code patterns

- **Zod strict** : `exactOptionalPropertyTypes` actif dans tsconfig UI — props optionnelles doivent etre assertees (`!`) quand passees conditionnellement
- **FTS5 sync** : triggers SQL sur INSERT/UPDATE/DELETE, pas de sync manuelle
- **Tags** : stockes en JSON array, filtres via `json_each()` en SQL (jamais post-filter JS)
- **Embeddings** : fire-and-forget preload apres `server.listen()`, prefixe E5 obligatoire
- **camelCase/snake_case bridge** : Drizzle retourne camelCase, SQLite est snake_case, helpers de mapping obligatoires

## Tests

- **Framework** : Vitest
- **Mock HuggingFace** : `vi.mock('@huggingface/transformers')` dans setup.ts pour eviter le download du modele
- **Test E5 reel** : `pnpm --filter @agent-brain/mcp test:e5` — a lancer avant merge si chunking/tokenizer modifie

## Build

- **MCP** : tsup (ESM, es2022), bundle `@agent-brain/shared` via noExternal
- **UI** : tsc-b + vite build, fontsource importe en JS (pas CSS) pour eviter les warnings woff2
- **Commande globale** : `pnpm build` (MCP only), `pnpm --filter @agent-brain/ui build` (UI)
- **Dev alias** : `gerber [start|stop|restart|status|log]` dans .zshrc
