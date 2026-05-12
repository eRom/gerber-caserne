# Gerber — Migration Plugin Claude Code + Hosting VPS

**Date** : 2026-05-12
**Auteur** : Romain Ecarnot (brainstorm avec Claude)
**Statut** : Spec validée, en attente du plan d'implémentation

---

## 1. Contexte & objectif

Aujourd'hui, **gerber** tourne sur le Mac de Romain via :
- Un serveur MCP local (`/Users/recarnot/dev/agent-brain`, monorepo pnpm) lancé par launchd
- Une DB SQLite locale (`~/.config/gerber/gerber.db` + WAL)
- Un tunnel cloudflared exposant `gerber.romain-ecarnot.com` pour claude.ai / Managed Agents
- Un plugin Claude Code `eRom/gerber-caserne` (v1.5.2, marketplace `erom-marketplace`) qui contient skills + agents + hooks **+ packages MCP source** (le repo source du plugin et le repo de dev du MCP sont en réalité le **même repo Git** synchronisé), **sans déclaration MCP** — le MCP est aujourd'hui configuré en dur dans `~/.claude.json` de chaque machine

> **Note de naming** — le dossier local s'appelle encore `agent-brain` (legacy) alors que le repo Git s'appelle déjà `gerber-caserne`. La migration unifie tous les noms internes vers `gerber-caserne` (cf. Phase P-1 §11).

**Friction** : installation manuelle pénible, dépendance au Mac allumé pour claude.ai/iOS, pas de "1-click install" pour de futurs clients de confiance.

**Cible** :
1. Plugin Claude Code installable en quelques commandes (`/plugin install gerber@erom-marketplace`)
2. Serveur centralisé sur le VPS Hostinger, accessible sur `https://gerber.mcp.romain-ecarnot.com/mcp/stream`
3. Web UI hébergée au même endroit en phase 2 (`https://gerber.mcp.romain-ecarnot.com/`)

**Audience** : strictement personnelle (single-user). Pas de DCR, pas de signup, pas de multi-tenant.

---

## 2. Décisions d'architecture clés

| # | Décision | Justification |
|---|----------|---------------|
| 1 | **Data residency 100 % VPS** | Décision Romain, simplifie l'accès depuis Mac / iOS / claude.ai. Trade-off : données privées sortent du Mac → mitigation par TLS + bearer + chiffrement age des backups |
| 2 | **Monolithe : 1 container Docker** `gerber-mcp` | YAGNI : single-user n'a pas besoin d'un split server/embedder. Pattern aligné avec buck/trinity |
| 3 | **Plugin = pur client déclaratif** (skills + `.mcp.json`) | Pas de code serveur côté plugin (contrairement à telegram). MCP remote via Streamable HTTP. Zéro dépendance npm/bun |
| 4 | **Wildcard ACME `*.mcp.romain-ecarnot.com`** | Sépare sémantiquement les MCP servers des web apps. Future-proof pour d'autres MCP |
| 5 | **Auth = bearer statique** côté plugin Claude Code | OAuth conservé en parallèle pour claude.ai custom connector (déjà en place). Bearer simple à provisionner via `gerber:onboarding` |
| 6 | **UI web sur même container** | Express sert `/`, `/mcp`, `/mcp/stream`, `/oauth/*`. 1 service, 1 domaine, 0 CORS |
| 7 | **Modèle E5 embarqué dans l'image Docker** | Cold-start instantané, indépendant de HuggingFace au boot |
| 8 | **Plugin existant `gerber-caserne` v1.5.2 → v2.0.0** | Bump major car ajout du `.mcp.json` change le contrat d'install (avant : config `~/.claude.json` manuelle ; après : `${GERBER_TOKEN}` + URL HTTPS) |
| 9 | **Rename interne `agent-brain` → `gerber-caserne`** | Le repo Git s'appelle déjà `gerber-caserne` ; on aligne dossier local, package racine, packages internes (`@agent-brain/*` → `@gerber-caserne/*`), image Docker, scripts pnpm. Cohérence avec le naming Git, suppression d'une dette historique |
| 10 | **PRÉSERVATION TOTALE de la DB existante** | Romain a >10 projets ingérés (notes, tasks, issues, embeddings). **JAMAIS de drop, JAMAIS de reset, JAMAIS de reindex destructif**. La migration est une copie 1:1 de la DB locale vers le VPS. Validation par comptage avant/après (cf. §8 et §11 P2) |

