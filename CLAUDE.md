# CLAUDE.md — gerber-caserne

## Messages bus

- **Workspace** : gerber-bus (`wsppp5gjPEmmS5qL9`)
- **Base** : bus (`appnSsuI4s3PjHqJg`)
- **Table** : Messages (`tblrTrs0RAH6MkJ2h`)
- **Fields** :
  - `title` (primary) : `fldGH4oVJgied1rZm`
  - `project` : `fldTOGX0IIajBdXa8`
  - `importance` (🟢 low / 🟠 medium / 🔴 high) : `fldPP2ozFl8HQPqRE`
  - `content` : `fld0hGeNFXq2KrpDv`
  - `status` (Pending / Done) : `fldROhGQVvAhhMJDZ`

## Project Structure

Monorepo with pnpm workspaces:
- `packages/shared/` — Pure TypeScript, no native deps. Zod helpers only (entity schemas dropped via migrations 0006-0011).
- `packages/mcp/` — MCP server (Express 5, OAuth single-user). Stateless after migration 0011 : the only surviving SQLite table is `_migrations` (migration journal). Only 2 tools left : `rag`, `rag_onboard`.

Knowledge memory lives in the **Gemini vault RAG** (`eRom/gerber-vault`), reached via the `rag` MCP tool. All other entities migrated out :
- tasks/issues/handoffs → Linear
- messages bus → Airtable

## Key Commands

```bash
pnpm install              # Install deps
pnpm build                # Build MCP package
pnpm test                 # Run all tests
pnpm typecheck            # Type-check
pnpm mcp:token             # Print the Streamable HTTP bearer token + OAuth client creds
pnpm mcp:set-url <url>     # Persist public HTTPS URL (OAuth issuer + claude.ai)
```

## Gotchas

| # | Gotcha | Where |
|---|--------|-------|
| 1 | Express 5 requires `await import()` — no require() | `http/server.ts` |
| 2 | Pragma order matters: WAL first, then busy_timeout | `db/index.ts` |
| 3 | `busy_timeout = 5000` prevents SQLITE_BUSY on concurrent access | `db/index.ts` |
| 4 | `/mcp/stream` is the only HTTP transport. The legacy `/mcp` JSON-RPC bridge was removed with the UI — do not re-add a path that bypasses bearer/OAuth auth | `http/server.ts`, `http/streamable.ts` |
| 5 | L'URL du tunnel (ex. `gerber.romain-ecarnot.com`) est gravée dans la credential Vault Anthropic (`mcp_server_url` immutable). Jamais de quick tunnel — utiliser named tunnel Cloudflare / tailscale funnel / reserved domain | `README.md` (section Managed Agent) |
| 6 | Token Streamable persistant dans `~/.config/gerber/config.json` (mode 600, généré à la première exécution). Rotation via `pnpm mcp:token --rotate` | `config/user-config.ts` |
| 7 | OAuth pour claude.ai custom connector : activé uniquement si `GERBER_PUBLIC_URL` est set (env ou persisté via `pnpm mcp:set-url`). Single-user, pas de DCR, pas de consent UI. `clientId`/`clientSecret` persistés dans `config.json` et à coller dans l'UI claude.ai. Cf. `docs/deployment/TUNNEL-HTTP-AuthID.md` | `http/oauth-provider.ts`, `http/server.ts` |
| 8 | Tunnel cloudflared : ingress **path-scoped** — un `path: ^/mcp/stream$` ne route QUE cette route, tout le reste fait 404 via le tunnel (origin répond pourtant en local). Toute nouvelle route distante (OAuth, future tool) doit être ajoutée dans `~/.cloudflared/config.yml` | `~/.cloudflared/config.yml` |
| 9 | Migrations history (all destructive, no rollback) : 0006 drops notes/chunks/embeddings (→ Gemini vault), 0007 drops tasks/issues (→ Linear), 0008 drops handoffs (→ Linear), 0009 drops runbook (unused), 0010 drops messages (→ Airtable), 0011 drops projects (last business table). Surviving SQLite table : `_migrations` only | `db/migrations/` |
| 10 | The DB is now used only for the `_migrations` journal. `rag` / `rag_onboard` are stateless (Gemini + GitHub API). Keep the DB infrastructure (openDatabase + applyMigrations) so old client DBs apply the destructive migrations on next boot | `db/index.ts`, `db/migrate.ts` |

## Pre-merge Checklist

- [ ] `pnpm test` passes
- [ ] `pnpm typecheck` passes
- [ ] `pnpm build` succeeds

## Gerber

Ce projet est indexé dans **gerber** sous le slug `agent-brain`.
Slug cross-projet : `caserne` (design system, conventions, preferences personnelles). Pour les sujets design/UI, conventions, stack : chercher aussi dans `caserne`.

Toutes les entités métier ont migré hors du serveur MCP gerber :

- **Tasks et Issues** → Linear (workspace `eRom`, team `eRom-Agents`) depuis le 2026-05-17 (migration `0007_drop_tasks_issues.sql`). 109 entités migrées (range EAT-61 → EAT-169). Workflow Linear : `inbox → brainstorming → specification → plan → implementation → test → done` (mapping 1:1 avec l'ancien kanban gerber).

- **Handoffs** → Linear (projet `Handoffs`, label `handoff`) depuis le 2026-05-17 (migration `0008_drop_handoffs.sql`). Mapping : `inbox → Todo`, `done → Done`. Pas de migration de data (<50 entités, valeur faible). Pilote : EAT-170.

- **Messages bus** → Airtable (workspace `gerber-bus`, base `bus`, table `Messages`) depuis le 2026-05-18 (migration `0010_drop_messages.sql`). Schema simplifié (`title`, `project`, `importance`, `content`, `status`). Pas de migration de data. Voir la section `## Messages bus` en tête de ce fichier pour les IDs Airtable.

Il ne reste donc côté serveur MCP que **2 tools** : `rag` et `rag_onboard` (vault Gemini). Tous les autres tools (project_*, message_*, backup_brain, get_stats) ont été retirés par les migrations 0010 et 0011 le 2026-05-18. Prochain sujet : décider du sort de `rag` / `rag_onboard` pour pouvoir éteindre le serveur sur Hostinger.

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

**Ne lis PAS ces fichiers au démarrage.** Lis-les à la demande, uniquement quand la question de l'utilisateur touche au domaine concerné (ex: question archi → `architecture.md`, bug étrange → `gotchas.md`). Pour une question triviale ou sans rapport avec le projet lui-même, ne les lis pas du tout.

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
