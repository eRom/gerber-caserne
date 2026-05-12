# P-0 : Préparation MCP pour Docker / VPS — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Préparer le code MCP `gerber-caserne` pour un déploiement Docker sur VPS Hostinger. Ajout du Dockerfile multi-stage, compose.yml Traefik-compatible, refactor `config/user-config.ts` (env vars first), enrichissement `/health` (SQLite ping), env var `GERBER_DATA_DIR`, script `prefetch-model.js`, workflow GHA `release.yml`.

**Architecture:** Toutes les modifs sont rétro-compatibles (les defaults existants — `~/.agent-brain/brain.db`, `~/.config/gerber/config.json` — restent fonctionnels en local). Les env vars `GERBER_*` deviennent prioritaires quand présentes, ce qui permet au container Docker de fonctionner sans toucher au filesystem utilisateur.

**Tech Stack:** Docker multi-stage (node:22-bookworm-slim), Express 5, better-sqlite3, transformers.js E5, Traefik v3 labels, GitHub Actions (GHCR + repository_dispatch).

**Spec source:** `docs/superpowers/specs/2026-05-12-gerber-plugin-vps-migration-design.md` §5, §7, §11 P0.

**Critère de succès final:** `docker build -f Dockerfile -t gerber-caserne:test .` réussit localement, `docker run` démarre le container, `curl http://localhost:3000/health` retourne `{"ok":true,...}`.

---

## File Structure (créations / modifications)

| Fichier | Action |
|---------|--------|
| `packages/mcp/src/config/user-config.ts` | MODIFY — env vars first |
| `packages/mcp/src/http/server.ts` | MODIFY — enrichir `/health` avec SQLite ping |
| `packages/mcp/src/index.ts` | MODIFY — support env var `GERBER_DATA_DIR` |
| `packages/mcp/src/scripts/prefetch-model.ts` | CREATE — DL E5 au build |
| `packages/mcp/tsup.config.ts` | MODIFY — ajouter entry `prefetch-model.ts` |
| `Dockerfile` (racine) | CREATE — multi-stage build |
| `.dockerignore` (racine) | CREATE |
| `deploy-vps/compose.yml` | CREATE — service + labels Traefik |
| `deploy-vps/.gitkeep` | CREATE (si compose.yml est seul fichier) |
| `.github/workflows/release.yml` | CREATE — build GHCR + dispatch |

**Aucun fichier supprimé.** Tous les defaults locaux préservés.

---

## Pré-requis

- Working tree clean sur `main` (P-1 mergée et pushée).
- Docker Desktop running (`docker info` doit répondre).
- Branche P-0 à créer : `feat/p0-docker-preparation`.

---

### Task 1 : Préparation — branche P-0

- [ ] **Step 1 : Working tree clean + sur main**

```bash
cd /Users/recarnot/dev/gerber-caserne
git status
git checkout main
git pull origin main
```
Expected : `clean` et à jour avec origin.

- [ ] **Step 2 : Créer branche**

```bash
git checkout -b feat/p0-docker-preparation
```

---

### Task 2 : Refactor `config/user-config.ts` — env vars first

**File:** `packages/mcp/src/config/user-config.ts`

**Goal:** Ajouter une priorité env vars sur 3 valeurs (`streamToken`, `oauthClient`, `publicUrl`). Le fichier reste fallback.

- [ ] **Step 1 : Lire le fichier actuel** (déjà fait — connaître la structure).

- [ ] **Step 2 : Ajouter helper interne `readEnv`**

Ajouter en haut du fichier, après les imports :

```ts
function readEnv(key: string): string | undefined {
  const v = process.env[key];
  return v && v.length > 0 ? v : undefined;
}
```

- [ ] **Step 3 : Modifier `getStreamToken()`**

Remplacer le corps de la fonction par :

```ts
export function getStreamToken(): string {
  const env = readEnv('GERBER_BEARER_TOKEN');
  if (env) return env;
  const cfg = readConfig();
  if (cfg.streamToken && cfg.streamToken.length > 0) return cfg.streamToken;
  const token = randomBytes(32).toString('hex');
  writeConfig({ ...cfg, streamToken: token });
  return token;
}
```

