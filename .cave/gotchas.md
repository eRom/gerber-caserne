# Gotchas — gerber-caserne
> Derniere mise a jour : 2026-05-18 (post-migrations destructives 0006-0011)

## Express 5 : `await import()`, pas `require()`

Express 5 ne supporte pas `require()`. Toujours `await import()` dans les modules dynamiques (`http/server.ts`).

## WAL + busy_timeout : ordre important

`PRAGMA journal_mode = WAL` AVANT `PRAGMA busy_timeout = 5000`. L'ordre inverse peut silently echouer.

## `/mcp/stream` est la seule route HTTP authentifiee

Depuis la suppression de l'UI (mai 2026), il n'y a plus de bridge JSON-RPC `/mcp`. Toute route ajoutee dans `http/server.ts` doit etre **explicitement** ajoutee dans l'ingress Cloudflare (`~/.cloudflared/config.yml`), sinon le tunnel fait 404. **Jamais** exposer une route sans bearer/OAuth.

## McpServer : un seul transport par instance

Le SDK MCP throw "Already connected to a transport" si on appelle `server.connect()` une deuxieme fois. Solution : factory pattern — un `McpServer` + `registerAllTools` frais par session Streamable HTTP.

## Vault Anthropic : `mcp_server_url` immutable

Le champ `mcp_server_url` d'une credential Vault est immutable apres creation. Si l'URL du tunnel change → archiver la credential + en creer une nouvelle. **Toujours** utiliser un named tunnel Cloudflare (URL stable), jamais un quick tunnel.

## Token Streamable : persistant, pas ephemere

Le token dans `~/.config/gerber/config.json` (mode 600) est genere une fois et persiste. Il doit matcher exactement le token dans la credential `static_bearer` du Vault Anthropic. Rotation via `pnpm mcp:token --rotate` puis mise a jour manuelle du Vault.

## Tunnel Cloudflare : path restriction obligatoire

Sans path restriction dans le `config.yml` Cloudflare, le tunnel expose TOUT localhost:4000. Restreindre l'ingress aux paths explicitement publies (`/mcp/stream`, OAuth `.well-known/*`, `/authorize`, `/token`...). Reverifier apres chaque ajout de route HTTP.

## GitBook + tunnel sur le meme sous-domaine = impossible

GitBook custom domain et Cloudflare tunnel ne peuvent pas coexister sur le meme sous-domaine. Solution : sous-domaine dedie pour la doc (`docs-gerber.romain-ecarnot.com` → CNAME `proxy.gitbook.site`), MCP sur `gerber.romain-ecarnot.com`.

## Migrations 0006-0011 sont **irreversibles**

Toutes les migrations 0006+ DROP des tables ou colonnes. Pas de rollback. Une DB historique qui boote sur la version actuelle perd silencieusement son contenu. Voulu — le contenu vit deja ailleurs :
- Notes/embeddings → Gemini vault (`eRom/gerber-vault`)
- Tasks/Issues → Linear (workspace `eRom`)
- Handoffs → Linear (projet `Handoffs`)
- Messages → Airtable (base `bus`)
- Projects + Runbook → supprimes purement

L'infrastructure `openDatabase` + `applyMigrations` reste en place specifiquement pour appliquer ces destructifs aux clients qui auraient encore une DB historique.

## RTK intercepte `curl`

Dans les skills bash et scripts, toujours utiliser `/usr/bin/curl` (pas `curl` nu) pour bypasser RTK qui peut transformer le JSON.

## Repo + DB renomme

GitHub repo renomme de `agent-brain` a `gerber-caserne` le 2026-04-12. Le chemin DB `~/.agent-brain/brain.db` est conserve par compat (pas de migration auto).

## `exactOptionalPropertyTypes` vs SDK MCP types

