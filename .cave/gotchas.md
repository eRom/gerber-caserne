# Gotchas — gerber-caserne
> Derniere mise a jour : 2026-05-15 (vault hub pull-based + Gemini model alias)

## MCP server name = "gerber"

Le serveur MCP s'appelle "gerber" (pas "agent-brain"). Renomme le 2026-04-12. Toutes les skills utilisent le prefixe `mcp__gerber__`. Le hook s'appelle `gerber-poll.sh`.

## projectId vs projectSlug dans task_list / issue_list

Le backend accepte `projectId` (UUID) ET `projectSlug` (string). L'UI passe `projectId`. Si aucun des deux n'est fourni, TOUTES les entites sont retournees (pas de filtre projet). Bug corrige le 2026-04-12.

## exactOptionalPropertyTypes dans tsconfig UI

Le tsconfig UI a `exactOptionalPropertyTypes: true`. Les props optionnelles passees conditionnellement doivent etre assertees avec `!` (ex: `onSubmit={onAddSubmit!}`). Sinon erreur TS2375.

## Fontsource import en JS, pas en CSS

`@fontsource-variable/inter` doit etre importe dans `main.tsx` (JS), pas dans `globals.css` (CSS). L'import CSS via `@import` genere des warnings woff2 "didn't resolve at build time" au build Vite.

## Express 5 : await import()

Express 5 ne supporte pas `require()`. Toujours utiliser `await import()`.

## WAL + busy_timeout : ordre important

`PRAGMA journal_mode = WAL` AVANT `PRAGMA busy_timeout = 5000`. L'ordre inverse peut silently echouer.

## RTK intercepte curl

Dans les skills bash et hooks, toujours utiliser `/usr/bin/curl` (pas `curl` nu) pour bypasser RTK qui transforme le JSON.

## Metadata merge shallow dans message_update

`message_update` merge les metadata au top-level. Les objets imbriques sont ecrases, pas deep-merged.

## Chunker et tables GFM

Le chunker AST necessite remark-gfm pour parser les tables markdown. Sans le plugin, crash sur les noeuds table.

## Repo renomme

GitHub repo renomme de `agent-brain` a `gerber-caserne` le 2026-04-12. Les noms de packages npm restent `@agent-brain/*` (non renommes).

## MCP tools NotebookLM casses (2026-04-12)

Les outils `mcp__notebooklm-mcp__*` echouent avec `cannot import name 'TaskContextSnapshot' from 'fastmcp.server.dependencies'`. Bug dans FastMCP. Workaround : utiliser le CLI `nlm` via Bash exclusivement.

## Agent generique = system prompt complet (~55k tokens)

Spawner un agent via `Agent` avec `model: "haiku"` sans `subagent_type` lui injecte le system prompt complet de Claude Code (toutes les skills, tous les MCP tools, instructions globales). Un agent dedie avec `subagent_type` recoit uniquement son propre system prompt (~3k tokens). Difference : ~63k vs ~11k tokens par appel.

## nlm notebook : auth expire en ~20 min

Les sessions NLM expirent apres ~20 minutes. Si les commandes `nlm` echouent, relancer `nlm login`. Le check rapide : `nlm login --check`.

## /mcp ≠ /mcp/stream (2026-04-15)

Deux endpoints tres differents. `/mcp` est un pont JSON-RPC maison qui pioche dans `_registeredTools` (champ prive du SDK, fragile). `/mcp/stream` est le transport Streamable HTTP officiel MCP. Ne jamais fusionner les deux routes.

## McpServer : un seul transport par instance (2026-04-15)

Le SDK MCP throw "Already connected to a transport" si on appelle `server.connect()` une deuxieme fois. Solution : factory pattern — un McpServer + registerAllTools frais par session Streamable.

## Vault Anthropic : mcp_server_url immutable (2026-04-15)

Le champ `mcp_server_url` d'une credential Vault est immutable apres creation. Si l'URL du tunnel change → archiver la credential + en creer une nouvelle. Consequence : toujours utiliser un named tunnel Cloudflare (URL stable), jamais un quick tunnel.

## Token Streamable : persistant, pas ephemere (2026-04-15)

Le token dans `~/.config/gerber/config.json` (mode 600) est genere une fois et persiste. Il doit matcher exactement le token dans la credential `static_bearer` du Vault Anthropic. Rotation via `pnpm mcp:token --rotate` puis mise a jour manuelle du Vault.

## Tunnel Cloudflare : path restriction obligatoire (2026-04-15)

Sans `path: /mcp/stream` dans le `config.yml` Cloudflare, le tunnel expose TOUT localhost:4000 (Web UI, JSON-RPC bridge) sans auth. Seul `/mcp/stream` a du Bearer auth. Toujours restreindre l'ingress au path `/mcp/stream`.

## GitBook + tunnel sur le meme sous-domaine = impossible (2026-04-15)

GitBook custom domain et Cloudflare tunnel ne peuvent pas coexister sur le meme sous-domaine. Solution : sous-domaine dedie pour la doc (`docs-gerber.romain-ecarnot.com` → CNAME `proxy.gitbook.site`), tunnel sur `gerber.romain-ecarnot.com`.

