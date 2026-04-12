# Gotchas — gerber-caserne
> Derniere mise a jour : 2026-04-12

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