- [ ] **Step 4 : Modifier `getOAuthClient()`**

Remplacer le corps de la fonction par (en gardant la signature et la JSDoc) :

```ts
export function getOAuthClient(): OAuthClient {
  const envId = readEnv('GERBER_OAUTH_CLIENT_ID');
  const envSecret = readEnv('GERBER_OAUTH_CLIENT_SECRET');
  if (envId && envSecret) {
    return { clientId: envId, clientSecret: envSecret };
  }
  const cfg = readConfig();
  if (cfg.oauthClientId && cfg.oauthClientSecret) {
    return { clientId: cfg.oauthClientId, clientSecret: cfg.oauthClientSecret };
  }
  const clientId = `gerber-${randomBytes(8).toString('hex')}`;
  const clientSecret = randomBytes(32).toString('hex');
  writeConfig({ ...cfg, oauthClientId: clientId, oauthClientSecret: clientSecret });
  return { clientId, clientSecret };
}
```

- [ ] **Step 5 : Vérifier `getPublicUrl()`**

Cette fonction lit déjà `GERBER_PUBLIC_URL` en priorité d'après le commentaire. Confirmer dans le code et corriger si nécessaire. Si elle ne lit pas l'env :

```ts
export function getPublicUrl(): string | undefined {
  const env = readEnv('GERBER_PUBLIC_URL');
  if (env) return env;
  return readConfig().publicUrl;
}
```

- [ ] **Step 6 : Tests**

Ajouter dans `packages/mcp/src/tests/config/user-config.test.ts` (créer si absent) :

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getStreamToken, getOAuthClient, getPublicUrl } from '../../config/user-config.js';

describe('user-config env vars priority', () => {
  beforeEach(() => {
    delete process.env.GERBER_BEARER_TOKEN;
    delete process.env.GERBER_OAUTH_CLIENT_ID;
    delete process.env.GERBER_OAUTH_CLIENT_SECRET;
    delete process.env.GERBER_PUBLIC_URL;
  });

  it('getStreamToken reads GERBER_BEARER_TOKEN when set', () => {
    process.env.GERBER_BEARER_TOKEN = 'env-token-xyz';
    expect(getStreamToken()).toBe('env-token-xyz');
  });

  it('getOAuthClient reads env vars when both set', () => {
    process.env.GERBER_OAUTH_CLIENT_ID = 'env-id';
    process.env.GERBER_OAUTH_CLIENT_SECRET = 'env-secret';
    const c = getOAuthClient();
    expect(c.clientId).toBe('env-id');
    expect(c.clientSecret).toBe('env-secret');
  });

  it('getPublicUrl reads GERBER_PUBLIC_URL when set', () => {
    process.env.GERBER_PUBLIC_URL = 'https://test.example.com';
    expect(getPublicUrl()).toBe('https://test.example.com');
  });
});
```

- [ ] **Step 7 : Run tests**

```bash
pnpm --filter @gerber-caserne/mcp test src/tests/config/user-config.test.ts
```
Expected : tests passent.

- [ ] **Step 8 : Pas de commit** (commit groupé en Task 9).

---

### Task 3 : Enrichir endpoint `/health` (SQLite ping + ok flag)

**File:** `packages/mcp/src/http/server.ts`

**Goal:** Ajouter un `SELECT 1` SQLite pour vérifier que la DB répond. Garder rétro-compatibilité avec le `/health` existant.

- [ ] **Step 1 : Modifier le handler `/health`**

Remplacer le bloc existant :
```ts
app.get("/health", (_req, res) => {
  res.json({ embedderReady, dbPath: db.name, update: "Manuel" });
});
```

Par :
```ts
app.get("/health", (_req, res) => {
  try {
    db.prepare('SELECT 1 AS ok').get();
    res.json({ ok: true, embedderReady, dbPath: db.name });
  } catch (err) {
    res.status(503).json({ ok: false, embedderReady, error: (err as Error).message });
  }
});
```

- [ ] **Step 2 : Mettre à jour le test existant**

Lire `packages/mcp/src/tests/http/health.test.ts` et adapter pour vérifier `ok: true` au lieu de l'ancienne structure. Si test existant lit `update: "Manuel"`, le retirer.

- [ ] **Step 3 : Run tests**

```bash
pnpm --filter @gerber-caserne/mcp test src/tests/http/health.test.ts
```
Expected : tests passent.

- [ ] **Step 4 : Pas de commit**.

---

### Task 4 : Env var `GERBER_DATA_DIR` dans `index.ts`

**File:** `packages/mcp/src/index.ts`

**Goal:** Permettre au container de spécifier le data dir via env var (ex. `/data`), sans casser le default local `~/.agent-brain/`.

- [ ] **Step 1 : Modifier la résolution `dbPath`**

Remplacer la ligne :
```ts
const dbPath = dbFlag >= 0 ? argv[dbFlag + 1]! : resolve(homedir(), '.agent-brain', 'brain.db');
```

Par :
```ts
const dataDir = process.env.GERBER_DATA_DIR;
const defaultDbPath = dataDir
  ? resolve(dataDir, 'brain.db')
  : resolve(homedir(), '.agent-brain', 'brain.db');
