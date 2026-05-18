# CLAUDE.md — gerber-caserne

Les IDs Airtable (bus messages) et Linear (team / workflows) sont dans `~/.claude/GERBER.md` (contexte global). Section `## Messages bus` retirée de ce fichier 2026-05-18.

## Project Structure

Monorepo with pnpm workspaces. Un seul package actif :

- `packages/worker/` — MCP server **stateless** sur Cloudflare Workers. 2 tools : `rag` (query Gemini FileSearchStore + fetch GitHub) et `rag_onboard` (PUT `sources.yml` du hub). OAuth single-user (custom, ~150 LoC), Durable Object pour les sessions MCP, KV pour les codes OAuth.

Hosted sur `https://gerber.romain-ecarnot.com` (custom domain Cloudflare). Aucun serveur Node, aucun container Docker, aucun tunnel cloudflared.

Knowledge memory lives in the **Gemini vault RAG** (`eRom/gerber-vault`), reached via the `rag` MCP tool. Autres entités migrées hors gerber :
- tasks/issues/handoffs → Linear (workspace `eRom`, team `eRom-Agents`)
- messages bus → Airtable (`gerber-bus / bus / Messages`)

## Key Commands

```bash
pnpm install              # Install worker deps
pnpm typecheck            # Type-check
pnpm dev                  # wrangler dev (local Worker simulator)
pnpm deploy               # wrangler deploy
pnpm tail                 # wrangler tail (logs live)
```

Côté worker uniquement :
```bash
cd packages/worker
npx wrangler secret put <NAME>   # rotate a secret
npx wrangler secret list         # list secrets (names only)
npx wrangler kv key list --binding OAUTH_KV
```

## Gotchas

| # | Gotcha | Where |
|---|--------|-------|
| 1 | `agents` (Cloudflare) wrappe `WebStandardStreamableHTTPServerTransport` via `McpAgent`. `McpAgent.serve("/mcp/stream")` retourne un fetch handler — pas besoin d'instancier le transport soi-même | `src/mcp-agent.ts` |
| 2 | `McpAgent` étend `DurableObject` (`new_sqlite_classes` dans wrangler.toml). Une session MCP = un DO. Le DO est requis même si on a aucun state métier — c'est lui qui route les requests par `Mcp-Session-Id` | `wrangler.toml` |
| 3 | `Env extends Cloudflare.Env` — pas une interface indépendante. Étendre globalement via `declare global { namespace Cloudflare { interface Env { ... } } }`. Sinon `McpAgent.serve()` rejette `Env` à la compile | `src/index.ts` |
| 4 | Single-user OAuth maison (pas `@cloudflare/workers-oauth-provider` qui force DCR multi-tenant). `/authorize` redirect-on-success, `/token` retourne `STREAM_TOKEN` statique, `/register` DCR pseudo-supporté (retourne toujours le même clientId/secret) | `src/oauth.ts` |
| 5 | Claude Code Desktop utilise des `redirect_uri` localhost éphémères (`http://localhost:<port>/callback`). `ALLOWED_REDIRECT_PATTERNS` doit accepter `localhost`, `127.0.0.1`, `claude.ai`, `claude.com` | `src/oauth.ts` |
| 6 | `access_token` de `/token` = `STREAM_TOKEN` (statique), pour que Bearer Managed Agents et OAuth claude.ai partagent la même verif `/mcp/stream`. Si on rotate `STREAM_TOKEN`, propager partout (env shell `GERBER_TOKEN`, Vault Anthropic) | `src/oauth.ts` |
| 7 | Buffer non dispo sur Workers. Helpers `base64ToUtf8` / `utf8ToBase64` via `atob`/`btoa` + Uint8Array. PEM/base64 du GitHub Contents API arrive avec des `\n` qu'il faut strip avant `atob` | `src/tools.ts` |
| 8 | Custom domain `gerber.romain-ecarnot.com` : le `.` intermédiaire dans `gerber.mcp.romain-ecarnot.com` conflictue avec le wildcard DNS `*.mcp` chez Romain. Le custom domain Worker actuel est `gerber.romain-ecarnot.com` (pas `gerber.mcp...`). Vault Anthropic credential `mcp_server_url` immutable — si on rebascule un hostname, archiver + recréer | dashboard Cloudflare |
| 9 | `nodejs_compat` flag requis dans wrangler.toml (le package `agents` importe `node:async_hooks`, `node:diagnostics_channel`, `node:os`, `path`) | `packages/worker/wrangler.toml` |
| 10 | KV namespace OAUTH_KV stocke uniquement les authorization codes (TTL 2 min via `expirationTtl`). Pas d'access tokens persistés — ils sont reéus statiquement depuis le secret. Bootstrap : `wrangler kv namespace create OAUTH_KV` puis coller l'ID dans wrangler.toml | `src/oauth.ts`, `wrangler.toml` |

