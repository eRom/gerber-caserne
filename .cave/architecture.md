# Architecture — gerber-caserne
> Derniere mise a jour : 2026-05-18 (post-migration vers Cloudflare Workers, drop complet legacy Hostinger/Express)

## Vue d'ensemble

Gerber est un **MCP server stateless** deploye sur Cloudflare Workers. Il expose 2 tools :
- `rag` : query du vault Gemini cross-projets (FileSearchStore) puis fetch GitHub Contents API des docs cites
- `rag_onboard` : PUT sur `eRom/gerber-vault/sources.yml` pour enregistrer un nouveau satellite

Toutes les anciennes responsabilites metier (projects, messages, handoffs, tasks, issues, runbooks, notes/embeddings) ont ete deleguees a des outils externes au fil des migrations 0006 → 0011 (mai 2026), puis le serveur lui-meme a ete reecrit pour Cloudflare Workers (2026-05-18) et l'infra Hostinger + Docker + cloudflared trash.

| Domaine | Stockage actuel | Acces |
|--------|-----------------|-------|
| Tasks / Issues | Linear (workspace `eRom`, team `eRom-Agents`) | `mcp__plugin_linear_linear__*` |
| Handoffs | Linear (projet `Handoffs`, label `handoff`) | `mcp__plugin_linear_linear__*` |
| Messages bus | Airtable (`gerber-bus / bus / Messages`) | `mcp__plugin_airtable_airtable__*` |
| Knowledge RAG | Gemini FileSearchStore (vault `eRom/gerber-vault`) | `mcp__plugin_gerber_gerber__rag` |
| Projects / Runbook / Notes / Embeddings | — (supprimes) | — |

**Stack** : TypeScript (ESM, es2022), `agents` (Cloudflare) + `@modelcontextprotocol/sdk`, Durable Objects + KV.

## Structure monorepo (pnpm workspaces)

```
packages/
  worker/   Cloudflare Worker MCP server (seul package du repo).
gerber-claude-plugin/
  skills/   Skills user-invocable (8 : session-complete, setup-bus, setup-code, inbox, send, rag, handoff, onboarding)
  .mcp.json Config MCP cliente (URL distante + bearer placeholder GERBER_TOKEN)
assets/     Logos, screenshots
_gerber_/      Cartographie projet (ce dossier)
docs/       Markdown a plat (anciennement synche sur GitBook — config retiree)
```

## Transports

- **Streamable HTTP** : endpoint `/mcp/stream` mount via `McpAgent.serve('/mcp/stream')` du package `agents`. Chaque session HTTP est routee vers une instance Durable Object distincte par `Mcp-Session-Id`.
- **stdio** : plus disponible (le legacy `packages/mcp` qui le supportait a ete trash). Tout client doit utiliser le transport HTTP.
- **OAuth single-user** : monte directement par le Worker (pas de package externe — flow custom dans `src/oauth.ts`). Endpoints `/authorize`, `/token`, `/register` (DCR pseudo, retourne toujours le meme clientId/secret), `/.well-known/oauth-authorization-server`, `/.well-known/oauth-protected-resource`.

## Hosting

| Composant | Implementation |
|---|---|
| Compute | Cloudflare Worker `gerber-mcp` (account `romain-ecarnot.workers.dev`) |
| Custom domain | `https://gerber.romain-ecarnot.com` (DNS auto-managed par CF Workers) |
| Sessions MCP | 1 Durable Object `GerberMcp` (sqlite class) par `Mcp-Session-Id` |
| Auth codes | KV namespace `OAUTH_KV` (TTL 2 min via `expirationTtl`) |
| Secrets | 7 secrets via `wrangler secret put` : `STREAM_TOKEN`, `OAUTH_CLIENT_ID`, `OAUTH_CLIENT_SECRET`, `VAULT_EMBED_API_KEY`, `VAULT_CORPUS_NAME`, `VAULT_GERBER_PAT`, `VAULT_GERBER_HUB` |
| Bootstrap | `packages/worker/scripts/deploy-bootstrap.sh` (one-shot, idempotent KV) |

```
Client (Claude Code / claude.ai)
  --HTTPS+Bearer--> gerber.romain-ecarnot.com (Cloudflare edge)
  --> Worker fetch handler
       /mcp/stream  -> McpAgent (DO routing par session-id)
       /authorize   -> single-user OAuth (store code in KV, TTL 2min)
       /token       -> renvoie STREAM_TOKEN statique
       /register    -> DCR pseudo (retourne le single static client)
       /.well-known -> metadata OAuth
  --> tool rag      -> Gemini FileSearchStore --> GitHub Contents API raw
  --> tool rag_onboard -> PUT GitHub Contents API (sources.yml)
```

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
- `VAULT_GERBER_HUB` : Contents:RW sur `eRom/gerber-vault` uniquement (push hub + edit `sources.yml`)
- `GERBER_VAULT_SPOKE` : Contents:R sur tous les satellites (pull tarball)

Le tool `rag_onboard` modifie `sources.yml` du hub via GitHub Contents API (idempotent par regex sur la ligne `^- repo: owner/name$`).
