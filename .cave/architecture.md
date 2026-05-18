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

Depuis 2026-05-18 le serveur tourne sur **Cloudflare Workers** (package `packages/worker/`). Custom domain : `https://gerber.romain-ecarnot.com/mcp/stream`. Plus de VPS Hostinger, plus de tunnel cloudflared, plus de Docker.

```
Client (Claude Code / claude.ai)
  --HTTPS+Bearer--> gerber.romain-ecarnot.com (Cloudflare edge)
  --> Worker fetch handler
  --> /mcp/stream  -> McpAgent (Durable Object pour la session)
  --> /authorize   -> single-user OAuth flow (codes en KV TTL 2min)
  --> /token       -> renvoie le STREAM_TOKEN statique (Bearer reutilise)
  --> McpServer --> tool rag --> Gemini FileSearchStore --> fetch GitHub raw
```

**Stack Worker** :
- `agents` (Cloudflare) — fournit `McpAgent` (Durable Object qui wrappe `WebStandardStreamableHTTPServerTransport`)
- `@modelcontextprotocol/sdk` — `McpServer` + register tools
- OAuth implementee a la main (~150 lignes, `src/oauth.ts`) — pas de DCR, single client, codes en KV
- 1 Durable Object (`GerberMcp`) + 1 KV namespace (`OAUTH_KV`) + 7 secrets via `wrangler secret put`

Le legacy `packages/mcp/` (Express 5 + Hostinger) est conserve transitionnellement le temps de valider la bascule, puis sera supprime.

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
