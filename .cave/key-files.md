# Key Files — gerber-caserne
> Derniere mise a jour : 2026-05-18 (post-migration Cloudflare Workers)

## packages/worker/src/

| Fichier | Role |
|---------|------|
| `index.ts` | Entry — augmente `Cloudflare.Env`, expose `GerberMcp` (re-export pour binding DO), router `fetch` qui dispatch sur `/health`, `/.well-known/*`, `/authorize`, `/token`, `/register`, `/mcp/stream`. Wrappe les responses avec CORS. |
| `mcp-agent.ts` | `class GerberMcp extends McpAgent<Env>` — register les 2 tools (`rag`, `rag_onboard`) dans `init()`. Pas de state metier. |
| `tools.ts` | Port direct de l'ancien `packages/mcp/src/tools/rag.ts` : `ragTool` (Gemini FileSearchStore + GitHub Contents API) et `ragOnboardTool` (GET/PUT `sources.yml` via Contents API). Web Standards uniquement : `atob`/`btoa` + `Uint8Array` au lieu de `Buffer`. |
| `oauth.ts` | Flow OAuth 2.1 single-user maison (~150 LoC) : `handleAuthorize`, `handleToken`, `handleRegister` (DCR pseudo qui retourne le meme client statique), `authServerMetadata`, `protectedResourceMetadata`. Codes stockes en KV TTL 2 min. PKCE S256 supporte. |

## packages/worker/

| Fichier | Role |
|---------|------|
| `package.json` | Deps : `agents`, `@modelcontextprotocol/sdk`, `zod`. DevDeps : `wrangler`, `@cloudflare/workers-types`, `typescript`. Scripts : `dev`, `deploy`, `typecheck`, `tail`. |
| `wrangler.toml` | Config Worker : `compatibility_date = 2025-12-01`, `compatibility_flags = ["nodejs_compat"]` (requis par `agents` qui importe `node:async_hooks` etc.). Binding `MCP_OBJECT` (DurableObject GerberMcp, sqlite class). Binding `OAUTH_KV` (KVNamespace). |
| `tsconfig.json` | strict + exactOptionalPropertyTypes + noUncheckedIndexedAccess. Types `@cloudflare/workers-types`. |
| `scripts/deploy-bootstrap.sh` | One-shot bootstrap : check wrangler login, create OAUTH_KV (idempotent), patch wrangler.toml, lit `~/.config/gerber/config.json` + `packages/.env`, set 7 secrets, deploy. Ne logge aucune valeur de secret. |

## Secrets du Worker

| Secret | Source historique | Usage |
|---|---|---|
| `STREAM_TOKEN` | `~/.config/gerber/config.json` → `streamToken` (ou directement env shell `GERBER_TOKEN`) | Bearer attendu sur `/mcp/stream`. Aussi retourne par `/token` comme `access_token` (compat OAuth claude.ai). |
| `OAUTH_CLIENT_ID` | `~/.config/gerber/config.json` → `oauthClientId` | Single client pre-registered (claude.ai connector). Verifie sur `/authorize` et `/token`. |
| `OAUTH_CLIENT_SECRET` | idem | Verifie sur `/token` POST. |
| `VAULT_EMBED_API_KEY` | `packages/.env` (Hostinger historique) | Cle API Gemini, x-goog-api-key sur generativelanguage.googleapis.com. |
| `VAULT_CORPUS_NAME` | idem | displayName du FileSearchStore Gemini (ex: `vault-rag-tech`). |
| `VAULT_GERBER_PAT` | idem | GitHub PAT Contents:R (fetch des docs cites par rag). |
| `VAULT_GERBER_HUB` | idem | GitHub PAT Contents:RW sur `eRom/gerber-vault` (rag_onboard PUT). |

## gerber-claude-plugin/

| Fichier | Role |
|---------|------|
| `.mcp.json` | Config MCP cliente — pointe vers `https://gerber.romain-ecarnot.com/mcp/stream` + bearer `${GERBER_TOKEN}` |
| `skills/session-complete/SKILL.md` | Cartographie fin de session (_gerber_/) |
| `skills/setup-bus/SKILL.md` | Provision/repare l'infra Airtable du bus messages (idempotent) |
| `skills/setup-code/SKILL.md` | Initialise `.claude/settings.json` + `CLAUDE.md` selon la stack |
| `skills/inbox/SKILL.md` | Lit les messages `Pending` du bus (current project + caserne) via Airtable MCP |
| `skills/send/SKILL.md` | Envoie un message sur le bus via Airtable MCP (defaut destinataire `caserne`) |
| `skills/rag/SKILL.md` | Recherche RAG dans le vault Gemini + fetch GitHub des docs cites |
| `skills/handoff/SKILL.md` | Cree/liste/reprend un handoff via Linear MCP (projet `Handoffs`, label `handoff`) |
| `skills/onboarding/SKILL.md` | Initialise un projet : Linear + GitHub + _gerber_/ + enregistrement vault RAG + sections CLAUDE.md |

Plus aucun hook ni sub-agent (`hooks/` + `agents/` supprimes 2026-05-18).

## Config racine

| Fichier | Role |
|---------|------|
| `CLAUDE.md` | Instructions projet + gotchas condenses + skills disponibles |
| `CHANGELOG.md` | Notes de release par version |
| `_gerber_/*.md` | Cartographie persistante (ce dossier) |
| `package.json` | Scripts racine — delegue tout au worker via pnpm filter |
| `pnpm-workspace.yaml` | Pattern `packages/*` (matche uniquement `worker` desormais) |
| `.claude-plugin/plugin.json` | Metadata du plugin Claude Code |

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
| `.github/workflows/pull-sources.yml` | Cron 15min + workflow_dispatch. Checkout avec `VAULT_GERBER_HUB` pour que le push declenche `sync-rag.yml`. |
| `.github/workflows/sync-rag.yml` | On push main (paths-ignore .vault/.github/.obsidian/sources.yml). Filtre `[skip ci-rag]` dans le commit msg. |
| `.github/workflows/bootstrap-rag.yml` | Workflow_dispatch only. Reindexation complete d'un slug (ou tous). |
| `.obsidian/` | Config Obsidian (vault navigable). `.vault/` et `.github/` invisibles cote Obsidian (prefixe `.`). |
