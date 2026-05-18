# Patterns — gerber-caserne
> Derniere mise a jour : 2026-05-18 (post-migrations destructives + retrait admin/hooks)

## Nommage

- **Fichiers** : kebab-case (`use-stream.ts`, `oauth-provider.ts`)
- **Skills** : kebab-case verb-noun (`setup-bus`, `setup-code`, `session-complete`)
- **Tools MCP** : snake_case (`rag`, `rag_onboard`)
- **DB colonnes** : snake_case (`project_id`, `created_at`) — historique, plus utilise depuis 0011

## Architecture

- **Stateless cote DB** : aucun tool ne lit/ecrit de table metier. La DB existe seulement pour appliquer le journal `_migrations` (utile aux clients qui ont une DB historique).
- **Triple transport** : stdio + Streamable HTTP (`/mcp/stream`) + OAuth single-user (par-dessus le Streamable). Tous via `registerAllTools()`.
- **Server factory pattern** : Streamable HTTP cree un `McpServer` frais par session (le SDK limite a 1 transport par instance). La factory appelle `registerAllTools(s, db)` a chaque session.
- **Knowledge offload** : pas de note store local. Toute connaissance qui doit etre retrouvable cross-projet vit dans le vault Gemini, sync via le pipeline `gerber-vault`.
- **Business offload** : Linear pour tasks/issues/handoffs, Airtable pour le bus messages. Gerber ne fait plus que la couche RAG.

## Code patterns

- **Zod en frontiere** : tous les inputs MCP sont parses via Zod. Schemas inline dans `tools/rag.ts` (plus assez de tools pour justifier un `contracts.ts` partage).
- **Tool handler pattern** : Zod input parse → call externe (Gemini API ou GitHub Contents API) → reponse texte ou JSON.
- **Pas de helpers DB** : plus de mapping camelCase ↔ snake_case (plus de tables metier).
- **Async config load** : `loadConfig()` retourne `Promise<UserConfig>`. `index.ts` await avant de demarrer le McpServer.

## Tests

- **Framework** : Vitest, `setupFiles: ['./src/tests/setup.ts']`, pool `threads`.
- **DB de test** : `freshDb()` ouvre un `:memory:`, applique les migrations. Suffisant — il n'y a plus de seed metier a verifier.
- **5 fichiers de tests, 14 tests** :
  - `tests/config/user-config.test.ts` — token + OAuth creds persistes mode 600
  - `tests/db/schema.test.ts` — pragmas + idempotence migrations + `_migrations` seule table survivante
  - `tests/http/health.test.ts` — endpoint `/health`
  - `tests/http/streamable.test.ts` — Streamable HTTP transport (bearer, sessions, DELETE, legacy `/mcp` = 404)
  - `tests/tools/register.test.ts` — `EXPECTED_TOOLS = ['rag', 'rag_onboard']`
- **Ajout d'un tool** : updater `EXPECTED_TOOLS` dans `register.test.ts` (assert sur le nombre exact + les noms).

## Build

- **MCP** : tsup (ESM, es2022), bundle `@gerber-caserne/shared` via `noExternal`. Copie `src/db/migrations/` vers `dist/migrations/` via `onSuccess`.
- **Commande globale** : `pnpm build` (= `pnpm --filter @gerber-caserne/mcp build`)
- **DTS** : `tsup.config.ts` force `module: 'esnext'` + `moduleResolution: 'bundler'` dans la compilerOptions de rollup-plugin-dts, sinon TS1378 sur top-level await dans certains conteneurs (`node:22-bookworm-slim`).
- **Entries** : 3 binaires (`index.ts`, `scripts/print-token.ts`, `scripts/set-public-url.ts`). Banner shebang sur `index.ts` seulement.

## Skills

- **Frontmatter YAML obligatoire** : `name`, `description`, `user-invocable: true`. Le `description` doit lister les triggers en langage naturel (le matcher cote Claude Code se base la-dessus).
- **Pre-traitement leger dans la skill, gros travail dans un agent** (quand applicable) : 0 agent dedie actuel — toutes les skills tapent directement sur leur MCP cible (Linear, Airtable, Gemini).
- **IDs Airtable hardcodes dans le CLAUDE.md du projet** (section `## Messages bus`) — resolution dynamique faite a l'onboarding, puis les skills `inbox`/`send` les lisent directement depuis le markdown sans round-trip API.

## Release & deploy VPS

- **Tag git = release Docker** : `git tag gerber-vX.Y.Z` + `git push --tags` declenche `.github/workflows/release.yml` qui build l'image GHCR `ghcr.io/erom/gerber-caserne:vX.Y.Z` puis dispatche `repository_dispatch` (event_type `app-release`) vers `eRom/vps-docker-manager-prod` qui SSH + restart le container. Le prefix `gerber-` est strip par le puller pour matcher la convention `vX.Y.Z` cote image.
- **Plugin version vs MCP version** : independants. Plugin (`.claude-plugin/plugin.json`) bumped via `/release-plugin`. MCP image (tag git) bumped via `/release`. Convention : aligner les deux quand c'est possible.
- **Audit security gate** : `/release` lance `pnpm audit --audit-level=high` et bloque sur critical/high. Pour les CVE transitives non fixables, ajouter un `pnpm.overrides` dans le `package.json` racine.

## Vault hub/spoke (pull-based RAG)

- **Hub centralise, satellites passifs** : `eRom/gerber-vault` orchestre tout (cron 15min pull les satellites via `gh api tarball`). Les satellites ont **zero workflow** lie au vault. Plus simple a maintenir que N workflows push-based.
- **2 PATs distincts** : `GERBER_VAULT_HUB` (Contents:RW gerber-vault seul) pour les writes, `GERBER_VAULT_SPOKE` (Contents:R all repos) pour les pulls. Least-privilege explicite.
- **Push via PAT pour chainer workflows** : `GITHUB_TOKEN` natif ne declenche PAS d'autres workflows (safety GHA contre les loops). Pour chainer `pull-sources → sync-rag`, le commit doit etre fait avec un PAT custom (`GERBER_VAULT_HUB`).
- **Idempotence par regex YAML** : pour modifier `sources.yml` via GitHub Contents API, l'idempotence se fait par regex sur ligne `^- repo: owner/name$` exacte. Pas besoin de parser YAML cote MCP (zero dep).

## Structured logging (Streamable HTTP)

- Logs vers stdout (capture par Docker → logs Hostinger)
- Prefixes : `-->` (request), `  <--` (result), `+`/`-` (session lifecycle), `!!` (auth failure)
- Timing sur les tool_call (elapsed en secondes)
- Session counter (active sessions)