const dbPath = dbFlag >= 0 ? argv[dbFlag + 1]! : defaultDbPath;
```

**Précédence :** `--db-path` CLI flag > `GERBER_DATA_DIR` env > default `~/.agent-brain/brain.db`.

- [ ] **Step 2 : Pas de test dédié** (logique trivial, couverte par le smoke test container plus tard).

- [ ] **Step 3 : Pas de commit**.

---

### Task 5 : Script `prefetch-model.ts` (DL E5 au build)

**File:** `packages/mcp/src/scripts/prefetch-model.ts` (NOUVEAU)

**Goal:** Au moment du `docker build`, ce script télécharge le modèle E5 dans `~/.cache/huggingface/` pour qu'il soit embarqué dans l'image runtime.

- [ ] **Step 1 : Créer le fichier**

```ts
#!/usr/bin/env node
/**
 * Pre-fetch the E5 embedding model into HuggingFace cache.
 * Run at Docker build time so the resulting image is self-contained
 * and doesn't need network access at boot.
 */
import { pipeline } from '@huggingface/transformers';

async function main() {
  console.log('Pre-fetching E5 model (intfloat/multilingual-e5-small)...');
  // The model ID must match what the runtime code uses.
  // @ts-expect-error pipeline returns a loose union
  await pipeline('feature-extraction', 'intfloat/multilingual-e5-small', {
    quantized: true,
  });
  console.log('E5 model cached.');
}

main().catch((err) => {
  console.error('prefetch-model failed:', err);
  process.exit(1);
});
```

**Important :** vérifier le model ID actuel utilisé par le pipeline existant dans `packages/mcp/src/embeddings/pipeline.ts`. Adapter si différent.

- [ ] **Step 2 : Ajouter au build tsup**

Modifier `packages/mcp/tsup.config.ts`, ajouter `'src/scripts/prefetch-model.ts'` au tableau `entry` :

```ts
entry: [
  'src/index.ts',
  'src/scripts/restore.ts',
  'src/scripts/reindex.ts',
  'src/scripts/print-token.ts',
  'src/scripts/set-public-url.ts',
  'src/scripts/prefetch-model.ts',  // NEW
],
```

- [ ] **Step 3 : Build local test**

```bash
pnpm --filter @gerber-caserne/mcp build
ls packages/mcp/dist/scripts/prefetch-model.js
```
Expected : fichier généré.

- [ ] **Step 4 : Run script local (optionnel, lent : ~30s premier coup)**

```bash
node packages/mcp/dist/scripts/prefetch-model.js
```
Expected : DL réussit, retourne `E5 model cached.`. Le cache vit dans `~/.cache/huggingface/`.

Si ça échoue (rate limit HF, réseau), ne pas bloquer — le Docker build retentera.

- [ ] **Step 5 : Pas de commit**.

---

### Task 6 : Dockerfile multi-stage

**File:** `Dockerfile` (racine) — NOUVEAU

- [ ] **Step 1 : Créer le Dockerfile**

```dockerfile
# syntax=docker/dockerfile:1.7

