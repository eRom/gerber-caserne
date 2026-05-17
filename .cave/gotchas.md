# Gotchas — gerber-caserne
> Derniere mise a jour : 2026-05-17 (post-suppression couche notes + ui + tui)

## MCP server name = "gerber"

Le serveur MCP s'appelle "gerber" (pas "agent-brain"). Renomme le 2026-04-12. Toutes les skills utilisent le prefixe `mcp__gerber__`. Le hook s'appelle `gerber-poll.sh`.

## projectId vs projectSlug dans task_list / issue_list

Le backend accepte `projectId` (UUID) ET `projectSlug` (string). Si aucun des deux n'est fourni, TOUTES les entites sont retournees (pas de filtre projet).

## Express 5 : await import()

Express 5 ne supporte pas `require()`. Toujours utiliser `await import()`.

## WAL + busy_timeout : ordre important

`PRAGMA journal_mode = WAL` AVANT `PRAGMA busy_timeout = 5000`. L'ordre inverse peut silently echouer.

## RTK intercepte curl

Dans les skills bash et hooks, toujours utiliser `/usr/bin/curl` (pas `curl` nu) pour bypasser RTK qui transforme le JSON.

## Metadata merge shallow dans message_update

`message_update` merge les metadata au top-level. Les objets imbriques sont ecrases, pas deep-merged.

## Repo renomme

GitHub repo renomme de `agent-brain` a `gerber-caserne` le 2026-04-12. Le chemin DB historique `~/.agent-brain/brain.db` est conserve par compat (pas de migration auto).

## /mcp/stream est la seule route HTTP

Depuis la suppression de l'UI (2026-05-17), il n'y a plus de bridge JSON-RPC `/mcp`. Toute route ajoutee dans `http/server.ts` doit etre **explicitement** ajoutee dans l'ingress Cloudflare (`~/.cloudflared/config.yml`), sinon le tunnel fait 404. Ne JAMAIS exposer une route sans bearer/OAuth.

## McpServer : un seul transport par instance

Le SDK MCP throw "Already connected to a transport" si on appelle `server.connect()` une deuxieme fois. Solution : factory pattern — un McpServer + `registerAllTools` frais par session Streamable.

## Vault Anthropic : mcp_server_url immutable

Le champ `mcp_server_url` d'une credential Vault est immutable apres creation. Si l'URL du tunnel change → archiver la credential + en creer une nouvelle. Consequence : toujours utiliser un named tunnel Cloudflare (URL stable), jamais un quick tunnel.

## Token Streamable : persistant, pas ephemere

Le token dans `~/.config/gerber/config.json` (mode 600) est genere une fois et persiste. Il doit matcher exactement le token dans la credential `static_bearer` du Vault Anthropic. Rotation via `pnpm mcp:token --rotate` puis mise a jour manuelle du Vault.

## Tunnel Cloudflare : path restriction obligatoire

Sans path restriction dans le `config.yml` Cloudflare, le tunnel expose TOUT localhost:4000. Restreindre l'ingress aux paths explicitement publies (`/mcp/stream`, OAuth `.well-known/*`, `/authorize`, `/token`...). Reverifier apres chaque ajout de route HTTP.

## GitBook + tunnel sur le meme sous-domaine = impossible

GitBook custom domain et Cloudflare tunnel ne peuvent pas coexister sur le meme sous-domaine. Solution : sous-domaine dedie pour la doc (`docs-gerber.romain-ecarnot.com` → CNAME `proxy.gitbook.site`), tunnel sur `gerber.romain-ecarnot.com`.

## exactOptionalPropertyTypes vs SDK types

`StreamableHTTPServerTransport` declare ses callbacks (`onclose`, `onerror`, `onmessage`) avec `| undefined` explicite. L'interface `Transport` du SDK les declare en optional (`?`). Sous `exactOptionalPropertyTypes: true`, cast `as Transport` requis pour `server.connect()`.

## exactOptionalPropertyTypes : Zod `.refine()` propage `T | undefined`

Avec `exactOptionalPropertyTypes: true`, `z.object({ id: z.string().optional() }).refine(...)` infere `{ id?: string | undefined }`, pas `{ id?: string }`. Si on passe ce résultat à un helper typé `{ id?: string }`, TS2379. Fix : typer explicitement la signature du helper en `{ id?: string | undefined }` (ou utiliser `z.infer<typeof Schema>`). Rencontre dans `tools/handoffs.ts`.