---

## 3. Architecture cible

```
┌─────────────────────────────────┐    HTTPS + Bearer    ┌──────────────────────────────────┐
│  Mac / iOS (Claude Code, CLI,   │ ────────────────────▶│  VPS Hostinger 72.62.239.98      │
│  Desktop, claude.ai)            │                       │                                  │
│                                 │ ◀─── MCP responses ──│  ┌──────────────────────────┐    │
│  Plugin gerber@erom-mp v2.0.0   │                       │  │ Traefik (existing)       │    │
│  ├─ .mcp.json → URL + Bearer    │                       │  │ *.mcp.romain-ecarnot.com │    │
│  ├─ 15 skills gerber:*          │                       │  │ + ACME Cloudflare DNS    │    │
│  ├─ 2 agents (status, vault)    │                       │  └────────────┬─────────────┘    │
│  └─ hooks                        │                       │               │ traefik-public  │
└─────────────────────────────────┘                       │  ┌────────────▼─────────────┐    │
                                                          │  │ gerber-mcp (Docker)      │    │
                                                          │  │  Express 5 +             │    │
                                                          │  │  - /mcp/stream (SHTTP)   │    │
                                                          │  │  - /mcp (JSON-RPC UI)    │    │
                                                          │  │  - / (UI statique p2)    │    │
                                                          │  │  - /oauth/* (single-user)│    │
                                                          │  │  - /healthz              │    │
                                                          │  │  + better-sqlite3 +      │    │
                                                          │  │    transformers.js E5    │    │
                                                          │  └────────────┬─────────────┘    │
                                                          │               │                  │
                                                          │  ┌────────────▼─────────────┐    │
                                                          │  │ Volume /opt/gerber/data/ │    │
                                                          │  │  gerber.db (+ WAL/SHM)   │    │
                                                          │  │  config/                 │    │
                                                          │  │  runs/ (logs runbook)    │    │
                                                          │  └──────────────────────────┘    │
                                                          │                                  │
                                                          │  Cron 03:15 → backup tar age     │
                                                          └──────────────────────────────────┘
```

**2 repos impliqués** (post Phase P-1) :
- `eRom/gerber-caserne` (anciennement local `agent-brain`, le nom Git était déjà `gerber-caserne`) — monorepo unifié contenant à la fois le code MCP (`packages/*`) et la distribution plugin (`.claude-plugin/`, `skills/`, `agents/`, `hooks/`, `.mcp.json`). Ajout `Dockerfile` + `deploy-vps/` + workflow GHA + bump v2.0.0.
- `eRom/vps-docker-manager-prod` (privé) — orchestration, ajout `apps/gerber/` + `secrets/gerber.enc.yaml`

---

## 4. Plugin Claude Code (`gerber-caserne` v2.0.0)

### 4.1 Structure du repo (cibles des changements en gras)

```
gerber-caserne/
├── .claude-plugin/
│   └── plugin.json              ← bump version 1.5.2 → 2.0.0
├── **.mcp.json**                ← NOUVEAU : déclaration MCP remote
├── skills/
│   ├── onboarding/              ← MODIFIÉE : gère ${GERBER_TOKEN}
│   ├── recall/                  ← inchangées
│   ├── capture/
│   ├── archive/
│   ├── session-complete/
│   ├── review/
│   ├── import/
│   ├── inbox/
│   ├── send/
│   ├── task/
│   ├── issue/
│   ├── vault/
│   ├── runbook/
│   ├── handoff/
│   └── status/
├── agents/
│   ├── agent-status.md
│   └── agent-vault.md
├── hooks/                       ← inchangés (conserver l'existant)
├── packages/                    ← question ouverte (cf §10)
├── docs/
├── README.md                    ← MODIFIÉ : nouveau quickstart
└── plugin.json
```

### 4.2 Contenu de `.mcp.json`

```json
{
  "mcpServers": {
    "gerber": {
      "type": "http",
      "url": "https://gerber.mcp.romain-ecarnot.com/mcp/stream",
      "headers": {
        "Authorization": "Bearer ${GERBER_TOKEN}"
      }
    }
  }
}
```

**Notes** :
- L'URL est en dur. Pas de raison de la rendre variable pour un usage single-user.
- `${GERBER_TOKEN}` interpolé par Claude Code depuis `~/.claude/settings.local.json` (section `env`) ou variable d'environnement shell.

