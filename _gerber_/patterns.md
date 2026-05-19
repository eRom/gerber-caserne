# Patterns — gerber-caserne
> Derniere mise a jour : 2026-05-18 (Cloudflare Workers stack)

## Nommage

- **Fichiers** : kebab-case (`mcp-agent.ts`, `oauth.ts`, `tools.ts`)
- **Skills** : kebab-case verb-noun (`setup-bus`, `setup-code`, `session-complete`)
- **Tools MCP** : snake_case (`rag`, `rag_onboard`)
- **Secrets Worker** : SCREAMING_SNAKE_CASE (`STREAM_TOKEN`, `VAULT_EMBED_API_KEY`)

## Architecture

- **Stateless cote data** : aucune table SQLite metier. Le Durable Object `GerberMcp` n'a pas de state metier — il sert uniquement de routage par `Mcp-Session-Id`.
- **Triple transport** : Streamable HTTP (`/mcp/stream`) seul transport reel. OAuth single-user empile par-dessus pour claude.ai. Pas de stdio (le legacy `packages/mcp` qui le supportait a ete trash).
- **Knowledge offload** : pas de note store local. Toute connaissance qui doit etre retrouvable cross-projet vit dans le vault Gemini, sync via le pipeline `gerber-vault`.
- **Business offload** : Linear pour tasks/issues/handoffs, Airtable pour le bus messages. Gerber ne fait plus que la couche RAG.

## Code patterns (Worker)

- **Env via `Cloudflare.Env`** : augmenter le namespace global, pas declarer une interface independante (sinon `McpAgent.serve()` rejette a la compile parce que son generic attend `Env extends Cloudflare.Env`).
  ```typescript
  declare global {
    namespace Cloudflare {
      interface Env { STREAM_TOKEN: string; /* ... */ }
    }
  }
  export type Env = Cloudflare.Env;
  ```
- **Web Standards uniquement dans tools.ts** : `atob`/`btoa` + `Uint8Array` + `TextEncoder`/`TextDecoder`. Pas de `Buffer`, pas de `node:crypto`, pas de `node:fs`. `nodejs_compat` est actif mais reserve aux deps externes (`agents` l'utilise).
- **PKCE manual** : `crypto.subtle.digest('SHA-256', encoded)` puis base64url manuel (strip `=`, remplace `+/` par `-_`).
- **Random codes** : `crypto.getRandomValues(new Uint8Array(24))` + `toString(16)`.
- **CORS uniforme** : helper `withCors(res)` qui clone les headers et ajoute le preset. Applique sur TOUTES les responses (y compris 401, sinon le browser bloque).
- **WWW-Authenticate avec `resource_metadata`** : sur 401 `/mcp/stream`, expose le pointer vers `/.well-known/oauth-protected-resource` pour que les clients OAuth-aware decouvrent l'auth server.

## Tests

Aucun pour le moment cote worker. Le legacy `packages/mcp/tests` (vitest, 14 tests) a ete trash avec le reste. A reintroduire si besoin via `vitest` + `@cloudflare/vitest-pool-workers`.

## Build & Deploy

- **Build** : `wrangler deploy` (esbuild integre). Bundle ~290 KB gzip. Worker startup time ~48ms.
- **Deploy local** : `cd packages/worker && npx wrangler deploy`. Pas de CI/CD encore — manuel.
- **Secrets rotation** : `wrangler secret put <NAME>`. Worker redemarre auto.
- **KV bootstrap** : `wrangler kv namespace create OAUTH_KV` une fois, coller l'ID dans `wrangler.toml`.

## Skills

- **Frontmatter YAML obligatoire** : `name`, `description`, `user-invocable: true`. Le `description` doit lister les triggers en langage naturel (le matcher cote Claude Code se base la-dessus).
- **IDs Airtable hardcodes dans le CLAUDE.md du projet** (section `## Messages bus`) — resolution dynamique faite a l'onboarding, puis les skills `inbox`/`send` les lisent directement depuis le markdown sans round-trip API.

## Vault hub/spoke (pull-based RAG)

- **Hub centralise, satellites passifs** : `eRom/gerber-vault` orchestre tout (cron 15min pull les satellites via `gh api tarball`). Les satellites ont **zero workflow** lie au vault. Plus simple a maintenir que N workflows push-based.
- **2 PATs distincts** : `VAULT_GERBER_HUB` (Contents:RW gerber-vault seul) pour les writes, `GERBER_VAULT_SPOKE` (Contents:R all repos) pour les pulls. Least-privilege explicite.
- **Push via PAT pour chainer workflows** : `GITHUB_TOKEN` natif ne declenche PAS d'autres workflows (safety GHA contre les loops). Pour chainer `pull-sources → sync-rag`, le commit doit etre fait avec un PAT custom (`VAULT_GERBER_HUB`).
- **Idempotence par regex YAML** : pour modifier `sources.yml` via GitHub Contents API, l'idempotence se fait par regex sur ligne `^- repo: owner/name$` exacte. Pas besoin de parser YAML cote Worker (zero dep).
