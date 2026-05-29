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


## Pre-merge Checklist

- [ ] `pnpm typecheck` passes
- [ ] `npx wrangler deploy --dry-run` (côté packages/worker) ne plante pas ⚠️ ne valide pas les bindings KV/DO
- [ ] Smoke test : `curl https://gerber.romain-ecarnot.com/health` retourne `{"ok":true}`
