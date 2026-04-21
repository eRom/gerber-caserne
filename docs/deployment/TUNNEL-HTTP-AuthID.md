# Tunnel Cloudflare + Auth — Pense-bête

Comment gerber est exposé sur internet et comment les deux clients distants
(Managed Agents + claude.ai) s'authentifient.

## Vue d'ensemble

```
                             ┌──────────────────────────────────┐
                             │   https://gerber.romain-ecarnot.com
                             │   (named tunnel Cloudflare)
                             └───────────────┬──────────────────┘
                                             │
                                             ▼
                             ┌──────────────────────────────────┐
                             │   http://localhost:4000           │
                             │   (MCP server, process local)    │
                             └──────────────────────────────────┘
```

Le tunnel est un **named tunnel Cloudflare** (config `~/.cloudflared/config.yml`,
tunnel ID `b97eaa24-...`). L'URL publique est gravée dans la credential Vault
Anthropic (immuable) — jamais de quick tunnel, jamais d'URL qui change.

## Deux modes d'auth sur `/mcp/stream`

### Mode A — Managed Agents Anthropic (Vault static_bearer)

Utilisé par les agents Managed créés côté Anthropic avec `type: "url"` dans
`mcp_servers`. La credential Vault stocke un Bearer statique.

- Le Bearer = le `streamToken` persisté dans `~/.config/gerber/config.json`
- Si tu le rotates (`pnpm mcp:token --rotate`), **tu dois re-saisir** la
  nouvelle valeur dans la credential Vault

### Mode B — claude.ai custom connector (OAuth 2.1 + PKCE)

Utilisé par l'UI claude.ai (web + desktop) via Paramètres → Connecteurs.

- Flow : `401 /mcp/stream` → `WWW-Authenticate: resource_metadata=...`
  → discovery → `/authorize` → `/token` → rejeu `/mcp/stream` avec Bearer
- Le Bearer renvoyé par `/token` est **le même `streamToken`** que pour le
  Mode A — les deux modes coexistent sans conflit
- Client OAuth **pré-enregistré** dans `~/.config/gerber/config.json`
  (`oauthClientId`, `oauthClientSecret`) — **pas de Dynamic Client
  Registration**. Tu paste ces deux valeurs dans l'UI claude.ai la première
  fois
- Pas de consent UI : `/authorize` redirige immédiatement vers
  `https://claude.ai/api/mcp/auth_callback` (single-user server)

Endpoints exposés en Mode B :

| Endpoint | Rôle |
|---|---|
| `GET /.well-known/oauth-authorization-server` | RFC 8414 AS metadata |
| `GET /.well-known/oauth-protected-resource` | RFC 9728 PRM metadata |
| `GET /authorize` | Authorization endpoint (redirect immédiat) |
| `POST /token` | Token endpoint (échange code → Bearer) |

## Activation du Mode B

Variable d'env **ou** config.json :

```bash
# Option 1 : env var (à ajouter au shell qui lance le MCP)
export GERBER_PUBLIC_URL=https://gerber.romain-ecarnot.com

# Option 2 : persister dans ~/.config/gerber/config.json
pnpm mcp:set-url https://gerber.romain-ecarnot.com
```

Sans `GERBER_PUBLIC_URL` / `publicUrl` défini, les routes OAuth **ne sont pas
montées** et seul le Mode A fonctionne. C'est voulu : pas de surface d'attaque
OAuth si tu ne veux pas de claude.ai.

Récupérer les credentials :

```bash
pnpm mcp:token
# → affiche streamToken + clientId + clientSecret + URL
```

## Config Cloudflared — GOTCHA MAJEUR

```yaml
tunnel: b97eaa24-33a7-4948-8bf8-1dbe7efb69fa
credentials-file: /Users/recarnot/.cloudflared/b97eaa24-...json

ingress:
  - hostname: gerber.romain-ecarnot.com
    path: ^/mcp/stream$
    service: http://localhost:4000
  - hostname: gerber.romain-ecarnot.com
    path: ^/authorize$
    service: http://localhost:4000
  - hostname: gerber.romain-ecarnot.com
    path: ^/token$
    service: http://localhost:4000
  - hostname: gerber.romain-ecarnot.com
    path: ^/\.well-known/oauth-(authorization-server|protected-resource)(/.*)?$
    service: http://localhost:4000
  - service: http_status:404
```

**Pourquoi path-scoped et pas `path: /`** : on ne veut PAS exposer `/mcp`
(JSON-RPC bridge pour l'UI locale, **sans auth**), ni `/` (SPA UI), ni
`/health`. Seuls les paths gated par Bearer ou les métadonnées publiques OAuth
passent.

⚠️ Si tu ajoutes un nouvel endpoint MCP distant (ex. nouveau chemin OAuth),
**mets à jour l'ingress cloudflared** — sinon 404 silencieux via le tunnel,
alors que l'origin répond bien en local.

## Commandes utiles

```bash
# Credentials + URL
pnpm mcp:token                  # affiche tout
pnpm mcp:token --rotate         # régénère streamToken
pnpm mcp:token --rotate-oauth   # régénère clientId/clientSecret
pnpm mcp:set-url <url>          # persiste publicUrl

# Tunnel
cloudflared tunnel ingress validate   # check config
cloudflared tunnel run gerber         # run manuellement (la TUI gère normalement)
```

## Debug

1. **Vérifier que le MCP local expose bien les routes OAuth** :
   ```bash
   curl -s http://127.0.0.1:4000/.well-known/oauth-authorization-server
   curl -s http://127.0.0.1:4000/.well-known/oauth-protected-resource
   ```
   Si 404 → `GERBER_PUBLIC_URL` pas vu au démarrage → re-set + restart.

2. **Vérifier que le tunnel les propage** :
   ```bash
   curl -s https://gerber.romain-ecarnot.com/.well-known/oauth-authorization-server
   ```
   Si 404 → ingress cloudflared mal configuré.

3. **Vérifier le trigger 401** :
   ```bash
   curl -si -X POST https://gerber.romain-ecarnot.com/mcp/stream \
     -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"initialize"}'
   ```
   Le header `www-authenticate: Bearer realm="mcp", ..., resource_metadata="..."`
   est **obligatoire** pour que claude.ai déclenche le flow OAuth.

## Fichiers à connaître

| Path | Rôle |
|---|---|
| `packages/mcp/src/http/server.ts` | Mount conditionnel `mcpAuthRouter` + CORS |
| `packages/mcp/src/http/oauth-provider.ts` | `SingleUserOAuthProvider` (pas de DCR, pas de consent) |
| `packages/mcp/src/http/streamable.ts` | 401 avec `WWW-Authenticate` + `resource_metadata` |
| `packages/mcp/src/config/user-config.ts` | Persistence `~/.config/gerber/config.json` |
| `~/.cloudflared/config.yml` | Ingress rules path-scoped |