## Ajout d'un tool MCP : mettre a jour register.test.ts

`tests/tools/register.test.ts` assert le nombre total de tools et la liste `EXPECTED_TOOLS`. Ajouter un tool sans mettre ca a jour → 1 test rouge. Checklist ajout de tool :
1. Handler dans `tools/<entity>.ts`
2. `RESPONSE_SHAPES` dans `tools/contracts.ts`
3. `server.tool(...)` dans `tools/index.ts`
4. Bump count + ajout noms dans `tests/tools/register.test.ts`

## GITHUB_TOKEN ne declenche pas d'autres workflows

GitHub Actions a une safety contre les loops : un workflow qui push avec `secrets.GITHUB_TOKEN` natif **ne declenche AUCUN autre workflow** sur le push resultant. Pour chainer (ex: pull-sources.yml → sync-rag.yml), il faut absolument que le checkout/push utilise un PAT custom. Cas concret dans `eRom/gerber-vault/.github/workflows/pull-sources.yml` : `actions/checkout@v4 with: token: ${{ secrets.GERBER_VAULT_HUB }}`.

## Gemini model `gemini-3-flash-preview` retourne un schema

Le modele `gemini-3-flash-preview` ne retourne plus une reponse valide via REST `:generateContent` (body = JSON schema descriptif, pas un `candidate`). Utiliser l'alias officiel `gemini-flash-latest` qui resolve vers Gemini 3 Flash et est stable. Switch effectue dans `packages/mcp/src/tools/rag.ts` et `.vault/scripts/rag-query.ts`.

## fileSearch ne se declenche pas si maxOutputTokens trop bas

Avec `tools: [{ fileSearch: ... }]`, si `generationConfig.maxOutputTokens < 1024`, le modele s'arrete avant de declencher fileSearch et la reponse n'a aucun `groundingChunks`. Toujours mettre `maxOutputTokens: 1024` minimum quand on utilise fileSearch via REST.

## Marketplace.json doit etre bumpe avec plugin.json

Claude Code lit `marketplace.json` cote `erom-marketplace` pour resoudre la version cachee. Si on bumpe `plugin.json` sans bumper `marketplace.json` → `/plugin update gerber` reste sur l'ancienne version. La skill `/release-plugin` patch les deux.

## docs_rag tool renomme rag (2026-05-15)

Le tool MCP `docs_rag` est devenu `rag` (et le skill `/gerber:docs-rag` est devenu `/gerber:rag`). Si une vieille reference traîne dans des skills/scripts externes, elle pointe vers un tool inexistant cote serveur.

## Workflow dispatch GHA : delai d'indexation API

Apres `git push` d'un nouveau workflow, `gh workflow run` retourne 404 pendant ~5-10s (l'API ne l'a pas encore index). Toujours `sleep 8-10` avant le premier trigger d'un nouveau workflow, ou retry avec backoff.

## Migration 0006 = irreversible (2026-05-17)

`0006_drop_notes.sql` DROP toutes les tables `notes`, `chunks`, `embeddings`, `notes_fts`, `fts_source`, `embedding_owners`, `app_meta` + tous leurs triggers. Au boot suivant, une DB existante perd silencieusement ses 277 notes locales. Pas de rollback automatique. Si besoin de recuperer du contenu, le faire depuis `eRom/gerber-vault` (qui contient deja la connaissance archivee via le pipeline pull-sources).

## Skills supprimes (2026-05-17)

`/gerber:recall`, `/gerber:capture`, `/gerber:import`, `/gerber:archive` ont ete supprimes — leur role (memoire de connaissance) est porte par le vault Gemini RAG (`/gerber:rag`). `/gerber:session-complete` ne pousse plus dans gerber, il se contente d'ecrire les fichiers `.cave/`.

## Frontends ui/tui supprimes (2026-05-17)

`packages/ui/` (Vite/React) et `packages/tui/` (Ink) ont ete trash. Le bridge `/mcp` JSON-RPC qui les servait a aussi ete retire. Le seul transport HTTP restant est `/mcp/stream`. Si une UI future est ajoutee, repenser l'auth (CORS + bearer ou OAuth — pas de re-introduction d'un endpoint non-auth comme c'etait le cas avant).