### 4.3 Skill `gerber:onboarding` (modifiée)

Étapes additionnelles en tête du flow existant :

1. **Check token** : lire `process.env.GERBER_TOKEN`, fallback `~/.claude/settings.local.json`.
2. **Si absent** : prompter ("Colle ton bearer token gerber généré via `pnpm mcp:token` sur le VPS").
3. **Écrire** dans `~/.claude/settings.local.json` :
   ```json
   { "env": { "GERBER_TOKEN": "..." } }
   ```
4. **Valider connectivité** : un `curl -X POST https://gerber.mcp.romain-ecarnot.com/mcp/stream` avec un `initialize` JSON-RPC. Si 401, re-prompter le token. Si 200, OK.
5. **Continuer** le flow normal (init projet dans gerber + CLAUDE.md).

**Idempotence** : si token déjà set et connectivité OK, skip steps 1-4.

### 4.4 Distribution

Marketplace existant `erom-marketplace`. Install côté Claude Code (inchangé) :

```
/plugin marketplace add eRom/erom-marketplace      # déjà fait si déjà installé
/plugin install gerber@erom-marketplace            # ré-installe v2.0.0
/reload-plugins
/gerber:onboarding                                 # configure le token + le projet
```

---

## 5. Serveur Docker (`gerber-caserne`, packages/mcp)

> Tous les chemins et noms ci-dessous reflètent l'état **post P-1** (rename effectué). Avant P-1, lire `agent-brain` partout où c'est écrit `gerber-caserne` au niveau repo/packages.

### 5.1 Ajouts au repo

```
gerber-caserne/
├── **Dockerfile**               ← NOUVEAU : multi-stage build
├── **.dockerignore**             ← NOUVEAU
├── **deploy-vps/**               ← NOUVEAU dossier
│   ├── compose.yml              ← service gerber-mcp + labels Traefik
│   └── .gitkeep
├── **.github/workflows/**
│   └── **release.yml**          ← NOUVEAU : build GHCR + dispatch
└── packages/mcp/
    ├── src/
    │   └── config/user-config.ts ← MODIFIÉ : env vars first
    │   └── scripts/
    │       └── **prefetch-model.js** ← NOUVEAU : DL E5 au build
    │   └── http/
    │       └── server.ts        ← MODIFIÉ : endpoint /healthz
```

### 5.2 Dockerfile (esquisse)

```dockerfile
FROM node:22-bookworm-slim AS build
RUN corepack enable pnpm
WORKDIR /app
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/mcp/package.json packages/mcp/
RUN pnpm install --frozen-lockfile
COPY packages/shared packages/shared
COPY packages/mcp packages/mcp
RUN pnpm --filter @gerber-caserne/mcp build
RUN node packages/mcp/dist/scripts/prefetch-model.js

FROM node:22-bookworm-slim AS runtime
RUN corepack enable pnpm
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /root/.cache/huggingface /root/.cache/huggingface
ENV NODE_ENV=production
ENV GERBER_DATA_DIR=/data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/healthz || exit 1
CMD ["node", "packages/mcp/dist/index.js", "--ui", "--stream"]
```

**Points d'attention** :
- `better-sqlite3` compile natif → garder même glibc (bookworm-slim partout).
- Modèle E5 (~430 MB) embarqué dans `/root/.cache/huggingface` → cold-start instantané.
- `/data` est un volume — jamais dans l'image.

### 5.3 `deploy-vps/compose.yml`

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
    volumes:
      - /opt/gerber/data:/data
    networks:
      - traefik-public
    labels:
      - "traefik.enable=true"
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

### 5.4 Refactor `config/user-config.ts`

Aujourd'hui le code lit `~/.config/gerber/config.json` (bearer + OAuth client_id/secret). Sur le VPS, on veut **env vars en priorité**, fallback fichier.

```ts
// Pseudo-code
const bearer = process.env.GERBER_BEARER_TOKEN ?? readFromFile().bearer;
const oauthClient = {
  id: process.env.GERBER_OAUTH_CLIENT_ID ?? readFromFile().oauth?.id,
  secret: process.env.GERBER_OAUTH_CLIENT_SECRET ?? readFromFile().oauth?.secret,
};
```

Petit refactor, low-risk. Tests à ajouter pour les deux chemins.

### 5.5 Endpoint `/healthz`

