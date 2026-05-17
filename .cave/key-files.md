# Key Files — gerber-caserne
> Derniere mise a jour : 2026-05-17 (post-suppression couche notes + frontends ui/tui)

## packages/mcp/src/

| Fichier | Role |
|---------|------|
| `index.ts` | Entry point — parse args (`--stream`, `--db-path`, `--stream-token`), ouvre DB, applique migrations, cree McpServer, branche stdio OU lance HTTP server |
| `db/index.ts` | Ouvre SQLite, pragmas (WAL, busy_timeout, foreign_keys, recursive_triggers) |
| `db/migrate.ts` | Applique les migrations SQL sequentiellement + DDL hand-written + seed + cleanup processus |
| `db/ddl.ts` | DDL hand-written (vide depuis suppression notes/FTS — kept as hook for future virtual tables) |
| `db/seed.ts` | Insert projects seed (`global`, `caserne`) — idempotent |
| `db/backup.ts` | Checkpoint WAL + copy DB vers `~/.agent-brain/backups/` |
| `tools/index.ts` | `registerAllTools()` — enregistre tous les tools MCP sur le serveur |
| `tools/projects.ts` | CRUD projects + helper `toProject()` |
| `tools/tasks.ts` | CRUD tasks, kanban 7 colonnes, subtasks, reorder |
| `tools/issues.ts` | CRUD issues, 4 colonnes, severity/priority |
| `tools/handoffs.ts` | Session handoffs (global scope, pas projet). Resolution id OR title, plus recent wins sur collision |
| `tools/messages.ts` | Bus inter-sessions (context/reminder), status pending/done |
| `tools/runbook.ts` | Get/set runbook par projet, run/stop processus detaches, tail logs |
| `tools/maintenance.ts` | `backup_brain`, `get_stats` (compteurs projects/tasks/issues/messages/handoffs + dbSize) |
| `tools/rag.ts` | Tool MCP `rag` (query FileSearchStore Gemini + fetch GitHub) + `rag_onboard` (PUT sources.yml de eRom/gerber-vault via Contents API) |
| `tools/contracts.ts` | Zod envelopes (`RESPONSE_SHAPES`) pour les reponses des tools |
| `http/server.ts` | Express 5 — CORS, `/health`, OAuth router (si `GERBER_PUBLIC_URL`), montage Streamable HTTP |
| `http/streamable.ts` | Endpoint `/mcp/stream` — StreamableHTTPServerTransport, Bearer auth, session factory, logs structures |
| `http/oauth-provider.ts` | SingleUserOAuthProvider — single client, single user, no DCR, no consent UI |
| `config/user-config.ts` | Token Bearer + OAuth client creds + public URL persistes dans `~/.config/gerber/config.json` (mode 600) |
| `scripts/print-token.ts` | `pnpm mcp:token [--rotate]` — affiche/genere/rotate le token Streamable |
| `scripts/restore.ts` | `pnpm mcp:restore <path>` — restore DB depuis backup |
| `scripts/set-public-url.ts` | `pnpm mcp:set-url <url>` — persist le public URL (OAuth issuer) |

## packages/shared/src/

| Fichier | Role |
|---------|------|
| `db/schema.ts` | Drizzle schema (projects, messages, tasks, issues, handoffs, running_processes) |
| `schemas.ts` | Zod schemas (ProjectSchema, MessageSchema, TaskSchema, IssueSchema, HandoffSchema, StatsSchema, response envelopes) |
| `types.ts` | Types inferes depuis les Zod schemas + Runbook + RunningProcessInfo |
| `constants.ts` | `GLOBAL_PROJECT_ID`, `LIMITS`, enums STATUS/PRIORITY/SEVERITY pour tasks/issues/messages/handoffs |

## packages/admin/src/ (Rust)

| Fichier | Role |
|---------|------|
| `main.rs` | App loop + keybindings (S/B/C/W/Q/Tab) |
| `ui.rs` | Layout ratatui — split panes, status bar, log colorization |
| `process.rs` | Spawn/kill MCP + tunnel, capture stdout/stderr, pipe vers log channel |
| `config.rs` | Detect project root, read MCP version from package.json |

