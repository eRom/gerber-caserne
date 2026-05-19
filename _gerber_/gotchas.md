# Gotchas — gerber-caserne
> Derniere mise a jour : 2026-05-18 (post-migration Cloudflare Workers)

## `agents` requiert `nodejs_compat`

Le package `agents` (Cloudflare) importe `node:async_hooks`, `node:diagnostics_channel`, `node:os` et `path`. Sans `compatibility_flags = ["nodejs_compat"]` dans `wrangler.toml`, le bundle echoue avec `Could not resolve "path"`.

## `McpAgent.serve(path)` + Durable Object obligatoire

`McpAgent` etend `DurableObject`. Une migration `new_sqlite_classes = ["GerberMcp"]` doit etre declaree dans `wrangler.toml`. Meme sans state metier, le DO est requis pour router les requests HTTP par `Mcp-Session-Id`.

## `Env extends Cloudflare.Env`, pas interface independante

`McpAgent.serve()` retourne `{ fetch<Env>(req, env, ctx) }` ou `Env extends Cloudflare.Env`. Si on declare une interface `Env` independante, TypeScript rejette le handler (`Type 'Env' is missing the following properties from type 'Env': MCP_OBJECT, OAUTH_KV...`). Solution :
```typescript
declare global {
  namespace Cloudflare {
    interface Env { MCP_OBJECT: DurableObjectNamespace<GerberMcp>; /* ... */ }
  }
}
export type Env = Cloudflare.Env;
```

## OAuth single-user maison, pas `@cloudflare/workers-oauth-provider`

Le package officiel force du DCR multi-tenant (clientId/secret genere a l'enregistrement, pas pre-provisionne). Pour matcher l'ancien `SingleUserOAuthProvider` (un seul client connu, claude.ai connector existant), on implemente le flow a la main (~150 LoC dans `src/oauth.ts`). Le DCR endpoint `/register` est pseudo-supporte : il retourne **toujours** le meme `clientId`/`clientSecret` statique (issu des secrets). Mauvaise hygiene multi-tenant, OK single-user.

## Claude Code Desktop utilise des `redirect_uri` localhost ephemeres

Format : `http://localhost:<port>/callback`. La liste fixe `['https://claude.ai/...', 'https://claude.com/...']` ne suffit pas. `ALLOWED_REDIRECT_PATTERNS` accepte par regex `localhost`, `127.0.0.1`, `claude.ai/*`, `claude.com/*`.

## `access_token` de `/token` = `STREAM_TOKEN` statique

Volontaire : Bearer pour Managed Agents (Vault Anthropic `static_bearer`) et OAuth token pour claude.ai partagent **exactement** la meme verif `Authorization: Bearer <STREAM_TOKEN>` sur `/mcp/stream`. Single verification path. Si on rotate `STREAM_TOKEN` cote Worker, propager partout :
- Vault Anthropic credential (recreer si l'URL n'a pas change)
- Shell env `GERBER_TOKEN` (utilise par `.mcp.json` du plugin Claude Code)
- Reauth claude.ai connector si necessaire

## Bug detecte : `~/.config/gerber/config.json` peut diverger du shell `GERBER_TOKEN`

Historiquement, le script `pnpm mcp:token --rotate` regenerait `streamToken` dans `config.json` mais ne touchait pas l'env var shell. Si on a continue d'utiliser l'ancien token via `GERBER_TOKEN`, les deux ont diverge. **Cote Worker, source de verite = la valeur de `GERBER_TOKEN` que les clients envoient effectivement**, pas le `config.json` (qui n'est plus lu). Le fichier `~/.config/gerber/` a ete supprime 2026-05-18 — plus de divergence possible.

## Buffer non dispo sur Workers

`Buffer.from(b64, 'base64')` -> helper `base64ToUtf8(b64)` qui utilise `atob` + `Uint8Array` + `TextDecoder`. `Buffer.from(s, 'utf-8').toString('base64')` -> `utf8ToBase64(s)`. GitHub Contents API retourne le `content` en base64 avec des `\n` insertions tous les 60 chars qu'il faut strip avant `atob`.

## `nodejs_compat` n'expose pas `Buffer` global