# ─── Stage 1: build ─────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS build

# pnpm via corepack
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

# System deps for better-sqlite3 native build
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Workspace manifests first (better layer caching)
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/mcp/package.json packages/mcp/

# Install only mcp + shared (skip ui/tui/admin — not needed in container)
RUN pnpm install --frozen-lockfile --filter @gerber-caserne/mcp...

# Copy source for mcp + shared
COPY packages/shared packages/shared
COPY packages/mcp packages/mcp

# Build mcp
RUN pnpm --filter @gerber-caserne/mcp build

# Pre-fetch E5 model into HF cache
RUN node packages/mcp/dist/scripts/prefetch-model.js

# ─── Stage 2: runtime ──────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runtime

# Non-root user (matches host UID 1000 from compose volume chown)
RUN useradd -u 1000 -m -s /bin/bash gerber

# pnpm not needed at runtime (we already built); but better-sqlite3 needs
# nothing extra — it's a static .node binary.

WORKDIR /app

# Copy node_modules (workspace-resolved), built artifacts, HF cache
COPY --from=build --chown=gerber:gerber /app/node_modules ./node_modules
COPY --from=build --chown=gerber:gerber /app/packages/shared ./packages/shared
COPY --from=build --chown=gerber:gerber /app/packages/mcp/dist ./packages/mcp/dist
COPY --from=build --chown=gerber:gerber /app/packages/mcp/package.json ./packages/mcp/
COPY --from=build --chown=gerber:gerber /root/.cache/huggingface /home/gerber/.cache/huggingface

# Data volume mount point (must be writable by gerber user)
RUN mkdir -p /data && chown gerber:gerber /data
VOLUME /data

USER gerber
ENV NODE_ENV=production
ENV GERBER_DATA_DIR=/data
ENV PORT=3000
ENV HOME=/home/gerber

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Run with --ui --stream (HTTP server with both legacy /mcp + /mcp/stream)
CMD ["node", "packages/mcp/dist/index.js", "--ui", "--stream"]
```

- [ ] **Step 2 : Créer `.dockerignore`** (racine) — NOUVEAU :

```
node_modules
**/node_modules
**/dist
.git
.github
.cave
.claude
.claude-plugin
docs
skills
agents
hooks
*.log
.env*
__MACOSX
.DS_Store
*.bak-*
```

- [ ] **Step 3 : Build local**

```bash
docker build -f Dockerfile -t gerber-caserne:test . 2>&1 | tail -20
```
Expected : build réussit, image taggée `gerber-caserne:test`. Premier build long (~3-5 min : install pnpm, DL E5).

Si erreur sur `better-sqlite3 not built`, ajouter à Stage 1 :
```dockerfile
RUN cd node_modules/better-sqlite3 && pnpm rebuild
```
(Mais normalement le `pnpm install --frozen-lockfile` gère ça via les scripts post-install. Si on a installé avec `--ignore-scripts` localement, NE PAS reproduire dans Docker — laisser les scripts s'exécuter.)

- [ ] **Step 4 : Run container smoke test**

```bash
# Créer un volume temporaire avec une DB vide (test minimal)
mkdir -p /tmp/gerber-docker-test
docker run --rm -d --name gerber-smoke \
  -p 3000:3000 \
  -v /tmp/gerber-docker-test:/data \
  -e GERBER_BEARER_TOKEN=test-token-xyz \
  -e GERBER_OAUTH_CLIENT_ID=test-id \
  -e GERBER_OAUTH_CLIENT_SECRET=test-secret \
  -e GERBER_PUBLIC_URL=https://test.local \
  gerber-caserne:test

sleep 5  # bootstrap

curl -sS http://localhost:3000/health | jq
# Expected: {"ok":true,"embedderReady":false|true,"dbPath":"/data/brain.db"}

curl -sS -H 'Authorization: Bearer test-token-xyz' \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' \
  http://localhost:3000/mcp/stream | head -50
# Expected: JSON-RPC response with serverInfo: gerber