```ts
app.get('/healthz', (_req, res) => {
  // SQLite ping + embedder ready check
  try {
    db.prepare('SELECT 1').get();
    res.json({ ok: true, embedder: embedderReady });
  } catch (e) {
    res.status(503).json({ ok: false });
  }
});
```

---

## 6. Infra VPS (`vps-docker-manager-prod`)

### 6.1 Fichiers à ajouter

```
vps-docker-manager-prod/
├── apps/
│   └── **gerber/**
│       └── deploy-state.yaml    ← NOUVEAU
├── secrets/
│   └── **gerber.enc.yaml**      ← NOUVEAU (sops chiffré)
├── scripts/
│   ├── **backup-gerber.sh**     ← NOUVEAU
│   └── **cf-dns.sh**            ← NOUVEAU (helper Cloudflare DNS API)
└── .github/workflows/
    └── deploy.yml               ← MODIFIÉ : ajouter `gerber` à la matrix
```

### 6.2 `apps/gerber/deploy-state.yaml`

```yaml
app: gerber
app_repo: eRom/gerber-caserne
tag: null
version: null
sha: null
deployed_at: null
deployed_by: null
```

### 6.3 `secrets/gerber.enc.yaml` (avant chiffrement sops)

```yaml
GERBER_BEARER_TOKEN: "<token long random — généré une fois>"
GERBER_OAUTH_CLIENT_ID: "gerber-claude-ai"
GERBER_OAUTH_CLIENT_SECRET: "<secret long random>"
```

### 6.4 DNS Cloudflare

`cloudflared` CLI ne gère pas les records DNS (uniquement les tunnels). On utilise l'API directement via le `CF_DNS_API_TOKEN` déjà existant. Script `scripts/cf-dns.sh` :

```bash
#!/usr/bin/env bash
set -euo pipefail
# Usage: cf-dns.sh add-record <name> <ip>
ZONE_ID="<id zone romain-ecarnot.com>"
curl -sS -X POST "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records" \
  -H "Authorization: Bearer ${CF_DNS_API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data "{\"type\":\"A\",\"name\":\"*.mcp\",\"content\":\"$2\",\"ttl\":1,\"proxied\":false}"
```

Action one-shot pour P1 :
```bash
./scripts/cf-dns.sh add-record '*.mcp' 72.62.239.98
```

Pas de proxy CF (proxied:false) — Traefik gère TLS directement via ACME DNS challenge.

### 6.5 Backups (`scripts/backup-gerber.sh`)

```bash
#!/usr/bin/env bash
set -euo pipefail
TS=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR=/opt/_infra/backups/gerber
mkdir -p "$BACKUP_DIR"

# SQLite cohérent via .backup (gère WAL proprement)
docker exec gerber-mcp sqlite3 /data/gerber.db ".backup '/data/.backup-${TS}.db'"
docker exec gerber-mcp tar -czf - -C /data ".backup-${TS}.db" config/ > "${BACKUP_DIR}/gerber-${TS}.tar.gz"
docker exec gerber-mcp rm "/data/.backup-${TS}.db"

# Chiffrement age + retention 14 jours
age -r "${AGE_RECIPIENT}" -o "${BACKUP_DIR}/gerber-${TS}.tar.gz.age" "${BACKUP_DIR}/gerber-${TS}.tar.gz"
rm "${BACKUP_DIR}/gerber-${TS}.tar.gz"
find "${BACKUP_DIR}" -name "gerber-*.tar.gz.age" -mtime +14 -delete
```

Cron à ajouter (`bootstrap-vps.sh` ou crontab manuelle) :
```
15 3 * * *  /opt/_infra/scripts/backup-gerber.sh
```

### 6.6 Modif `.github/workflows/deploy.yml`

Ajouter `gerber` à la liste des apps acceptées par le job de déploiement (matrix ou switch case selon implémentation actuelle).

---

## 7. Workflow CI/CD (`gerber-caserne`)

Nouveau fichier `.github/workflows/release.yml` (pattern buck reproduit) :

1. **Trigger** : push tag `gerber-v*`
2. **Job build** :
   - Checkout
   - QEMU + buildx (amd64 only — VPS x86_64)
   - Login GHCR
   - `docker build -f Dockerfile -t ghcr.io/erom/gerber-caserne:${TAG}`
   - Push
3. **Job dispatch** :
   - `gh api repos/eRom/vps-docker-manager-prod/dispatches` avec event `deploy-gerber`, payload `{ tag, sha }`

