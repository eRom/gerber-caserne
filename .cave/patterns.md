# Patterns — gerber-caserne
> Derniere mise a jour : 2026-05-15 (vault hub/spoke + rag_onboard pattern)

## Nommage

- **Fichiers** : kebab-case (`kanban-column.tsx`, `use-tasks.ts`)
- **Composants React** : PascalCase (`TasksBoard`, `KanbanCard`)
- **Tools MCP** : snake_case (`task_list`, `note_create`)
- **DB colonnes** : snake_case (`project_id`, `created_at`)
- **TS interfaces** : camelCase cote code, snake_case cote SQL — mapping via `toProject()`/`toNote()` helpers

## Architecture

- **Tool handler pattern** : Zod input parse → DB query → Zod envelope response
- **Reference resolution (id-or-title)** : pour les entites avec titre naturel (ex: handoffs), exposer `{ id?: uuid, title?: string }` + `refine()` au moins-un-requis. Collision de titre → plus recent wins + `console.warn`. Pragmatique pour skills qui parlent en langage naturel.
- **Triple transport** : stdio + JSON-RPC custom (`/mcp`) + Streamable HTTP (`/mcp/stream`), tous via `registerAllTools()`
- **Server factory pattern** : Streamable HTTP cree un McpServer frais par session (SDK limite a 1 transport par instance). La factory appelle `registerAllTools(s, db)` a chaque session.
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

## Sub-agents

- **Agent dedie > agent generique** : un agent avec son propre system prompt (~11k tokens) vs un agent qui herite du system prompt complet Claude Code (~63k tokens). 6x moins de tokens pour le meme resultat.
- **Prompt minimal** : la skill resout les parametres (slug, fichiers, notebook ID) puis envoie un prompt de 3 lignes a l'agent. L'agent connait deja ses etapes.
- **Background par defaut** : `archive` et `status` en background, `init` en foreground (besoin du retour pour ecrire `.gerber-nlm`).
- **Model Haiku** : pour les taches mecaniques (upload fichiers, lister sources), Haiku suffit largement.

## Vault hub/spoke (pull-based RAG)

- **Hub centralise, satellites passifs** : `eRom/gerber-vault` orchestre tout (cron 15min pull les satellites via gh api tarball). Les satellites ont **zero workflow** lie au vault. Plus simple a maintenir que N workflows push-based.
- **2 PATs distincts** : `GERBER_VAULT_HUB` (Contents:RW gerber-vault seul) pour les writes, `GERBER_VAULT_SPOKE` (Contents:R all repos) pour les pulls. Least-privilege explicite.
- **Push via PAT pour chainer workflows** : `GITHUB_TOKEN` natif ne declenche PAS d'autres workflows (safety GHA contre les loops). Pour chainer pull-sources → sync-rag, le commit doit etre fait avec un PAT custom (`GERBER_VAULT_HUB`).
- **Idempotence par regex YAML** : pour modifier `sources.yml` via GitHub Contents API, l'idempotence se fait par regex sur ligne `^- repo: owner/name$` exacte. Pas besoin de parser YAML cote MCP (zero dep).
- **MCP > script local** : le tool MCP marche partout (Claude.ai, Desktop, mobile, Code), un script bash local ne marche que sur Code avec env vars configurees. Single source of truth = tool MCP, pas de mode fallback.

## Structured logging (Streamable HTTP)

- Logs vers stdout, captures par le TUI admin
- Prefixes colores : `-->` (request), `  <--` (result), `+`/`-` (session lifecycle), `!!` (auth failure)
- Timing sur les tool_call (elapsed en secondes)
- Session counter (active sessions)