## exactOptionalPropertyTypes vs SDK types (2026-04-15)

`StreamableHTTPServerTransport` declare ses callbacks (`onclose`, `onerror`, `onmessage`) avec `| undefined` explicite. L'interface `Transport` du SDK les declare en optional (`?`). Sous `exactOptionalPropertyTypes: true`, cast `as Transport` requis pour `server.connect()`.

## exactOptionalPropertyTypes : Zod `.refine()` propage `T | undefined` (2026-04-21)

Avec `exactOptionalPropertyTypes: true`, `z.object({ id: z.string().optional() }).refine(...)` infere `{ id?: string | undefined }`, pas `{ id?: string }`. Si on passe ce résultat à un helper typé `{ id?: string }`, TS2379. Fix : typer explicitement la signature du helper en `{ id?: string | undefined }` (ou utiliser `z.infer<typeof Schema>`). Rencontre dans `tools/handoffs.ts` sur `resolveHandoff()`.

## Ajout d'un tool MCP : mettre a jour register.test.ts (2026-04-21)

`tests/tools/register.test.ts` assert le nombre total de tools et la liste `EXPECTED_TOOLS`. Ajouter un tool sans mettre ca a jour → 1 test rouge. Checklist ajout de tool :
1. Handler dans `tools/<entity>.ts`
2. `RESPONSE_SHAPES` dans `tools/contracts.ts`
3. `server.tool(...)` dans `tools/index.ts`
4. Bump count + ajout noms dans `tests/tools/register.test.ts`

## GITHUB_TOKEN ne declenche pas d'autres workflows (2026-05-15)

GitHub Actions a une safety contre les loops : un workflow qui push avec `secrets.GITHUB_TOKEN` natif **ne declenche AUCUN autre workflow** sur le push resultant. Pour chainer (ex: pull-sources.yml → sync-rag.yml), il faut absolument que le checkout/push utilise un PAT custom. Cas concret dans `eRom/gerber-vault/.github/workflows/pull-sources.yml` : `actions/checkout@v4 with: token: ${{ secrets.GERBER_VAULT_HUB }}`.

## Gemini model `gemini-3-flash-preview` retourne un schema (2026-05-15)

Le modele `gemini-3-flash-preview` ne retourne plus une reponse valide via REST `:generateContent` (body = JSON schema descriptif, pas un `candidate`). Utiliser l'alias officiel `gemini-flash-latest` qui resolve vers Gemini 3 Flash et est stable. Switch effectue dans `packages/mcp/src/tools/rag.ts` et `.vault/scripts/rag-query.ts`.

## fileSearch ne se declenche pas si maxOutputTokens trop bas (2026-05-15)

Avec `tools: [{ fileSearch: ... }]`, si `generationConfig.maxOutputTokens < 1024`, le modele s'arrete avant de declencher fileSearch et la reponse n'a aucun `groundingChunks`. Bug bloquant qui faisait que docs_rag retournait 0 sources. Toujours mettre `maxOutputTokens: 1024` minimum quand on utilise fileSearch via REST.

## Healthcheck deploy.sh : 12×5s pour cold start E5 (2026-05-15)

Le serveur MCP charge le modele E5 ONNX au boot (`embeddings/pipeline.ts` singleton). Cold start ~40-50s. Avant : healthcheck `5 tentatives × 5s = 25s max` → faux negatif systematique. Maintenant : `12×5s = 60s max` dans `vps-docker-manager-prod/scripts/deploy.sh`. Si on rajoute un autre modele lourd, monter encore.

## Marketplace.json doit etre bumpe avec plugin.json (2026-05-15)

Claude Code lit `marketplace.json` cote `erom-marketplace` pour resoudre la version cachee. Si on bumpe `plugin.json` sans bumper `marketplace.json` → `/plugin update gerber` reste sur l'ancienne version. La skill `/release-plugin` a ete patchee pour bump les deux.

## /gerber:vault skill supprime (2026-05-15)

Le skill `/gerber:vault` (archivage cross-projets dans vault git local) a ete supprime. Son role est desormais assume automatiquement par le pipeline `eRom/gerber-vault` (cron 15min pull les satellites). Pour les snapshots manuels ephemeres, faire directement dans `~/.config/gerber-vault/<projet>/` + commit.

## docs_rag tool renomme rag (2026-05-15)

Le tool MCP `docs_rag` est devenu `rag` (et le skill `/gerber:docs-rag` est devenu `/gerber:rag`). Si une vieille reference traîne dans des skills/scripts externes, elle pointe vers un tool inexistant cote serveur (37 tools depuis gerber-v2.2.0).

## Workflow dispatch GHA : delai d'indexation API (2026-05-15)

Apres `git push` d'un nouveau workflow, `gh workflow run` retourne 404 pendant ~5-10s (l'API ne l'a pas encore index). Toujours `sleep 8-10` avant le premier trigger d'un nouveau workflow, ou retry avec backoff.