Secret GitHub requis côté `gerber-caserne` : `INFRA_DISPATCH_PAT` (PAT avec write sur `vps-docker-manager-prod`).

---

## 8. Migration des données existantes

> ⚠️ **PRÉSERVATION CRITIQUE** — Romain a >10 projets ingérés. La DB locale est la **source de vérité unique**. La séquence ci-dessous est une **copie 1:1**, pas un wipe-and-reindex.

**Pré-requis** : MCP local stoppé pour checkpoint WAL propre.

### 8.1 — Snapshot pré-migration (référence pour validation)

```bash
# Sur Mac, avant tout arrêt
sqlite3 ~/.config/gerber/gerber.db <<'SQL' > /tmp/gerber-pre-migration-counts.txt
SELECT 'projects', COUNT(*) FROM projects;
SELECT 'notes', COUNT(*) FROM notes;
SELECT 'tasks', COUNT(*) FROM tasks;
SELECT 'issues', COUNT(*) FROM issues;
SELECT 'messages', COUNT(*) FROM messages;
SELECT 'chunks', COUNT(*) FROM chunks;
SELECT 'embeddings_size', SUM(LENGTH(embedding)) FROM chunks WHERE embedding IS NOT NULL;
SQL
cat /tmp/gerber-pre-migration-counts.txt

# Backup ceinture-bretelles AVANT toute manipulation
cp -R ~/.config/gerber ~/.config/gerber.bak-pre-vps-migration-$(date +%Y%m%d)
```

### 8.2 — Stop + checkpoint + dump

```bash
# Arrêt clean des services launchd
launchctl unload ~/Library/LaunchAgents/com.recarnot.gerber-brain.plist
launchctl unload ~/Library/LaunchAgents/com.recarnot.agent-brain.plist

# Vérifier qu'aucun process n'écrit encore dans la DB
lsof ~/.config/gerber/gerber.db && echo "ATTENTION processus ouvert" || echo "DB libre"

# Checkpoint WAL (fusion WAL → DB principale)
sqlite3 ~/.config/gerber/gerber.db "PRAGMA wal_checkpoint(TRUNCATE);"

# Dump cohérent via .backup (recommandé pour SQLite avec WAL)
sqlite3 ~/.config/gerber/gerber.db ".backup '/tmp/gerber-snapshot.db'"

# Vérif intégrité du dump
sqlite3 /tmp/gerber-snapshot.db "PRAGMA integrity_check;"
# Doit retourner "ok"

# Tarball complète (DB + config + runs/)
tar -czf /tmp/gerber-migrate.tgz -C ~/.config gerber/
ls -lh /tmp/gerber-migrate.tgz
```

### 8.3 — Upload + restore VPS

```bash
scp /tmp/gerber-migrate.tgz root@VPS:/tmp/

ssh root@VPS <<'EOF'
  set -euo pipefail
  mkdir -p /opt/gerber/data
  # Backup éventuel pré-existant (par sécurité)
  if [ -f /opt/gerber/data/gerber.db ]; then
    mv /opt/gerber/data /opt/gerber/data.bak-$(date +%Y%m%d-%H%M%S)
    mkdir -p /opt/gerber/data
  fi
  tar -xzf /tmp/gerber-migrate.tgz -C /opt/gerber/data --strip-components=1
  chown -R 1000:1000 /opt/gerber/data

  # Vérif intégrité côté VPS
  sqlite3 /opt/gerber/data/gerber.db "PRAGMA integrity_check;"

  rm /tmp/gerber-migrate.tgz
EOF
```

### 8.4 — Premier deploy

```bash
cd /Users/recarnot/dev/gerber-caserne     # path post P-1
git tag gerber-v2.0.0-rc.1 -m "Initial VPS deploy"
git push --tags
```

### 8.5 — Validation post-deploy (OBLIGATOIRE avant nettoyage P4)

```bash
# Healthcheck
curl -fsS https://gerber.mcp.romain-ecarnot.com/healthz | jq

# Compter sur le VPS et comparer au snapshot pré-migration
ssh root@VPS <<'EOF' > /tmp/gerber-post-migration-counts.txt
docker exec gerber-mcp sqlite3 /data/gerber.db <<'SQL'
SELECT 'projects', COUNT(*) FROM projects;
SELECT 'notes', COUNT(*) FROM notes;
SELECT 'tasks', COUNT(*) FROM tasks;
SELECT 'issues', COUNT(*) FROM issues;
SELECT 'messages', COUNT(*) FROM messages;
SELECT 'chunks', COUNT(*) FROM chunks;
SELECT 'embeddings_size', SUM(LENGTH(embedding)) FROM chunks WHERE embedding IS NOT NULL;
SQL
EOF
diff /tmp/gerber-pre-migration-counts.txt /tmp/gerber-post-migration-counts.txt
# Doit retourner vide (égalité parfaite)
```

