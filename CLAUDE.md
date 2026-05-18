# CLAUDE.md — gerber-caserne

## Project Structure

Monorepo with pnpm workspaces:
- `packages/shared/` — Pure TypeScript, no native deps. Drizzle schema + Zod types.
- `packages/mcp/` — MCP server (state engine) with better-sqlite3, Express 5, OAuth single-user.
- `packages/admin/` — Rust launcher (Ratatui) for the MCP server + cloudflared tunnel.

Knowledge memory is delegated to the **Gemini vault RAG** (`eRom/gerber-vault`), reached via the `rag` MCP tool. Notes/embeddings have been removed from this server.

## Key Commands

```bash
pnpm install              # Install deps
pnpm build                # Build MCP package
pnpm test                 # Run all tests
pnpm typecheck            # Type-check
pnpm mcp:restore <path>   # Restore DB from backup
pnpm mcp:token             # Print the Streamable HTTP bearer token + OAuth client creds
pnpm mcp:set-url <url>     # Persist public HTTPS URL (OAuth issuer + claude.ai)
```

## Gotchas

| # | Gotcha | Where |
|---|--------|-------|
| 1 | Express 5 requires `await import()` — no require() | `http/server.ts` |
| 2 | Response shapes must match Zod envelopes | `tools/contracts.ts` |
| 3 | camelCase ↔ snake_case: Drizzle returns camelCase, SQLite columns are snake_case. Always map raw rows via `toProject()` helpers | All tool handlers |
| 4 | Backup: checkpoint WAL before copy | `db/backup.ts` |
| 5 | Tags filter uses `json_each()` in SQL WHERE — never post-filter in JS | `tools/tasks.ts`, `tools/issues.ts` |
| 6 | Pragma order matters: WAL first, then busy_timeout | `db/index.ts` |
| 7 | `busy_timeout = 5000` prevents SQLITE_BUSY on concurrent access | `db/index.ts` |
| 8 | `/mcp/stream` is the only HTTP transport. The legacy `/mcp` JSON-RPC bridge was removed with the UI — do not re-add a path that bypasses bearer/OAuth auth | `http/server.ts`, `http/streamable.ts` |
| 9 | L'URL du tunnel (ex. `gerber.romain-ecarnot.com`) est gravée dans la credential Vault Anthropic (`mcp_server_url` immutable). Jamais de quick tunnel — utiliser named tunnel Cloudflare / tailscale funnel / reserved domain | `README.md` (section Managed Agent) |
| 10 | Token Streamable persistant dans `~/.config/gerber/config.json` (mode 600, généré à la première exécution). Rotation via `pnpm mcp:token --rotate` | `config/user-config.ts` |
| 11 | OAuth pour claude.ai custom connector : activé uniquement si `GERBER_PUBLIC_URL` est set (env ou persisté via `pnpm mcp:set-url`). Single-user, pas de DCR, pas de consent UI. `clientId`/`clientSecret` persistés dans `config.json` et à coller dans l'UI claude.ai. Cf. `docs/deployment/TUNNEL-HTTP-AuthID.md` | `http/oauth-provider.ts`, `http/server.ts` |
| 12 | Tunnel cloudflared : ingress **path-scoped** — un `path: ^/mcp/stream$` ne route QUE cette route, tout le reste fait 404 via le tunnel (origin répond pourtant en local). Toute nouvelle route distante (OAuth, future tool) doit être ajoutée dans `~/.cloudflared/config.yml` | `~/.cloudflared/config.yml` |
| 13 | Migration `0006_drop_notes.sql` removed the notes/chunks/embeddings/FTS/app_meta tables. Existing local databases drop those tables on next boot — there is no rollback. Knowledge memory now lives in the Gemini vault RAG | `db/migrations/0006_drop_notes.sql` |
| 14 | Migration `0008_drop_handoffs.sql` removed the handoffs table. Handoffs now live in Linear (workspace `eRom`, team `eRom-Agents`, projet `Handoffs`, label `handoff`). Mapping : `inbox → Todo`, `done → Done`. No rollback, no data migration | `db/migrations/0008_drop_handoffs.sql` |
| 15 | Migration `0009_drop_runbook.sql` removed the runbook feature : `running_processes` table + columns `run_cmd`, `run_cwd`, `url`, `env_json` on `projects`. Feature unused for 3 weeks, dropped along with the 5 `project_get_runbook`/`set_runbook`/`run`/`stop`/`tail_logs` tools. No rollback | `db/migrations/0009_drop_runbook.sql` |

