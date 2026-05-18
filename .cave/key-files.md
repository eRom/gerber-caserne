# Key Files — gerber-caserne
> Derniere mise a jour : 2026-05-18 (apres migration 0011 + retrait packages/admin + hooks)

## packages/mcp/src/

| Fichier | Role |
|---------|------|
| `index.ts` | Entry point — parse args (`--stream`, `--db-path`, `--stream-token`), ouvre DB, applique migrations, cree McpServer, branche stdio OU lance HTTP server |
| `db/index.ts` | Ouvre SQLite, pragmas (WAL → busy_timeout 5000 → foreign_keys → recursive_triggers, dans cet ordre) |
| `db/migrate.ts` | Applique les migrations SQL sequentiellement. Aucun seed (plus de tables metier a seeder). |
| `db/ddl.ts` | DDL hand-written — vide (kept comme hook pour eventuelles virtual tables) |
| `tools/index.ts` | `registerAllTools(server, _db)` — enregistre `rag` + `rag_onboard`. Le param `db` est garde pour compat de signature mais n'est plus utilise. |
| `tools/rag.ts` | Tools `rag` (query Gemini FileSearchStore + fetch GitHub) + `rag_onboard` (PUT `sources.yml` via Contents API) |
| `http/server.ts` | Express 5 — CORS, `/health`, OAuth router si `GERBER_PUBLIC_URL`, montage Streamable HTTP |
| `http/streamable.ts` | Endpoint `/mcp/stream` — StreamableHTTPServerTransport, Bearer auth, session factory, logs structures |
| `http/oauth-provider.ts` | SingleUserOAuthProvider — single client, single user, no DCR, no consent UI |
| `config/user-config.ts` | Token Bearer + OAuth client creds + public URL persistes dans `~/.config/gerber/config.json` (mode 600) |
| `scripts/print-token.ts` | `pnpm mcp:token [--rotate]` — affiche/genere/rotate le token Streamable |
| `scripts/set-public-url.ts` | `pnpm mcp:set-url <url>` — persist le public URL (OAuth issuer + claude.ai) |

## packages/shared/src/

Volontairement minimal — plus aucun schema metier ici depuis les migrations 0006-0011.

| Fichier | Role |
|---------|------|
| `index.ts` | Re-exports |
| `schemas.ts` | Primitives Zod (`UuidSchema`, `SlugSchema`, `HexColorSchema`, `TimestampSchema`) + envelope factories (`ListResponseSchema`, `ItemResponseSchema`, `MutationResponseSchema`) |
| `constants.ts` | `LIMITS = { MAX_TITLE: 200, MAX_LIST_LIMIT: 200 }` |
| `db/schema.ts` | `export {};` — kept for import path stability (annotait avant tout le schema Drizzle) |
| `types.ts` | `export {};` — idem |

## DB migrations (packages/mcp/src/db/migrations/)

| Fichier | Effet |
|---------|------|
| `0000_yellow_starfox.sql` | Initial — projects/notes/chunks/embeddings/app_meta |
| `0001_inter_session_bus.sql` | + table `messages` |
| `0002_tasks_issues.sql` | + tables `tasks` + `issues` |
| `0003_status_update.sql` | Backfill statuts |
| `0004_runbook.sql` | + colonnes runbook sur `projects` + table `running_processes` |
| `0005_handoffs.sql` | + table `handoffs` |
| `0006_drop_notes.sql` | **2026-05-17** — DROP notes/chunks/embeddings/notes_fts/fts_source/embedding_owners/app_meta. Migration vers Gemini vault. |
| `0007_drop_tasks_issues.sql` | **2026-05-17** — DROP tasks + issues. Migration vers Linear (109 entites EAT-61 → EAT-169). |
| `0008_drop_handoffs.sql` | **2026-05-17** — DROP handoffs. Migration vers Linear (projet `Handoffs` + label). |
| `0009_drop_runbook.sql` | **2026-05-18** — DROP running_processes + colonnes runbook (feature inutilisee). |
| `0010_drop_messages.sql` | **2026-05-18** — DROP messages. Migration vers Airtable (`gerber-bus / bus / Messages`). |
| `0011_drop_projects.sql` | **2026-05-18** — DROP projects (derniere table metier). Plus aucune table SQLite metier. |

Toutes les migrations 0006+ sont **destructives, sans rollback**. Une DB historique qui boote sur la version actuelle perd silencieusement son contenu. Voulu — le contenu vit deja ailleurs (Linear, Airtable, Gemini vault).

