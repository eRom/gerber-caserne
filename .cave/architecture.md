# Architecture — gerber-caserne
> Derniere mise a jour : 2026-05-18 (apres migration 0011 + retrait packages/admin)

## Vue d'ensemble

Gerber est un **MCP server stateless** qui expose 2 tools : `rag` (query du vault Gemini cross-projets) et `rag_onboard` (enregistre un satellite dans `eRom/gerber-vault`). Toutes les anciennes responsabilites metier (projects, messages, handoffs, tasks, issues, runbooks, notes/embeddings) ont ete deleguees a des outils externes au fil des migrations 0006 → 0011 (mai 2026).

| Domaine | Stockage actuel | Acces |
|--------|-----------------|-------|
| Tasks / Issues | Linear (workspace `eRom`, team `eRom-Agents`) | `mcp__plugin_linear_linear__*` |
| Handoffs | Linear (projet `Handoffs`, label `handoff`) | `mcp__plugin_linear_linear__*` |
| Messages bus | Airtable (`gerber-bus / bus / Messages`) | `mcp__plugin_airtable_airtable__*` |
| Knowledge RAG | Gemini FileSearchStore (vault `eRom/gerber-vault`) | `mcp__plugin_gerber_gerber__rag` |
| Projects / Runbook | — (supprimes) | — |

La DB SQLite du MCP ne contient plus que la table `_migrations` (journal). Aucune table metier. Toute l'infrastructure DB (`openDatabase`, `applyMigrations`) reste en place pour que les anciens clients qui auraient une DB historique appliquent les migrations destructives au prochain boot.

**Stack** : TypeScript (Bun/pnpm), better-sqlite3 (WAL + busy_timeout 5000), Express 5, MCP SDK officiel, OAuth single-user.

## Structure monorepo (pnpm workspaces)

```
packages/
  shared/   Pure TS — primitives Zod (uuid/slug/hex/timestamp) + envelope factories. Aucun schema metier.
  mcp/      MCP server — 2 tools (rag, rag_onboard) + HTTP server (Streamable HTTP + OAuth).
gerber-claude-plugin/
  skills/   Skills user-invocable (8 : session-complete, setup-bus, setup-code, inbox, send, rag, handoff, onboarding)
  .mcp.json Config MCP cliente (URL distante + bearer placeholder GERBER_TOKEN)
assets/     Logos, screenshots
.cave/      Cartographie projet (ce dossier)
docs/       Markdown a plat (anciennement synche sur GitBook — config retiree 2026-05-18)
```

Plus de `packages/admin/` (Rust launcher Ratatui) — supprime 2026-05-18, le MCP tourne en distant donc le launcher local n'a plus de sens.

## Transports

- **stdio** : entry point `packages/mcp/dist/index.js`. Utilise par Claude Code / Gemini CLI / Codex en mode local.
- **Streamable HTTP** : endpoint `/mcp/stream` (active via `--stream`). Consomme par Claude Managed Agents et Claude.ai custom connector. Bearer auth via token persistant dans `~/.config/gerber/config.json`. Chaque session HTTP cree son propre `McpServer` (le SDK ne supporte qu'un transport par instance) via une factory.
- **OAuth single-user** : monte par-dessus le Streamable HTTP si `GERBER_PUBLIC_URL` est set. Pas de DCR, pas de consent UI, `clientId`/`clientSecret` persistes dans `config.json` et a coller manuellement dans claude.ai.

Le bridge JSON-RPC legacy `/mcp` n'existe plus depuis la suppression de `packages/ui/` (mai 2026). `/mcp/stream` est le seul transport HTTP.

## Hosting

Le serveur tourne **en distant** sur un VPS Hostinger (Docker, image `ghcr.io/erom/gerber-caserne`). Expose via Cloudflare Tunnel sur `https://gerber.mcp.romain-ecarnot.com/mcp/stream`. URL **immutable** (gravee dans la credential Vault Anthropic + dans `.mcp.json` du plugin).

```
Client (Claude Code / claude.ai)
  --HTTPS+Bearer--> gerber.mcp.romain-ecarnot.com
  --tunnel--> Docker container Hostinger (Express 5 :4000)
  --> McpServer --> tool rag --> Gemini FileSearchStore --> fetch GitHub raw
```

Le tunnel Cloudflare a une ingress **path-scoped** : seuls `/mcp/stream` et les paths OAuth sont publies. Toute nouvelle route distante doit etre ajoutee explicitement dans `~/.cloudflared/config.yml`.

## Vault RAG (`eRom/gerber-vault` hub)

Le seul "metier" qui reste cote serveur. Pipeline pull-based centralise sur `eRom/gerber-vault` (repo hub) qui agrege le contenu de N satellites et le pousse dans un FileSearchStore Gemini. Le repo est aussi le vault Obsidian local (`~/.config/gerber-vault/`).

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
                                                       sync-rag.yml (on push main)
                                                            |
                                                            | tj-actions/changed-files
                                                            | bun run .vault/scripts/sync.ts
                                                            v
                                                       Gemini FileSearchStore (vault-rag-tech)
                                                            |
                                                            v
                                                       tool MCP `rag` (query + fetch GitHub via VAULT_GERBER_PAT)
```

2 PATs distincts (least-privilege) :
- `GERBER_VAULT_HUB` : Contents:RW sur `eRom/gerber-vault` uniquement (push hub + edit `sources.yml`)
- `GERBER_VAULT_SPOKE` : Contents:R sur tous les satellites (pull tarball)

Le tool `rag_onboard` modifie `sources.yml` du hub via GitHub Contents API (idempotent par regex sur la ligne `^- repo: owner/name$`).
