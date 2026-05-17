# Architecture — gerber-caserne
> Derniere mise a jour : 2026-05-15 (vault gerber hub pull-based + rag_onboard)

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

| Entite | Stockage | Recherche | Scope |
|--------|----------|-----------|-------|
| Notes (atom/document) | SQLite + FTS5 + embeddings | hybrid/semantic/fulltext | projet |
| Tasks | SQLite | list avec filtres | projet |
| Issues | SQLite | list avec filtres | projet |
| Messages | SQLite | list par projet/status | projet (bus inter-sessions) |
| Handoffs | SQLite | list par status | **global** (pas scope projet) — passage de temoin cross-plateforme Claude |

## DB

- Fichier : `~/.agent-brain/brain.db`
- WAL mode + busy_timeout 5000ms
- Migrations via Drizzle
- FTS5 avec triggers pour sync
- Embeddings E5-base 768d stockes en BLOB

## Documentation (GitBook)

Doc publique hebergee sur GitBook.com (plan Community open-source), synchee via Git Sync depuis `docs/`.

- URL : `https://docs-gerber.romain-ecarnot.com`
- Config : `.gitbook.yaml` (root: `./docs/`)
- 33 fichiers Markdown, 8 sections (Getting Started, Installation, Plugin, Tools, Interfaces, Deployment, Architecture, Contributing)
- `SUMMARY.md` gere la sidebar GitBook
- Images dans `docs/assets/` (copies depuis `assets/`)
- README simplifie (~60 lignes) avec lien vers la doc

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
- `sources.yml` : registre des satellites (repo + paths whitelistes). Edite via tool MCP `rag_onboard` (PUT GitHub Contents API).
- `.vault/scripts/{sync,pull-sources,check-vault,clean-vault,rag-query,vitrify-vault}.ts` : scripts d'orchestration, migres depuis l'ex `eRom/gemini-vault-tech` (devenu legacy).
- 3 workflows : `pull-sources.yml` (cron pull satellites), `sync-rag.yml` (push → Gemini), `bootstrap-rag.yml` (reindexation complete manuelle).

Pattern hub/spoke avec 2 PATs distincts :
- `GERBER_VAULT_HUB` : Contents:RW sur `eRom/gerber-vault` uniquement (push hub + edit sources.yml)
- `GERBER_VAULT_SPOKE` : Contents:R sur tous les satellites (pull tarball)

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