## gerber-claude-plugin/

| Fichier | Role |
|---------|------|
| `.mcp.json` | Config MCP cliente (URL distante + bearer placeholder) |
| `agents/agent-status.md` | Sub-agent — dashboard projet (tasks + issues) |
| `agents/agent-vault.md` | Sub-agent — archivage vault (operations archive/index) |
| `hooks/gerber-poll.sh` | SessionStart hook — poll messages/tasks/issues en attente |
| `hooks/hooks.json` | Declaration des hooks |
| `skills/<name>/SKILL.md` | Skills user-invocable (rag, task, issue, send, inbox, status, review, runbook, handoff, session-complete, onboarding, code-setup) |

## DB migrations (packages/mcp/src/db/migrations/)

| Fichier | Role |
|---------|------|
| `0000_yellow_starfox.sql` | Initial schema (projects/notes/chunks/embeddings/app_meta) |
| `0001_inter_session_bus.sql` | Table `messages` |
| `0002_tasks_issues.sql` | Tables `tasks` + `issues` |
| `0003_status_update.sql` | Backfill statuts |
| `0004_runbook.sql` | Colonnes runbook sur `projects` + table `running_processes` |
| `0005_handoffs.sql` | Table `handoffs` |
| `0006_drop_notes.sql` | **2026-05-17** — DROP notes/chunks/embeddings/notes_fts/fts_source/embedding_owners/app_meta + triggers associes |

## Config

| Fichier | Role |
|---------|------|
| `CLAUDE.md` | Instructions projet + gotchas + skills disponibles |
| `.cave/*.md` | Cartographie persistante (ce dossier) |
| `package.json` | Scripts racine (dev, build, test, typecheck, mcp:restore/token/set-url, admin) |
| `pnpm-workspace.yaml` | Pattern `packages/*` |
| `packages/mcp/tsup.config.ts` | Build config — bundle `@gerber-caserne/shared`, copy migrations vers `dist/migrations/` |
| `packages/mcp/drizzle.config.ts` | Drizzle Kit config (schema dans shared, out dans mcp) |
| `~/.cloudflared/config.yml` | Named tunnel `gerber` → `localhost:4000` (ingress path-scoped) |
| `~/.config/gerber/config.json` | Token Bearer + OAuth client (mode 600) |
| `~/.agent-brain/brain.db` | Database SQLite |

## docs/ (GitBook)

| Fichier | Role |
|---------|------|
| `docs/SUMMARY.md` | Navigation sidebar GitBook |
| `docs/README.md` | Landing page GitBook |
| `.gitbook.yaml` | Config GitBook — root: `./docs/` |

## Vault gerber (hub) — ~/.config/gerber-vault/

Repo `eRom/gerber-vault` clone localement et utilise comme vault Obsidian + hub RAG.

| Fichier | Role |
|---------|------|
| `sources.yml` | Registre des satellites (repo + paths). Edite via `mcp__gerber__rag_onboard`. |
| `.vault/scripts/sync.ts` | Sync incremental FileSearchStore Gemini (delete-then-upload, metadata repo+path). Lit ADDED/MODIFIED/DELETED depuis env. |
| `.vault/scripts/pull-sources.ts` | Itere sources.yml, gh api tarball par satellite, copie delta vers `<slug>/`. |
| `.vault/scripts/{check,clean,rag-query,vitrify}-vault.ts` | Outils debug/maintenance du store Gemini. |
| `.github/workflows/pull-sources.yml` | Cron 15min + workflow_dispatch. Checkout avec GERBER_VAULT_HUB pour que le push declenche sync-rag.yml. |
| `.github/workflows/sync-rag.yml` | On push main (paths-ignore .vault/.github/.obsidian/sources.yml). Lance sync.ts avec changed-files. Filtre `[skip ci-rag]` dans le commit msg. |
| `.github/workflows/bootstrap-rag.yml` | Workflow_dispatch only. Reindexation complete d'un slug (ou tous) via `git ls-files <slug>` + sync.ts en mode MODIFIED. |
| `.obsidian/` | Config Obsidian (vault navigable). `.vault/` et `.github/` invisibles cote Obsidian (prefixe `.`). |