Smoke-tests fonctionnels via Claude Code :
- `mcp__gerber__project_list` → tous les projets ingérés présents
- `mcp__gerber__note_list` sur 2-3 projets aléatoires → notes attendues
- `mcp__gerber__search "query connue"` → résultats sémantiques cohérents (embeddings préservés)
- `mcp__gerber__task_list` → kanban intact
- claude.ai custom connector se reconnecte (OAuth client_id/secret inchangés, rapatriés depuis l'ancien `~/.config/gerber/config.json` vers `secrets/gerber.enc.yaml`)

**Tant que la validation n'est pas verte sur les 6 points ci-dessus, on NE PASSE PAS à P4** (pas de suppression locale).

---

## 9. Nettoyage Mac (P4)

### 9.1 Launchd

Unload + supprimer 4 plists :
```bash
launchctl unload -w ~/Library/LaunchAgents/com.recarnot.gerber-brain.plist
launchctl unload -w ~/Library/LaunchAgents/com.recarnot.gerber-brain.purger.plist
launchctl unload -w ~/Library/LaunchAgents/com.recarnot.gerber-brain.querylog-purge.plist
launchctl unload -w ~/Library/LaunchAgents/com.recarnot.agent-brain.plist

trash ~/Library/LaunchAgents/com.recarnot.gerber-brain.plist
trash ~/Library/LaunchAgents/com.recarnot.gerber-brain.purger.plist
trash ~/Library/LaunchAgents/com.recarnot.gerber-brain.querylog-purge.plist
trash ~/Library/LaunchAgents/com.recarnot.agent-brain.plist
```

**À garder** : `com.cloudflare.cloudflared.plist` (peut servir pour d'autres tunnels). Mais désactiver la config gerber dedans (`~/.cloudflared/config.yml`).

### 9.2 Cloudflared

Éditer `~/.cloudflared/config.yml` pour retirer l'ingress `gerber.romain-ecarnot.com`. Si c'est le seul ingress, unload le service entier :
```bash
launchctl unload -w ~/Library/LaunchAgents/com.cloudflare.cloudflared.plist
```

### 9.3 Configs Claude Code

Retirer l'entrée MCP `gerber` ou `agent-brain` de `~/.claude.json` (remplacée par le `.mcp.json` du plugin).

### 9.4 Données locales

Archiver `~/.config/gerber/` en `.bak-2026-05-12/` (jamais `trash` direct — backup d'abord, suppression manuelle après 1 semaine de vérif sur VPS).

---

## 10. Questions ouvertes (à trancher avant ou pendant l'implémentation)

| # | Question | Quand trancher |
|---|----------|----------------|
| 1 | Versioning : v2.0.0 directe ou rc/beta channel pour itérer ? | **Avant P3** |
| 2 | Rotation du bearer token : skill dédiée (`gerber:rotate-token`) ou opération manuelle (regen sur VPS + re-run `gerber:onboarding`) ? | **P3 ou plus tard** |
| 3 | UI web phase 2 — peut-on protéger avec basic auth Traefik (le bearer ne suffit pas pour navigateur) ? Faut-il un session cookie ? | **P5** |
| 4 | Quota disque /opt/gerber/data — DB actuelle ~? MB, embeddings croissent avec les notes. Monitoring à prévoir | **P1 ou P2** |
| 5 | Doit-on synchroniser `pnpm install` automatiquement après P-1 (rebuild de tous les `node_modules`) ou laisser l'utilisateur le faire ? | **P-1** |

---

## 11. Phasing & critères de succès

| Phase | Scope | Critère de succès |
|-------|-------|-------------------|
| **P-1** : Rename `agent-brain` → `gerber-caserne` | Dossier local, `package.json` racine, packages internes (`@agent-brain/*` → `@gerber-caserne/*`), imports source, scripts pnpm, `CLAUDE.md`, reconfig path Claude Code | `pnpm install && pnpm test && pnpm typecheck && pnpm build` passent, MCP local démarre toujours, plugin `gerber-caserne` à jour côté Git |
| **P0** : Préparation MCP | `Dockerfile`, `deploy-vps/compose.yml`, refactor `config/user-config.ts` (env vars first), endpoint `/healthz`, `prefetch-model.js`, workflow GHA `release.yml` | `docker build` OK local, container démarre, `/healthz` répond 200 |
| **P1** : Infra VPS | DNS `*.mcp` Cloudflare via `cf-dns.sh`, secret `gerber.enc.yaml`, `apps/gerber/deploy-state.yaml`, matrix `deploy.yml`, cron `backup-gerber.sh` | `gerber-v2.0.0-rc.0-test` deploy avec DB vide OK, Traefik route `gerber.mcp...`, cert ACME émis |
| **P2** : Migration data (**1:1, jamais de wipe**) | Snapshot counts pré-migration, backup `.bak-pre-vps-migration`, stop launchd, checkpoint WAL, `.backup` SQLite, scp, restore VPS, `PRAGMA integrity_check`, counts post = counts pré, smoke-tests fonctionnels | Diff counts pré/post = vide, embeddings recherchables, claude.ai reconnecte sans intervention |
| **P3** : Plugin Claude Code | Repo `gerber-caserne` v2.0.0, `.mcp.json`, modif `gerber:onboarding` (token + healthcheck), README quickstart | `/plugin install gerber@erom-marketplace` + `/gerber:onboarding` end-to-end OK sur machine fraîche |
| **P4** : Nettoyage Mac | Unload + delete 4 plists launchd, désactivation ingress cloudflared, suppression entrée MCP `~/.claude.json`, archive `~/.config/gerber/` | `launchctl list` ne montre plus aucun service gerber, MCP local n'écoute plus, plugin gerber marche en pointant exclusivement sur VPS |
| **P5** *(post-MVP)* : UI web | Build UI dans le Docker, route `/` Express, basic auth Traefik (à valider en Q4), accessible sur `https://gerber.mcp.romain-ecarnot.com/` | UI rendue, lecture/écriture OK, auth fonctionne |

Chaque phase est indépendamment vérifiable. Tu peux t'arrêter à P4 pendant des semaines avant P5.

### 11.0 — Détail Phase P-1 (rename `agent-brain` → `gerber-caserne`)

**Pourquoi en premier ?** Tous les artefacts produits ensuite (Dockerfile, image GHCR, compose, workflows GHA, refs dans le spec) doivent référencer le nom cible. Faire le rename après produirait du retravail et de la confusion.

**Étapes ordonnées** :

1. **Sauvegarde** : commit + push branch courante avant tout, créer branche `refactor/rename-gerber-caserne`.
2. **Renommer le dossier local** :
   ```bash
   cd /Users/recarnot/dev
   mv agent-brain gerber-caserne
   cd gerber-caserne
   ```
3. **Stopper les services launchd qui pointent dessus** (sinon plists cassés) — temporaire le temps du rename ; à supprimer définitivement en P4 :
   ```bash
   launchctl unload ~/Library/LaunchAgents/com.recarnot.agent-brain.plist
   launchctl unload ~/Library/LaunchAgents/com.recarnot.gerber-brain.plist
   ```
4. **Renommer package racine** (`package.json`) :
   ```json
   { "name": "gerber-caserne", "private": true, "version": "1.5.2" }
   ```
5. **Renommer chaque package interne** (`packages/{mcp,shared,tui,ui,admin}/package.json`) :
   - `@agent-brain/mcp` → `@gerber-caserne/mcp`
   - `@agent-brain/shared` → `@gerber-caserne/shared`
   - `@agent-brain/tui` → `@gerber-caserne/tui`
   - `@agent-brain/ui` → `@gerber-caserne/ui`
   - `@agent-brain/admin` → `@gerber-caserne/admin`
6. **Mettre à jour les `dependencies` croisées** entre packages (`@agent-brain/shared` apparaît comme dep de `@agent-brain/mcp`, `@agent-brain/ui`, etc.).
7. **Sed global** sur les imports source :
   ```bash
   grep -rl '@agent-brain/' --include='*.ts' --include='*.tsx' --include='*.json' | \
     xargs sed -i '' 's|@agent-brain/|@gerber-caserne/|g'
   ```
8. **Mettre à jour les scripts pnpm** dans le `package.json` racine (`--filter @agent-brain/*` → `@gerber-caserne/*`).
9. **Mettre à jour `CLAUDE.md`** (titre + références).
10. **Mettre à jour les paths Claude Code** : si `~/.claude.json` contient une référence à `/Users/recarnot/dev/agent-brain`, la corriger en `/Users/recarnot/dev/gerber-caserne`.
11. **Reinstaller et tester** :
    ```bash
    pnpm install
    pnpm typecheck
    pnpm test
    pnpm build
    ```
12. **Vérifier que le MCP local démarre toujours** (lancement manuel `pnpm serve`, smoke test `curl localhost:3000/healthz` une fois `/healthz` ajouté en P0 — pour P-1 c'est juste "le serveur boot sans crash").
13. **Commit** : `refactor: rename agent-brain → gerber-caserne (workspace alignment)`.
14. **Merge sur main + push**. Le repo Git s'appelle déjà `gerber-caserne`, donc rien à faire côté GitHub.

**À ne PAS toucher en P-1** :
- `~/.config/gerber/` (path utilisateur, déjà "gerber")
- Le nom du plugin (`name: "gerber"` dans `.claude-plugin/plugin.json`)
- Les noms des skills (`gerber:*`)
- Les noms des tools MCP exposés (`mcp__gerber__*`)
- La table SQLite, les migrations, les données

**Risques spécifiques** :
- Tests qui hardcodent `@agent-brain/*` → sed les attrape.
- Aliases TypeScript dans `tsconfig*.json` (chercher `"paths"`).
- Workflows GHA existants (s'il y en a) qui référencent `agent-brain`.
- Plists launchd qui contiennent le path absolu — de toute façon supprimés en P4.

---

## 12. Risques & mitigations

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| `better-sqlite3` rebuild échoue dans le container (glibc mismatch) | Moyenne | Bloquant build | Garder `node:22-bookworm-slim` partout, tester `docker build` localement avant tag |
| Modèle E5 download échoue au build (HF rate limit) | Faible | Bloquant build | Retry script, cache GHA `~/.cache/huggingface` |
| Migration data : perte/corruption pendant transfer | Faible | **CRITIQUE** (>10 projets ingérés) | Triple ceinture : (1) `cp -R ~/.config/gerber ~/.config/gerber.bak-pre-vps-migration-<date>` avant TOUT arrêt, (2) `.backup` SQLite + `PRAGMA integrity_check` côté Mac ET VPS, (3) diff counts pré/post = vide obligatoire avant P4, (4) garder `~/.config/gerber/` 1 semaine minimum post-cutover, suppression manuelle uniquement (jamais via script) |
| Reindex involontaire écrasant les embeddings | Faible | **CRITIQUE** | `pnpm mcp:reindex` NE doit PAS être lancé sur VPS post-migration. Ajouter un guard dans le script (refuser si `chunks` table > 0 sans `--force`) — TODO P0 |
| Cert ACME wildcard `*.mcp` rate-limited par Let's Encrypt | Faible | Délai 1h | Tester en staging d'abord (`caServer: ...acme-staging-v02...`) |
| OAuth client_id/secret régénérés cassent claude.ai connector | Moyenne | Reconfig connector manuelle | Reuse les valeurs actuelles (rapatrier depuis `~/.config/gerber/config.json` actuel vers `secrets/gerber.enc.yaml`) |
| `${GERBER_TOKEN}` interpolation non supportée par certaines versions Claude Code | Faible | Token visible en clair | Tester sur la version actuelle, documenter fallback `~/.claude.json` direct si besoin |

---

## 13. Hors scope (explicite)

- Multi-tenant / signup public — décision §1
- Migration vers Postgres ou autre DB — SQLite + WAL est suffisant single-user
- Replication / HA — single VPS, RTO acceptable = ~30 min (restore backup)
- Refonte UI web — phase 2 reprend l'UI existante, pas de redesign

---

## 14. Références

- Pattern déploiement : `vps-docker-manager-prod/README.md` (workflow buck/trinity)
- Spec design infra-bootstrap : `vps-docker-manager-prod/docs/superpowers/specs/2026-04-25-infra-bootstrap-design.md`
- Lessons Buck onboarding : `vps-docker-manager-prod/docs/lessons-buck-onboarding.md`
- Gotchas MCP/Streamable actuels : `agent-brain/CLAUDE.md` (entries 15-20)