`StreamableHTTPServerTransport` declare ses callbacks (`onclose`, `onerror`, `onmessage`) avec `| undefined` explicite. L'interface `Transport` du SDK les declare en optional (`?`). Sous `exactOptionalPropertyTypes: true`, cast `as Transport` requis pour `server.connect()`.

## `GITHUB_TOKEN` natif ne declenche pas d'autres workflows

GitHub Actions a une safety contre les loops : un workflow qui push avec `secrets.GITHUB_TOKEN` natif ne declenche **aucun** autre workflow sur le push resultant. Pour chainer (ex: `pull-sources.yml → sync-rag.yml` cote `gerber-vault`), il faut un PAT custom (`GERBER_VAULT_HUB`) au checkout.

## Gemini : utiliser `gemini-flash-latest`, pas `gemini-3-flash-preview`

Le modele `gemini-3-flash-preview` ne retourne pas une reponse valide via REST `:generateContent` (body = JSON schema descriptif, pas un `candidate`). Utiliser l'alias officiel `gemini-flash-latest` qui resolve vers Gemini 3 Flash. Reference dans `packages/mcp/src/tools/rag.ts` et `.vault/scripts/rag-query.ts`.

## `fileSearch` ne se declenche pas si `maxOutputTokens` < 1024

Avec `tools: [{ fileSearch: ... }]`, si `generationConfig.maxOutputTokens < 1024`, le modele s'arrete avant de declencher fileSearch et la reponse n'a aucun `groundingChunks`. Toujours mettre `maxOutputTokens: 1024` minimum quand on utilise fileSearch via REST.

## Marketplace.json doit etre bumpe avec plugin.json

Claude Code lit `marketplace.json` cote `erom-marketplace` pour resoudre la version cachee. Bumper `plugin.json` sans bumper `marketplace.json` → `/plugin update gerber` reste sur l'ancienne version. La skill `/release-plugin` patch les deux.

## Dockerfile : refs mortes apres suppression d'un script

Le Dockerfile reference des chemins de scripts buildes (`packages/mcp/dist/scripts/<name>.js`) et le CMD. Quand on supprime un script ou un flag CLI, le build Docker echoue en CI mais pas en local tant qu'on ne rebuild pas l'image. Checklist apres suppression :
1. Verifier `Dockerfile` (`RUN node ... scripts/*`, `CMD`)
2. Verifier `packages/mcp/tsup.config.ts` (entry list)
3. Verifier `package.json` racine (scripts pnpm)

Incident historique : tag `gerber-v2.3.1` push → CI buildx fail sur `prefetch-model.js` inexistant. Fix : `gerber-v2.3.2` avec Dockerfile aligne. La CI est tag-driven donc pas de force-tag — bump patch obligatoire.

## `pnpm.overrides` pour CVE transitives

Quand une CVE HIGH touche une dep transitive non controlee (cas historique `fast-uri` via `@modelcontextprotocol/sdk → ajv → fast-uri`), forcer la version patchee via `pnpm.overrides` dans le `package.json` racine au lieu d'attendre un bump du parent :
```json
"pnpm": {
  "overrides": {
    "fast-uri": ">=3.1.2"
  }
}
```
`pnpm install` re-resolve le graph. Verifier avec `pnpm audit --audit-level=high`, puis commit `package.json` + `pnpm-lock.yaml`.

## Workflow dispatch GHA : delai d'indexation API

Apres `git push` d'un nouveau workflow, `gh workflow run` retourne 404 pendant ~5-10s (API pas encore index). `sleep 8-10` avant le premier trigger d'un nouveau workflow, ou retry avec backoff.

## IDs Airtable : hardcodes dans le CLAUDE.md du projet

Les IDs (workspace/base/table/fields) du bus messages sont resolus **une fois** a l'onboarding, puis ecrits dans la section `## Messages bus` du `CLAUDE.md` du projet. Les skills `/gerber:inbox` et `/gerber:send` les lisent directement depuis le markdown — pas de round-trip API. Voulu : zero latence, zero rate-limit, ID stable par projet.