## gerber-claude-plugin/

| Fichier | Role |
|---------|------|
| `.mcp.json` | Config MCP cliente — pointe vers `https://gerber.mcp.romain-ecarnot.com/mcp/stream` + bearer `${GERBER_TOKEN}` |
| `skills/session-complete/SKILL.md` | Cartographie fin de session (.cave/) |
| `skills/setup-bus/SKILL.md` | Provision/repare l'infra Airtable du bus messages (idempotent) |
| `skills/setup-code/SKILL.md` | Initialise `.claude/settings.json` + `CLAUDE.md` selon la stack |
| `skills/inbox/SKILL.md` | Lit les messages `Pending` du bus (current project + caserne) via Airtable MCP |
| `skills/send/SKILL.md` | Envoie un message sur le bus via Airtable MCP (defaut destinataire `caserne`) |
| `skills/rag/SKILL.md` | Recherche RAG dans le vault Gemini + fetch GitHub des docs cites |
| `skills/handoff/SKILL.md` | Cree/liste/reprend un handoff via Linear MCP (projet `Handoffs`, label `handoff`) |
| `skills/onboarding/SKILL.md` | Initialise un projet : Linear + GitHub + .cave/ + enregistrement vault RAG + sections CLAUDE.md |

Plus aucun hook ni sub-agent (`hooks/` + `agents/` supprimes 2026-05-18).

## Config racine

| Fichier | Role |
|---------|------|
| `CLAUDE.md` | Instructions projet + gotchas condenses + skills disponibles |
| `CHANGELOG.md` | Notes de release par version |
| `.cave/*.md` | Cartographie persistante (ce dossier) |
| `package.json` | Scripts racine (`build`, `test`, `typecheck`, `mcp:token`, `mcp:set-url`) + `pnpm.overrides` (fast-uri >=3.1.2) |
| `pnpm-workspace.yaml` | Pattern `packages/*` |
| `Dockerfile` | Build runtime — entry `node dist/index.js --stream` |
| `packages/mcp/tsup.config.ts` | Build config — bundle `@gerber-caserne/shared` (`noExternal`), copie `src/db/migrations/` vers `dist/migrations/` |
| `.claude-plugin/plugin.json` | Metadata du plugin Claude Code |
| `~/.cloudflared/config.yml` | Named tunnel `gerber` → `localhost:4000` (ingress path-scoped) |
| `~/.config/gerber/config.json` | Token Bearer + OAuth client (mode 600) |
| `~/.agent-brain/brain.db` | Database SQLite (chemin legacy conserve par compat — ne contient plus que `_migrations`) |

## docs/

Markdown a plat (specs, plans, references). Anciennement synche vers GitBook.com — la config `.gitbook.yaml` a ete retiree 2026-05-18. Le contenu est ingere par le vault Gemini via le satellite `eRom/gerber-caserne` declare dans `sources.yml`, donc reste cross-projet via `/gerber:rag`.

## Vault gerber (hub) — ~/.config/gerber-vault/

Repo `eRom/gerber-vault` clone localement, sert simultanement de vault Obsidian, de hub RAG, et de "bible du savoir" cross-projets pour Romain.

| Fichier | Role |
|---------|------|
| `sources.yml` | Registre des satellites (repo + paths). Edite via `mcp__plugin_gerber_gerber__rag_onboard`. |
| `.vault/scripts/sync.ts` | Sync incremental FileSearchStore Gemini (delete-then-upload, metadata repo+path). Lit ADDED/MODIFIED/DELETED depuis env. |
| `.vault/scripts/pull-sources.ts` | Itere `sources.yml`, `gh api tarball` par satellite, copie delta vers `<slug>/`. |
| `.vault/scripts/{check,clean,rag-query,vitrify}-vault.ts` | Outils debug/maintenance du store Gemini. |
| `.github/workflows/pull-sources.yml` | Cron 15min + workflow_dispatch. Checkout avec `GERBER_VAULT_HUB` pour que le push declenche `sync-rag.yml`. |
| `.github/workflows/sync-rag.yml` | On push main (paths-ignore .vault/.github/.obsidian/sources.yml). Filtre `[skip ci-rag]` dans le commit msg. |
| `.github/workflows/bootstrap-rag.yml` | Workflow_dispatch only. Reindexation complete d'un slug (ou tous). |
| `.obsidian/` | Config Obsidian (vault navigable). `.vault/` et `.github/` invisibles cote Obsidian (prefixe `.`). |