Meme avec `nodejs_compat`, `Buffer` n'est pas dans le scope global sur Workers (different de Node.js). Si on veut Buffer, il faut `import { Buffer } from 'node:buffer'`. Plus simple : rester en Web Standards (`atob`/`btoa`).

## Custom domain : conflit avec wildcard DNS

`gerber.mcp.romain-ecarnot.com` etait l'URL historique. Mais le wildcard DNS `*.mcp` existant pointait vers Hostinger, ce qui empechait Cloudflare Workers d'ajouter un Custom Domain dessus (refus UI sur le `.`). Solution : custom domain sur `gerber.romain-ecarnot.com` (sans `.mcp.`). Le DNS pointe directement sur Cloudflare Workers edge, pas via le wildcard. Aucun tunnel cloudflared implique dans le nouveau setup.

## Vault Anthropic : `mcp_server_url` immutable

Le champ `mcp_server_url` d'une credential Vault est immutable apres creation. Si l'URL change → archiver la credential + en creer une nouvelle. La credential actuelle pointe sur `gerber.romain-ecarnot.com` — ne pas la perdre.

## Migrations 0006-0011 sont **irreversibles** (legacy serveur Node)

Toutes les migrations 0006+ du legacy `packages/mcp/db/migrations/` ont DROP des tables SQLite. Plus de rollback possible. Le contenu vit deja ailleurs :
- Notes/embeddings → Gemini vault (`eRom/gerber-vault`)
- Tasks/Issues → Linear (workspace `eRom`)
- Handoffs → Linear (projet `Handoffs`)
- Messages → Airtable (base `bus`)
- Projects + Runbook → supprimes purement

Le Worker n'a aucune DB metier (juste KV pour les codes OAuth ephemeres).

## RTK intercepte `curl`

Dans les scripts bash, toujours utiliser `/usr/bin/curl` (pas `curl` nu) pour bypasser RTK qui peut transformer le JSON.

## `GITHUB_TOKEN` natif ne declenche pas d'autres workflows

GitHub Actions a une safety contre les loops : un workflow qui push avec `secrets.GITHUB_TOKEN` natif ne declenche **aucun** autre workflow sur le push resultant. Pour chainer (ex: `pull-sources.yml → sync-rag.yml` cote `gerber-vault`), il faut un PAT custom (`VAULT_GERBER_HUB`) au checkout.

## Gemini : utiliser `gemini-flash-latest`, pas `gemini-3-flash-preview`

Le modele `gemini-3-flash-preview` ne retourne pas une reponse valide via REST `:generateContent` (body = JSON schema descriptif, pas un `candidate`). Utiliser l'alias officiel `gemini-flash-latest` qui resolve vers Gemini 3 Flash. Reference dans `packages/worker/src/tools.ts`.

## `fileSearch` ne se declenche pas si `maxOutputTokens` < 1024

Avec `tools: [{ fileSearch: ... }]`, si `generationConfig.maxOutputTokens < 1024`, le modele s'arrete avant de declencher fileSearch et la reponse n'a aucun `groundingChunks`. Toujours mettre `maxOutputTokens: 1024` minimum quand on utilise fileSearch via REST.

## Marketplace.json doit etre bumpe avec plugin.json

Claude Code lit `marketplace.json` cote `erom-marketplace` pour resoudre la version cachee. Bumper `plugin.json` sans bumper `marketplace.json` → `/plugin update gerber` reste sur l'ancienne version. La skill `/release-plugin` patch les deux.

## IDs Airtable : hardcodes dans le CLAUDE.md du projet

Les IDs (workspace/base/table/fields) du bus messages sont resolus **une fois** a l'onboarding, puis ecrits dans la section `## Messages bus` du `CLAUDE.md` du projet. Les skills `/gerber:inbox` et `/gerber:send` les lisent directement depuis le markdown — pas de round-trip API. Voulu : zero latence, zero rate-limit, ID stable par projet.

## `wrangler deploy --dry-run` ignore les bindings KV/DO

Le dry-run valide le bundle (esbuild) mais n'echoue pas si le KV namespace ID est encore le placeholder `REPLACE_WITH_KV_ID`. Toujours faire un vrai deploy de test apres `wrangler kv namespace create` pour valider le binding effectif.