## Pre-merge Checklist

- [ ] `pnpm test` passes
- [ ] `pnpm typecheck` passes
- [ ] `pnpm build` succeeds

## Gerber

Ce projet est indexé dans **gerber** sous le slug `agent-brain`.
Slug cross-projet : `caserne` (design system, conventions, preferences personnelles). Pour les sujets design/UI, conventions, stack : chercher aussi dans `caserne`.

Entites :
- **Messages** — bus inter-sessions (context + reminder)

Les **tasks et issues vivent dans Linear** (workspace `eRom`, team `eRom-Agents`) depuis le 2026-05-17 (migration `0007_drop_tasks_issues.sql`). 109 entités migrées (range EAT-61 → EAT-169). Workflow Linear : `inbox → brainstorming → specification → plan → implementation → test → done` (mapping 1:1 avec l'ancien kanban gerber).

Les **handoffs vivent dans Linear** (projet `Handoffs`, label `handoff`) depuis le 2026-05-17 (migration `0008_drop_handoffs.sql`). Mapping : `inbox → Todo`, `done → Done`. Pas de migration de data (<50 entités, valeur faible). Pilote : EAT-170.

La connaissance (specs, plans, `.cave/`, docs/superpowers) vit dans le **vault Gemini** (`eRom/gerber-vault`), interrogeable via `/gerber:rag`.

Skills disponibles :
- `/gerber:session-complete` — cartographie de fin de session (.cave/)
- `/gerber:inbox` — consulter les messages inter-sessions
- `/gerber:send` — envoyer un message inter-session
- `/gerber:rag` — recherche RAG dans le vault Gemini cross-projets (fetch GitHub des docs cités)
- `/gerber:handoff` — créer/lister/reprendre un transfert de session (passe par le plugin Linear MCP, projet `Handoffs`)
- `/gerber:status` — dashboard projet (messages)

## Contexte projet (.cave)

Le dossier `.cave/` contient la cartographie persistante du projet :
- `architecture.md` — vue d'ensemble, stack, flux de données
- `key-files.md` — fichiers critiques et leur rôle
- `patterns.md` — conventions et patterns récurrents
- `gotchas.md` — pièges, bugs résolus, workarounds

**Ne lis PAS ces fichiers au démarrage.** Lis-les à la demande, uniquement quand la question de l'utilisateur touche au domaine concerné (ex: question archi → `architecture.md`, bug étrange → `gotchas.md`). Pour une question triviale ou sans rapport avec le projet lui-même, ne les lis pas du tout.

## LSP Tools

A builtin tool with 9 operations mapping directly to LSP commands:

| Operation              | Description                                                     |
| ---------------------- | --------------------------------------------------------------- |
| `goToDefinition`       | Find where a symbol is defined                                  |
| `findReferences`       | Find all references to a symbol                                 |
| `hover`                | Get hover info (docs, type info) for a symbol                   |
| `documentSymbol`       | Get all symbols (functions, classes, variables) in a document   |
| `workspaceSymbol`      | Search for symbols across the entire workspace                  |
| `goToImplementation`   | Find implementations of an interface/abstract method            |
| `prepareCallHierarchy` | Get call hierarchy item at a position                           |
| `incomingCalls`        | Find all functions/methods that call the function at a position |
| `outgoingCalls`        | Find all functions/methods called by the function at a position |