## Pre-merge Checklist

- [ ] `pnpm typecheck` passes
- [ ] `npx wrangler deploy --dry-run` (côté packages/worker) ne plante pas
- [ ] Smoke test : `curl https://gerber.romain-ecarnot.com/health` retourne `{"ok":true}`

## Gerber

Toutes les entités métier ont migré hors du serveur MCP gerber :

- **Tasks et Issues** → Linear (workspace `eRom`, team `eRom-Agents`) depuis le 2026-05-17 (migration `0007_drop_tasks_issues.sql`). 109 entités migrées (range EAT-61 → EAT-169). Workflow Linear : `inbox → brainstorming → specification → plan → implementation → test → done`.

- **Handoffs** → Linear (projet `Handoffs`, label `handoff`) depuis le 2026-05-17 (migration `0008_drop_handoffs.sql`). Mapping : `inbox → Todo`, `done → Done`.

- **Messages bus** → Airtable (workspace `gerber-bus`, base `bus`, table `Messages`) depuis le 2026-05-18 (migration `0010_drop_messages.sql`). Schema simplifié (`title`, `project`, `importance`, `content`, `status`). Voir la section `## Messages bus` en tête de ce fichier pour les IDs Airtable.

- **Hosting** → Cloudflare Workers depuis le 2026-05-18. Le serveur Express 5 + Docker + tunnel cloudflared + VPS Hostinger ont tous été retirés. Le code legacy `packages/mcp/` + `packages/shared/` + `Dockerfile` + `deploy-vps/` + workflow GHCR ont été trash.

Il reste donc côté serveur MCP gerber **2 tools** stateless : `rag` et `rag_onboard` (vault Gemini + GitHub Contents API). Tout le reste a été retiré ou délégué.

La connaissance (specs, plans, `.cave/`, docs/superpowers) vit dans le **vault Gemini** (`eRom/gerber-vault`), interrogeable via `/gerber:rag`.

Skills disponibles :
- `/gerber:session-complete` — cartographie de fin de session (.cave/)
- `/gerber:setup-bus` — provisionne/répare l'infra Airtable du bus messages (idempotent)
- `/gerber:setup-code` — initialise `.claude/settings.json` + `CLAUDE.md` selon la stack technique
- `/gerber:inbox` — consulter les messages Pending du bus (Airtable, current project + caserne)
- `/gerber:send` — envoyer un message sur le bus (Airtable, défaut destinataire `caserne`)
- `/gerber:rag` — recherche RAG dans le vault Gemini cross-projets (fetch GitHub des docs cités)
- `/gerber:handoff` — créer/lister/reprendre un transfert de session (passe par le plugin Linear MCP, projet `Handoffs`)
- `/gerber:onboarding` — initialise un projet (Linear + GitHub + .cave/ + vault RAG + CLAUDE.md)

## Contexte projet (.cave)

Le dossier `.cave/` contient la cartographie persistante du projet :
- `architecture.md` — vue d'ensemble, stack, flux de données
- `key-files.md` — fichiers critiques et leur rôle
- `patterns.md` — conventions et patterns récurrents
- `gotchas.md` — pièges, bugs résolus, workarounds

**Ne lis PAS ces fichiers au démarrage.** Lis-les à la demande, uniquement quand la question de l'utilisateur touche au domaine concerné (ex: question archi → `architecture.md`, bug étrange → `gotchas.md`).

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
