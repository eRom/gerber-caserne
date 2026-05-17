# Patterns — gerber-caserne
> Derniere mise a jour : 2026-05-17 (post-suppression couche notes + frontends ui/tui)

## Nommage

- **Fichiers** : kebab-case (`agent-status.md`, `use-stream.ts`)
- **Tools MCP** : snake_case (`task_list`, `handoff_create`, `rag_onboard`)
- **DB colonnes** : snake_case (`project_id`, `created_at`)
- **TS interfaces** : camelCase cote code, snake_case cote SQL — mapping via `toProject()` (et helpers equivalents pour tasks/issues) obligatoires

## Architecture

- **Tool handler pattern** : Zod input parse → DB query → Zod envelope response (`RESPONSE_SHAPES` dans `contracts.ts`)
- **Reference resolution (id-or-title)** : pour les entites avec titre naturel (ex: handoffs), exposer `{ id?: uuid, title?: string }` + `refine()` au moins-un-requis. Collision de titre → plus recent wins + `console.warn`. Pragmatique pour skills qui parlent en langage naturel.
- **Triple transport** : stdio + Streamable HTTP (`/mcp/stream`) + OAuth single-user (par-dessus le Streamable). Tous via `registerAllTools()`.
- **Server factory pattern** : Streamable HTTP cree un McpServer frais par session (SDK limite a 1 transport par instance). La factory appelle `registerAllTools(s, db)` a chaque session.
- **Knowledge offload** : pas de note store local. Toute connaissance qui doit etre retrouvable cross-projet vit dans le vault Gemini, sync via le pipeline `gerber-vault`.

## Code patterns

- **Zod en frontiere** : tous les inputs MCP/HTTP sont parses via Zod, les outputs valides contre `RESPONSE_SHAPES` (`contracts.test.ts`).
- **Tags** : stockes en JSON array dans une colonne TEXT, filtres via `json_each()` en SQL (jamais post-filter JS).
- **Metadata passthrough** : les champs `metadata` (tasks/issues/messages) acceptent des cles non listees via `.passthrough()`. Les cles connues sont juste hint pour validation.
- **camelCase/snake_case bridge** : Drizzle retourne camelCase, SQLite est snake_case, helpers de mapping obligatoires.

## Tests

- **Framework** : Vitest, `setupFiles: ['./src/tests/setup.ts']`, pool `threads`.
- **DB de test** : `freshDb()` ouvre un `:memory:`, applique les migrations puis seed. Suffisant pour la majorite des tests (FK + triggers OK en memoire).
- **Backup** : besoin d'une DB fichier reelle (WAL ne marche pas en `:memory:`) — `tests/db/backup.test.ts` cree un tmp dir.
- **Register test** : `tests/tools/register.test.ts` assert la liste exacte des tools enregistres. Toujours mettre a jour `EXPECTED_TOOLS` quand on ajoute/retire un tool.

## Build

- **MCP** : tsup (ESM, es2022), bundle `@gerber-caserne/shared` via `noExternal`. Copie `src/db/migrations/` vers `dist/migrations/` via `onSuccess`.
- **Commande globale** : `pnpm build` (= `pnpm --filter @gerber-caserne/mcp build`)
- **Admin** : `pnpm admin` (cargo run release)

## Sub-agents

- **Agent dedie > agent generique** : un agent avec son propre system prompt (~3-11k tokens) vs un agent qui herite du system prompt complet Claude Code (~55-63k tokens). 6x moins de tokens pour le meme resultat.
- **Prompt minimal** : la skill resout les parametres (slug, fichiers, IDs) puis envoie un prompt de 3 lignes a l'agent. L'agent connait deja ses etapes.
- **Background par defaut** quand la skill n'a pas besoin du retour pour continuer.

## Vault hub/spoke (pull-based RAG)

- **Hub centralise, satellites passifs** : `eRom/gerber-vault` orchestre tout (cron 15min pull les satellites via gh api tarball). Les satellites ont **zero workflow** lie au vault. Plus simple a maintenir que N workflows push-based.
- **2 PATs distincts** : `GERBER_VAULT_HUB` (Contents:RW gerber-vault seul) pour les writes, `GERBER_VAULT_SPOKE` (Contents:R all repos) pour les pulls. Least-privilege explicite.
- **Push via PAT pour chainer workflows** : `GITHUB_TOKEN` natif ne declenche PAS d'autres workflows (safety GHA contre les loops). Pour chainer pull-sources → sync-rag, le commit doit etre fait avec un PAT custom (`GERBER_VAULT_HUB`).
- **Idempotence par regex YAML** : pour modifier `sources.yml` via GitHub Contents API, l'idempotence se fait par regex sur ligne `^- repo: owner/name$` exacte. Pas besoin de parser YAML cote MCP (zero dep).
- **MCP > script local** : le tool MCP marche partout (Claude.ai, Desktop, mobile, Code), un script bash local ne marche que sur Code avec env vars configurees. Single source of truth = tool MCP.

## Structured logging (Streamable HTTP)

- Logs vers stdout, captures par le TUI admin (Rust)
- Prefixes colores : `-->` (request), `  <--` (result), `+`/`-` (session lifecycle), `!!` (auth failure)
- Timing sur les tool_call (elapsed en secondes)
- Session counter (active sessions)