docker logs gerber-smoke 2>&1 | tail -20
docker stop gerber-smoke
```

Expected : `/health` répond `{"ok":true,...}`, `/mcp/stream` répond à `initialize`.

- [ ] **Step 5 : Pas de commit ici** (commit en Task 9).

---

### Task 7 : `deploy-vps/compose.yml` (Traefik labels)

**File:** `deploy-vps/compose.yml` — NOUVEAU

- [ ] **Step 1 : Créer le fichier**

```yaml
services:
  gerber-mcp:
    image: ghcr.io/erom/gerber-caserne:${TAG}
    container_name: gerber-mcp
    restart: unless-stopped
    environment:
      GERBER_DATA_DIR: /data
      GERBER_PUBLIC_URL: https://gerber.mcp.romain-ecarnot.com
      GERBER_BEARER_TOKEN: ${GERBER_BEARER_TOKEN}
      GERBER_OAUTH_CLIENT_ID: ${GERBER_OAUTH_CLIENT_ID}
      GERBER_OAUTH_CLIENT_SECRET: ${GERBER_OAUTH_CLIENT_SECRET}
      PORT: "3000"
    volumes:
      - /opt/gerber/data:/data
    networks:
      - traefik-public
    labels:
      - "traefik.enable=true"
      - "traefik.docker.network=traefik-public"
      - "traefik.http.routers.gerber.rule=Host(`gerber.mcp.romain-ecarnot.com`)"
      - "traefik.http.routers.gerber.entrypoints=websecure"
      - "traefik.http.routers.gerber.tls.certresolver=acme-cloudflare"
      - "traefik.http.routers.gerber.tls.domains[0].main=*.mcp.romain-ecarnot.com"
      - "traefik.http.routers.gerber.middlewares=security-headers@file"
      - "traefik.http.services.gerber.loadbalancer.server.port=3000"

networks:
  traefik-public:
    external: true
```

- [ ] **Step 2 : Pas de test local possible** (compose dépend du réseau `traefik-public` qui n'existe que sur le VPS). Validation en P1.

- [ ] **Step 3 : Pas de commit**.

---

### Task 8 : Workflow GHA `release.yml`

**File:** `.github/workflows/release.yml` — NOUVEAU

- [ ] **Step 1 : Créer le workflow**

```yaml
name: Release gerber-caserne

on:
  push:
    tags:
      - 'gerber-v*'

permissions:
  contents: read
  packages: write

