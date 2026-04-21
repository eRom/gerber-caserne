# CLAUDE.md — agent-brain

## Project Structure

Monorepo with pnpm workspaces:
- `packages/shared/` — Pure TypeScript, no native deps. Drizzle schema + Zod types.
- `packages/mcp/` — MCP server with better-sqlite3, E5 embeddings, Express 5.

## Key Commands

```bash
pnpm install              # Install deps
pnpm build                # Build MCP package
pnpm test                 # Run all tests
pnpm typecheck            # Type-check
pnpm mcp:restore <path>   # Restore DB from backup
pnpm mcp:reindex           # Re-chunk all documents
pnpm mcp:token             # Print the Streamable HTTP bearer token
```

## Gotchas

| # | Gotcha | Where |
|---|--------|-------|
| 1 | Express 5 requires `await import()` — no require() | `http/server.ts` |
| 2 | Response shapes must match Zod envelopes | `tools/contracts.ts` |
| 3 | camelCase ↔ snake_case: Drizzle returns camelCase, SQLite columns are snake_case. Always map raw rows via `toProject()`/`toNote()` helpers | All tool handlers |
| 4 | Backup: checkpoint WAL before copy | `db/backup.ts` |
| 5 | `pipeline()` return type is a loose union — `@ts-expect-error` required | `embeddings/pipeline.ts` |
| 6 | Tests: `vi.mock('@huggingface/transformers')` in setup.ts prevents model download | `tests/setup.ts` |
| 7 | Tags filter uses `json_each()` in SQL WHERE — never post-filter in JS | `tools/notes.ts`, `search/*.ts` |
| 8 | E5 requires `passage:` / `query:` prefixes | `embeddings/embed.ts` |
| 9 | Token count includes the prefix (9 extra chars) | `embeddings/tokenizer.ts` |
| 10 | Pragma order matters: WAL first, then busy_timeout | `db/index.ts` |
| 11 | `busy_timeout = 5000` prevents SQLITE_BUSY on concurrent access | `db/index.ts` |
| 12 | Mock tokenizer (chars/4) may diverge from real E5 tokenizer — run `pnpm --filter @agent-brain/mcp test:e5` before merging changes to chunking | `tests/embeddings/chunking-real-e5.test.ts` |
| 13 | Embedder preload: fire-and-forget after server.listen | `http/server.ts` |
| 14 | AST chunker (not regex) — `#` inside fenced code blocks is not a header | `embeddings/chunking.ts` |
| 15 | `/mcp` ≠ `/mcp/stream`. Le premier est un pont JSON-RPC maison pour l'UI. Le second est le transport Streamable HTTP officiel MCP (Managed Agents). Ne pas fusionner les deux routes | `http/server.ts`, `http/streamable.ts` |
| 16 | L'URL du tunnel (ex. `gerber.romain-ecarnot.com`) est gravée dans la credential Vault Anthropic (`mcp_server_url` immutable). Jamais de quick tunnel — utiliser named tunnel Cloudflare / tailscale funnel / reserved domain | `README.md` (section Managed Agent) |
| 17 | Token Streamable persistant dans `~/.config/gerber/config.json` (mode 600, généré à la première exécution). Rotation via `pnpm mcp:token --rotate` | `config/user-config.ts` |
| 18 | Colonnes runbook (`run_cmd`, `run_cwd`, `url`, `env_json`) vivent sur `projects`. Table `running_processes` pour les PID détachés, nettoyée au boot via `cleanupStaleProcesses`. Logs dans `~/.local/state/gerber/runs/<slug>.log` | `tools/runbook.ts`, `db/migrate.ts`, `runbook/` |

## Pre-merge Checklist

- [ ] `pnpm test` passes
- [ ] `pnpm typecheck` passes
- [ ] If touching `embeddings/chunking.ts` or `embeddings/tokenizer.ts`: run `pnpm --filter @agent-brain/mcp test:e5` locally
- [ ] `pnpm build` succeeds

## Gerber

Ce projet est indexé dans **gerber** sous le slug `agent-brain`.
Slug cross-projet : `caserne` (design system, conventions, preferences personnelles). Pour les sujets design/UI, conventions, stack : chercher aussi dans `caserne`.

Entites :
- **Notes** (atoms + documents) — mémoire de connaissance, recherche sémantique/fulltext
- **Tasks** — tâches projet avec kanban 7 colonnes (inbox → brainstorming → specification → plan → implementation → test → done)
- **Issues** — problèmes/bugs avec kanban 4 colonnes (inbox → in_progress → in_review → closed)
- **Messages** — bus inter-sessions (context + reminder)

Skills disponibles :
- `/gerber:recall` — recherche contextuelle dans la mémoire cross-projets
- `/gerber:capture` — capture rapide d'un atome de connaissance
- `/gerber:archive` — extraction et archivage fin de session
- `/gerber:session-complete` — cartographie de fin de session (.cave/ + archive)
- `/gerber:review` — maintenance hebdomadaire (notes, tasks, issues)
- `/gerber:import` — migration one-shot depuis .cave/
- `/gerber:inbox` — consulter les messages inter-sessions
- `/gerber:send` — envoyer un message inter-session
- `/gerber:task` — gestion des tâches projet (kanban)
- `/gerber:issue` — gestion des issues projet
- `/gerber:vault` — archivage cross-projets dans un vault git
- `/gerber:runbook` — composer le runbook d'un projet (run_cmd, url, env) depuis la stack du repo

## Contexte projet (.cave)

Le dossier `.cave/` contient la cartographie persistante du projet :
- `architecture.md` — vue d'ensemble, stack, flux de données
- `key-files.md` — fichiers critiques et leur rôle
- `patterns.md` — conventions et patterns récurrents
- `gotchas.md` — pièges, bugs résolus, workarounds

**Ne lis PAS ces fichiers au démarrage.** Lis-les à la demande, uniquement quand la question de l'utilisateur touche au domaine concerné (ex: question archi → `architecture.md`, bug étrange → `gotchas.md`). Pour une question triviale ou sans rapport avec le projet lui-même, ne les lis pas du tout.
