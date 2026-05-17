# Architecture — gerber-caserne
> Derniere mise a jour : 2026-05-17 (suppression couche notes — RAG vault Gemini source unique)

## Vue d'ensemble

Gerber est un MCP server d'**orchestration cross-projets** pour agents IA. Il stocke des tasks, issues, messages inter-sessions, handoffs et runbooks par projet.

La **connaissance** (specs, plans, `.cave/`, docs/superpowers...) vit dans un vault Gemini RAG separe (`eRom/gerber-vault`), interrogeable via le tool MCP `rag`. Cette couche etait historiquement portee par des "notes" SQLite + embeddings E5 locaux ; elle a ete supprimee le 2026-05-17 (migration `0006_drop_notes.sql`).

**Stack** : TypeScript (Bun), better-sqlite3 (WAL + busy_timeout 5000), Express 5, MCP SDK officiel, OAuth single-user.

## Structure monorepo (pnpm workspaces)

```
packages/
  shared/   Pure TS — Drizzle schema, Zod types, constantes (GLOBAL_PROJECT_ID)
  mcp/      MCP server — tools, DB, HTTP server (Streamable HTTP + OAuth)
  admin/    Rust TUI (ratatui) — manage MCP + cloudflared tunnel
gerber-claude-plugin/
  skills/   Skills Claude Code (gerber-*)
  agents/   Sub-agents markdown (agent-vault, agent-status)
  hooks/    SessionStart hook (gerber-poll.sh)
  .mcp.json Config MCP cliente
assets/     Logos, screenshots
.cave/      Cartographie projet (ce dossier)
docs/       Documentation publique (GitBook)
```

## Transports

- **stdio** : `gerber-mcp` (entry point `packages/mcp/dist/index.js`), utilise par Claude Code / Gemini CLI / Codex via MCP protocol (JSON-RPC).
- **Streamable HTTP** : endpoint `/mcp/stream` (active via `--stream`), consomme par Claude Managed Agents et Claude.ai custom connector. Bearer auth via token persistant dans `~/.config/gerber/config.json`. Chaque session HTTP cree son propre McpServer (le SDK ne supporte qu'un transport par instance).
- **OAuth single-user** : monte par-dessus le Streamable HTTP si `GERBER_PUBLIC_URL` est set. Pas de DCR, pas de consent UI, `clientId`/`clientSecret` persistes dans `config.json` et a coller manuellement dans claude.ai.

Le bridge JSON-RPC `/mcp` (historiquement utilise par l'UI web) **n'existe plus** depuis la suppression de `packages/ui/` le 2026-05-17.

## Flux de donnees

```
Agent (Claude/Gemini)  --stdio-----------> McpServer --> tool handler --> SQLite
Managed Agent (cloud)  --Streamable HTTP-> tunnel --> Express /mcp/stream --> McpServer --> SQLite
Claude.ai connector    --OAuth + Stream--> tunnel --> Express /authorize+/mcp/stream --> McpServer --> SQLite

Tool `rag` (sur n'importe lequel) --> Gemini FileSearchStore --> fetch GitHub --> Markdown ground-truth
```

## Cloudflare Tunnel (bridge local → cloud)

Named tunnel `gerber` sur `gerber.romain-ecarnot.com` → `localhost:4000`. URL immutable (gravee dans la credential Vault Anthropic). Ingress **path-scoped** (`^/mcp/stream$`, plus les paths OAuth) — toute nouvelle route distante doit etre ajoutee explicitement dans `~/.cloudflared/config.yml`.

## Admin TUI (Rust)

`packages/admin/` — binaire `gerber-admin` (ratatui + tokio). Manage MCP + tunnel ensemble : start/stop, build, logs colores, version display. Lance via `pnpm admin`. Ne touche pas la DB ni les tools — pur orchestrateur de processus.

## Entites principales

| Entite | Stockage | Scope | Tools MCP |
|--------|----------|-------|-----------|
| Tasks | SQLite | projet | `task_create/list/get/update/delete/reorder` |
| Issues | SQLite | projet | `issue_create/list/get/update/close` |
| Messages | SQLite | projet (bus inter-sessions) | `message_create/list/update` |
| Handoffs | SQLite | **global** (cross-plateforme Claude) | `handoff_create/list/get/close` |
| Runbooks | SQLite (colonnes sur `projects`) | projet | `project_get_runbook/set_runbook/run/stop/tail_logs` |
| Projects | SQLite | — | `project_create/list/update/delete` |
| Vault RAG | Gemini FileSearchStore (externe) | cross-projet | `rag`, `rag_onboard` |

## DB

- Fichier : `~/.agent-brain/brain.db` (legacy path conserve par compat)
- WAL mode + busy_timeout 5000ms
- Migrations sequentielles via `db/migrate.ts` (lit `db/migrations/*.sql` ordonnes)
- Pas de FTS5, pas d'embeddings — la table `notes` et tout le subsystem associe ont ete drop par `0006_drop_notes.sql`
- Backup : checkpoint WAL + copy via `db/backup.ts` → `~/.agent-brain/backups/`

## Vault RAG cross-projets (gerber-vault hub)

Pipeline pull-based centralise sur `eRom/gerber-vault` (repo hub) qui agrege le contenu de N satellites et le pousse dans un FileSearchStore Gemini. Le repo est aussi le **vault Obsidian** local de Romain (`~/.config/gerber-vault/`).

```
N satellites (eRom/<projet>) -- aucun workflow cote satellite --
                                                                  v
                                                       gerber-vault/.github/workflows/
                                                       pull-sources.yml (cron 15min)
                                                            |
                                                            | gh api tarball/<repo> (via GERBER_VAULT_SPOKE)
                                                            | sync delta vers <slug>/
                                                            | commit + push (via GERBER_VAULT_HUB)
                                                            v
                                                       gerber-vault main updated
                                                            |
                                                            v
                                                       sync-rag.yml (on push main, paths-ignore .vault/.github)
                                                            |
                                                            | tj-actions/changed-files
                                                            | bun run .vault/scripts/sync.ts
                                                            v
                                                       Gemini FileSearchStore (vault-rag-tech)
                                                            |
                                                            v
                                            mcp__gerber__rag (query + fetch GitHub via VAULT_GERBER_PAT)
```

Composants cles :
- `sources.yml` : registre des satellites (repo + paths whitelistes). Edite via tool MCP `rag_onboard` (PUT GitHub Contents API, idempotent par regex `^- repo: owner/name$`).
- `.vault/scripts/{sync,pull-sources,check-vault,clean-vault,rag-query,vitrify-vault}.ts` : scripts d'orchestration.
- 3 workflows : `pull-sources.yml` (cron pull satellites), `sync-rag.yml` (push → Gemini), `bootstrap-rag.yml` (reindexation complete manuelle).

Pattern hub/spoke avec 2 PATs distincts :
- `GERBER_VAULT_HUB` : Contents:RW sur `eRom/gerber-vault` uniquement (push hub + edit sources.yml)
- `GERBER_VAULT_SPOKE` : Contents:R sur tous les satellites (pull tarball)

## Documentation (GitBook)

Doc publique hebergee sur GitBook.com (plan Community open-source), synchee via Git Sync depuis `docs/`.

- URL : `https://docs-gerber.romain-ecarnot.com`
- Config : `.gitbook.yaml` (root: `./docs/`)
- `SUMMARY.md` gere la sidebar GitBook