jobs:
  build:
    runs-on: ubuntu-latest
    outputs:
      tag: ${{ steps.meta.outputs.tag }}
      sha: ${{ github.sha }}
    steps:
      - uses: actions/checkout@v4

      - name: Tag metadata
        id: meta
        run: |
          TAG="${GITHUB_REF#refs/tags/}"
          echo "tag=$TAG" >> $GITHUB_OUTPUT
          echo "image=ghcr.io/${{ github.repository_owner }}/gerber-caserne:$TAG" >> $GITHUB_OUTPUT
          echo "image_latest=ghcr.io/${{ github.repository_owner }}/gerber-caserne:latest" >> $GITHUB_OUTPUT

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.repository_owner }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build & push
        uses: docker/build-push-action@v6
        with:
          context: .
          file: ./Dockerfile
          platforms: linux/amd64
          push: true
          tags: |
            ${{ steps.meta.outputs.image }}
            ${{ steps.meta.outputs.image_latest }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  dispatch:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Notify vps-docker-manager-prod
        env:
          INFRA_PAT: ${{ secrets.INFRA_DISPATCH_PAT }}
        run: |
          curl -fsS -X POST \
            -H "Authorization: Bearer $INFRA_PAT" \
            -H "Accept: application/vnd.github+json" \
            -H "X-GitHub-Api-Version: 2022-11-28" \
            https://api.github.com/repos/eRom/vps-docker-manager-prod/dispatches \
            -d '{"event_type":"deploy-gerber","client_payload":{"tag":"${{ needs.build.outputs.tag }}","sha":"${{ needs.build.outputs.sha }}"}}'
```

- [ ] **Step 2 : Pas de test local** (validation au premier tag en P1).

- [ ] **Step 3 : Pas de commit**.

**Note** : le secret `INFRA_DISPATCH_PAT` doit être configuré côté repo GitHub `eRom/gerber-caserne` avant le premier tag. À noter pour P1.

---

### Task 9 : Verify + commit + push

- [ ] **Step 1 : Run full check local**

```bash
pnpm --filter @gerber-caserne/mcp test 2>&1 | tail -5
pnpm --filter @gerber-caserne/mcp build 2>&1 | tail -5
docker build -f Dockerfile -t gerber-caserne:test . 2>&1 | tail -5
```
Expected : tous passent.

- [ ] **Step 2 : Status pre-commit**

```bash
git status
git diff --stat
```
Expected : ~7-9 fichiers modifiés/créés.

- [ ] **Step 3 : Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat(p0): docker / VPS preparation for gerber-caserne

- Refactor config/user-config.ts: env vars first (GERBER_BEARER_TOKEN,
  GERBER_OAUTH_CLIENT_ID/SECRET, GERBER_PUBLIC_URL), file fallback
- Enrich /health endpoint with SQLite SELECT 1 ping + ok flag
- Add GERBER_DATA_DIR env var support in index.ts (CLI flag > env > default)
- New script src/scripts/prefetch-model.ts: pre-fetch E5 at docker build
- Dockerfile (multi-stage node:22-bookworm-slim, non-root user, healthcheck)
- .dockerignore
- deploy-vps/compose.yml (Traefik labels, *.mcp.romain-ecarnot.com router)
- .github/workflows/release.yml (gerber-v* tag → GHCR push → dispatch
  vps-docker-manager-prod)

Backward-compatible: all existing local behavior preserved (defaults
unchanged when env vars unset). New tests cover env var precedence.

Spec: docs/superpowers/specs/2026-05-12-gerber-plugin-vps-migration-design.md §5,§7,§11 P0
Plan: docs/superpowers/plans/2026-05-12-p-0-mcp-docker-preparation.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 4 : Merge main + push**

```bash
git checkout main
git merge --ff-only feat/p0-docker-preparation
git push origin main
git branch -d feat/p0-docker-preparation
```

- [ ] **Step 5 : Validation finale**

```bash
git log --oneline -3
pnpm --filter @gerber-caserne/mcp test 2>&1 | tail -3
```
Expected : commit visible, tests passent.

---

## Post-plan checklist

- [ ] `pnpm --filter @gerber-caserne/mcp test` passe
- [ ] `pnpm --filter @gerber-caserne/mcp build` passe
- [ ] `docker build` réussit
- [ ] `docker run` démarre, `/health` répond `{"ok":true,...}`
- [ ] `/mcp/stream` accepte un `initialize` avec bearer
- [ ] Branche `feat/p0-docker-preparation` mergée et supprimée
- [ ] Commit unique sur `main`, pushé

**Suivant** : P1 (Infra VPS — DNS Cloudflare, secret sops, deploy-state, première deploy test sur VPS).

---

## Risques résiduels

| Risque | Détection | Mitigation |
|--------|-----------|------------|
| `better-sqlite3` natif échoue à build dans Docker (Debian glibc vs build env) | `docker build` fail Stage 1 | Garder `node:22-bookworm-slim` partout, installer `python3 build-essential` en Stage 1 |
| Model E5 ID différent dans `pipeline.ts` vs `prefetch-model.ts` | Build OK mais runtime download | Lire `embeddings/pipeline.ts` et copier exact le model ID |
| `sharp` (UI) tente de build dans Dockerfile | Build fail Stage 1 | On filter `@gerber-caserne/mcp...` qui ne tire pas UI |
| HF download rate-limited au build | `prefetch-model.js` fail | Retry build, ou commenter temporairement la step `RUN node ... prefetch-model.js` et accepter cold-start |
| `pnpm install --frozen-lockfile` Docker ≠ local (lockfile drift) | Build fail Stage 1 | `pnpm install --no-frozen-lockfile` en fallback, commit le lockfile à jour |
