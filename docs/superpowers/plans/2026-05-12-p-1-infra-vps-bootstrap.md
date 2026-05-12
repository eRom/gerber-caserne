# P-1 : Infra VPS bootstrap — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for inline execution. Most tasks are non-code (DNS API calls, sops, ssh, gh).

**Goal:** Provisionner toute l'infra VPS pour héberger `gerber-mcp` derrière Traefik sur `gerber.mcp.romain-ecarnot.com`, et exécuter un **premier deploy test avec DB vide** pour valider le pipeline avant la vraie migration data (P2).

**Architecture:** Réutilisation du pattern `buck`/`trinity` déjà éprouvé dans `vps-docker-manager-prod`. Aucune infra nouvelle — juste un nouveau record DNS, un nouveau secret sops, et une nouvelle ligne dans la matrix du workflow `deploy.yml`.

**Tech Stack:** Cloudflare DNS API, sops + age, GitHub Actions (existant), Traefik v3 ACME wildcard, SSH au VPS `srv1314306`.

**Spec source:** `docs/superpowers/specs/2026-05-12-gerber-plugin-vps-migration-design.md` §6, §11 P1.

**Critère de succès final:**
1. DNS `gerber.mcp.romain-ecarnot.com` résout vers `72.62.239.98`
2. Cert ACME wildcard `*.mcp.romain-ecarnot.com` émis par Traefik
3. Container `gerber-mcp` running sur VPS via deploy GHA réussi
4. `curl https://gerber.mcp.romain-ecarnot.com/health` retourne 200 + `{"ok":true,…}` (DB vide → 0 projects)
5. Pas de régression sur buck/trinity/n8n/uptime-kuma

---

## Pré-requis

- ✅ P-0 mergée sur `main` (Dockerfile, compose, GHA workflow présents)
- ✅ Branche `feat/p1-infra-vps` à créer dans `vps-docker-manager-prod`
- ✅ Secrets requis :
  - `GERBER_BEARER_TOKEN` (à générer, 64 hex chars)
  - `GERBER_OAUTH_CLIENT_ID` (à générer, `gerber-` + 16 hex)
  - `GERBER_OAUTH_CLIENT_SECRET` (à générer, 64 hex chars)
  - GitHub `INFRA_DISPATCH_PAT` côté `eRom/gerber-caserne` (à configurer si pas déjà)

---

### Task 1 : Génération des secrets gerber (controller, local Mac)

- [ ] **Step 1 : Générer les 3 secrets gerber**

```bash
cd /Users/recarnot/dev/gerber-caserne
BEARER=$(openssl rand -hex 32)
OAUTH_ID="gerber-$(openssl rand -hex 8)"
OAUTH_SECRET=$(openssl rand -hex 32)
cat <<EOF > /tmp/gerber-secrets-raw.yaml
GERBER_BEARER_TOKEN: "${BEARER}"
GERBER_OAUTH_CLIENT_ID: "${OAUTH_ID}"
GERBER_OAUTH_CLIENT_SECRET: "${OAUTH_SECRET}"
EOF
echo "Generated. Bearer (first 12 chars): ${BEARER:0:12}…"
```

Expected : 3 secrets dans `/tmp/gerber-secrets-raw.yaml`.

⚠️ Le fichier `/tmp/gerber-secrets-raw.yaml` contient les secrets en clair. À chiffrer (Task 4) puis `trash`.

---

### Task 2 : DNS Cloudflare — record `*.mcp` → IP VPS

- [ ] **Step 1 : Créer le record A wildcard**

```bash
cd /Users/recarnot/dev/vps-docker-manager-prod
CF_TOKEN=$(sops -d secrets.enc.yaml | grep CF_DNS_API_TOKEN | awk '{print $2}')
ZONE_ID="ad0eae7a25b287974d10f7c8ebaec7eb"

curl -fsS -X POST "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records" \
  -H "Authorization: Bearer ${CF_TOKEN}" \
  -H "Content-Type: application/json" \
  --data '{"type":"A","name":"*.mcp","content":"72.62.239.98","ttl":1,"proxied":false}' \
  | python3 -m json.tool | head -20
```

Expected : `"success": true`, record ID retourné.

**Important :** `proxied: false` car Traefik gère TLS directement (ACME DNS challenge). Si proxied, ACME ne marchera pas.

- [ ] **Step 2 : Vérifier la propagation**

```bash
sleep 30
dig +short gerber.mcp.romain-ecarnot.com
# Expected: 72.62.239.98
```

Si vide, attendre encore 30s. Cloudflare propage en quelques secondes habituellement.

---

### Task 3 : Branche vps-docker-manager-prod + nettoyage

- [ ] **Step 1 : Working tree clean**

```bash
cd /Users/recarnot/dev/vps-docker-manager-prod
git status
# Untracked: secrets/buck.enc.yaml.tmp.48849 (0B leftover) — à trash

trash secrets/buck.enc.yaml.tmp.48849 2>/dev/null
git status
```

- [ ] **Step 2 : Sync main + créer branche**

```bash
git checkout main && git pull origin main
git checkout -b feat/p1-gerber-onboarding
```

---

### Task 4 : Créer `secrets/gerber.enc.yaml` (sops chiffré)

- [ ] **Step 1 : Vérifier que `.sops.yaml` route bien `secrets/gerber.enc.yaml`**

```bash
cd /Users/recarnot/dev/vps-docker-manager-prod
cat .sops.yaml
# Expected: regex 'secrets/*.enc.yaml' (path_regex) + age recipients
```

Le pattern actuel devrait déjà couvrir n'importe quel fichier sous `secrets/`.

- [ ] **Step 2 : Chiffrer le fichier clair vers `secrets/gerber.enc.yaml`**

```bash
cp /tmp/gerber-secrets-raw.yaml secrets/gerber.enc.yaml
sops -e -i secrets/gerber.enc.yaml
head -5 secrets/gerber.enc.yaml
# Expected: ENC[AES256_GCM,data:…] blobs
```

- [ ] **Step 3 : Vérifier déchiffrement OK**

```bash
sops -d secrets/gerber.enc.yaml
# Expected: 3 secrets clairs
```

- [ ] **Step 4 : Trash le fichier clair**

```bash
trash /tmp/gerber-secrets-raw.yaml
ls /tmp/gerber-secrets-raw.yaml 2>&1 | head -1
# Expected: No such file
```

---

### Task 5 : `apps/gerber/deploy-state.yaml`

- [ ] **Step 1 : Créer le dossier + fichier**

```bash
mkdir -p apps/gerber
cat > apps/gerber/deploy-state.yaml <<'EOF'
app: gerber
app_repo: eRom/gerber-caserne
tag: null
version: null
sha: null
deployed_at: null
deployed_by: null
EOF
```

---

### Task 6 : Update `.github/workflows/deploy.yml` (ajouter `gerber` à la matrix)

- [ ] **Step 1 : Lire le workflow existant pour identifier la structure matrix**

```bash
cat .github/workflows/deploy.yml | head -50
```

Identifier comment les apps sont listées (matrix `app: [buck, n8n, trinity]` ou autre).

- [ ] **Step 2 : Ajouter `gerber` à la liste / event-types acceptés**

Le workflow consomme `repository_dispatch` event `deploy-<app>`. Selon la structure observée :
- Si matrix : ajouter `gerber` à la liste
- Si trigger event_types : ajouter `deploy-gerber`

Plus probablement, il y a un `if:` qui filtre sur `event_type`. Vérifier et modifier.

Sans connaître la structure exacte, à confirmer en lecture. Modification probable mineure (1-3 lignes).

---

### Task 7 : `scripts/backup-gerber.sh`

- [ ] **Step 1 : Créer le script**

```bash
cat > scripts/backup-gerber.sh <<'BASH'
#!/usr/bin/env bash
# Daily SQLite backup for gerber-mcp container.
# Coherent backup via `.backup` (handles WAL properly).
# Cron: 15 3 * * *  /opt/_infra/scripts/backup-gerber.sh
set -euo pipefail

TS=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR=/opt/_infra/backups/gerber
mkdir -p "${BACKUP_DIR}"

# Find age recipient (same as other backup scripts)
AGE_RECIPIENT="${AGE_RECIPIENT:-$(grep -oE 'age1[a-z0-9]+' /opt/_infra/.sops.yaml | head -1)}"
if [[ -z "${AGE_RECIPIENT}" ]]; then
  echo "ERROR: AGE_RECIPIENT not set and not findable in .sops.yaml" >&2
  exit 1
fi

# Coherent SQLite backup via .backup (WAL-safe)
docker exec gerber-mcp sqlite3 /data/brain.db ".backup '/data/.backup-${TS}.db'"

# Tar + age encrypt + clean intermediate
docker exec gerber-mcp tar -czf - -C /data ".backup-${TS}.db" \
  | age -r "${AGE_RECIPIENT}" -o "${BACKUP_DIR}/gerber-${TS}.tar.gz.age"

docker exec gerber-mcp rm "/data/.backup-${TS}.db"

# Retention: 14 days
find "${BACKUP_DIR}" -name 'gerber-*.tar.gz.age' -mtime +14 -delete

echo "Backup OK: ${BACKUP_DIR}/gerber-${TS}.tar.gz.age ($(du -h "${BACKUP_DIR}/gerber-${TS}.tar.gz.age" | awk '{print $1}'))"
BASH
chmod +x scripts/backup-gerber.sh
```

- [ ] **Step 2 : Pas d'install cron immédiat** — sera fait au prochain bootstrap VPS (cf Task 9). Le script sera dispo dans `/opt/_infra/scripts/` après le `git pull` côté VPS.

---

### Task 8 : VPS bootstrap minimal (mkdir /opt/gerber/data)

- [ ] **Step 1 : Créer le dossier data sur le VPS**

```bash
ssh srv1314306 'mkdir -p /opt/gerber/data && chown 1000:1000 /opt/gerber/data && ls -la /opt/gerber/'
# Expected: data/ owned by 1000:1000
```

---

### Task 9 : Commit + push `vps-docker-manager-prod`

- [ ] **Step 1 : Verify**

```bash
cd /Users/recarnot/dev/vps-docker-manager-prod
git status
git diff --stat
```
Expected : 4-5 nouveaux fichiers (apps/gerber/deploy-state.yaml, secrets/gerber.enc.yaml, scripts/backup-gerber.sh) + 1 modifié (.github/workflows/deploy.yml).

- [ ] **Step 2 : Commit**

```bash
git add -A
git commit -m "feat(gerber): onboard gerber-caserne to deploy pipeline

- apps/gerber/deploy-state.yaml (eRom/gerber-caserne)
- secrets/gerber.enc.yaml (bearer + OAuth client creds)
- scripts/backup-gerber.sh (cron 15 3 * * *, age-encrypted, 14d retention)
- .github/workflows/deploy.yml: accept deploy-gerber event

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 3 : Merge main + push**

```bash
git checkout main
git merge --ff-only feat/p1-gerber-onboarding
git push origin main
git branch -d feat/p1-gerber-onboarding
```

- [ ] **Step 4 : Pull côté VPS pour récupérer les fichiers infra (notamment le backup script)**

```bash
ssh srv1314306 'cd /opt/_infra && git pull origin main && ls scripts/backup-gerber.sh'
```

- [ ] **Step 5 : Ajouter le cron sur le VPS**

```bash
ssh srv1314306 'crontab -l 2>/dev/null | grep -q backup-gerber || (crontab -l 2>/dev/null; echo "15 3 * * *  /opt/_infra/scripts/backup-gerber.sh") | crontab -'
ssh srv1314306 'crontab -l | grep gerber'
# Expected: 15 3 * * *  /opt/_infra/scripts/backup-gerber.sh
```

---

### Task 10 : Configurer GitHub secret `INFRA_DISPATCH_PAT` (côté gerber-caserne)

- [ ] **Step 1 : Vérifier si le secret existe déjà**

```bash
gh secret list -R eRom/gerber-caserne | grep INFRA_DISPATCH_PAT
```

Si présent : skip Steps 2-3.

- [ ] **Step 2 : Générer un fine-grained PAT avec `Repository > Contents > Read-write` sur `eRom/vps-docker-manager-prod`**

⚠️ Cette étape est **manuelle sur github.com** (interface UI). Aller sur https://github.com/settings/personal-access-tokens/new, créer un fine-grained PAT :
- Resource owner : `eRom`
- Repository access : Only select repositories → `vps-docker-manager-prod`
- Permissions : Repository → `Contents: Read and write`
- Expiration : 1 an
- Copier le token retourné.

- [ ] **Step 3 : Ajouter le secret au repo `gerber-caserne`**

```bash
echo -n "<paste-PAT-here>" | gh secret set INFRA_DISPATCH_PAT -R eRom/gerber-caserne
gh secret list -R eRom/gerber-caserne | grep INFRA_DISPATCH_PAT
```

---

### Task 11 : Premier deploy test — tag `gerber-v2.0.0-rc.0`

- [ ] **Step 1 : Tag depuis `main` local de gerber-caserne**

```bash
cd /Users/recarnot/dev/gerber-caserne
git checkout main
git pull origin main
git log --oneline -3
# Expected: f9d1447 feat(p0): docker / VPS preparation … en tête
git tag gerber-v2.0.0-rc.0 -m "P1: first VPS deploy test (empty DB)"
git push origin gerber-v2.0.0-rc.0
```

- [ ] **Step 2 : Monitor le workflow GHA `Release gerber-caserne`**

```bash
sleep 5
gh run watch -R eRom/gerber-caserne || gh run list -R eRom/gerber-caserne --workflow=release.yml | head -5
```

Expected : le workflow démarre, build Docker (5-7 min première fois), push GHCR, dispatch vers vps-docker-manager-prod.

- [ ] **Step 3 : Monitor le workflow `deploy.yml` côté `vps-docker-manager-prod`**

```bash
sleep 60
gh run list -R eRom/vps-docker-manager-prod --workflow=deploy.yml | head -5
gh run watch -R eRom/vps-docker-manager-prod || true
```

Expected : déclenché par `repository_dispatch deploy-gerber`, SSH au VPS, pull image GHCR, `docker compose up -d`.

---

### Task 12 : Validation post-deploy

- [ ] **Step 1 : Container running sur VPS**

```bash
ssh srv1314306 'docker ps --format "table {{.Names}}\t{{.Status}}" | grep gerber-mcp'
# Expected: gerber-mcp Up X seconds (healthy ou starting)
```

- [ ] **Step 2 : Cert ACME émis**

```bash
sleep 30  # ACME DNS challenge prend ~30-60s
curl -sSI https://gerber.mcp.romain-ecarnot.com/health | head -5
# Expected: HTTP/2 200 et chain certificat Let's Encrypt
```

Si erreur SSL `unable to get local issuer`, attendre 1-2 min (propagation ACME).

- [ ] **Step 3 : Healthcheck end-to-end via HTTPS**

```bash
curl -fsS https://gerber.mcp.romain-ecarnot.com/health | python3 -m json.tool
# Expected: {"ok":true, "embedderReady":true, "dbPath":"/data/brain.db"}
```

- [ ] **Step 4 : MCP Streamable HTTP avec bearer**

```bash
BEARER=$(ssh srv1314306 'docker exec gerber-mcp printenv GERBER_BEARER_TOKEN')
curl -sS -X POST https://gerber.mcp.romain-ecarnot.com/mcp/stream \
  -H "Authorization: Bearer ${BEARER}" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"p1-smoke","version":"1.0"}}}' | head -50
# Expected: JSON-RPC response with serverInfo: gerber
```

- [ ] **Step 5 : DB vide attendue (premier deploy, pas de migration data)**

```bash
ssh srv1314306 'docker exec gerber-mcp sqlite3 /data/brain.db "SELECT COUNT(*) FROM projects;"'
# Expected: 0
```

- [ ] **Step 6 : Pas de régression sur les autres apps**

```bash
ssh srv1314306 'docker ps --format "table {{.Names}}\t{{.Status}}"'
# Expected: tous les containers (buck-*, trinity-*, n8n, qdrant, traefik, uptime-kuma, gerber-mcp) Up
```

---

## Post-plan checklist

- [ ] DNS `gerber.mcp.romain-ecarnot.com` propagé
- [ ] Cert wildcard `*.mcp.romain-ecarnot.com` émis par Traefik
- [ ] Container `gerber-mcp` running + healthy
- [ ] `/health` HTTPS retourne `ok:true`
- [ ] `/mcp/stream` avec bearer répond à `initialize`
- [ ] DB vide (0 projects) — attendu, sera peuplée en P2
- [ ] Cron backup configuré sur VPS (`15 3 * * *`)
- [ ] `secrets/gerber.enc.yaml` commité et chiffré sur `vps-docker-manager-prod`
- [ ] `apps/gerber/deploy-state.yaml` à jour avec tag `gerber-v2.0.0-rc.0`
- [ ] Pas de régression sur buck/trinity/n8n/uptime-kuma

**Suivant** : P2 (migration data — stop launchd Mac, snapshot DB, scp vers VPS, restore, validation counts contre l'oracle UI).

---

## Risques résiduels

| Risque | Détection | Mitigation |
|--------|-----------|------------|
| Cert ACME wildcard `*.mcp` rate-limited (LE) | `curl` retourne erreur SSL persistante | Attendre 1h ; éventuellement basculer en staging d'abord (`acme-staging-v02`) puis re-issue |
| Le workflow `deploy.yml` ne reconnaît pas `gerber` comme app valide | Workflow fail sur "unknown app" | Lire la structure exacte de `deploy.yml` avant Task 6 ; adapter le pattern (matrix vs if conditionnel) |
| Image GHCR `gerber-caserne` 1.92 GB, pull lent sur VPS | Deploy timeout | Le VPS a un lien rapide ; au pire augmenter timeout dans workflow |
| `GHCR_TOKEN` ou auth GHCR manquant côté VPS | `docker pull` fail | Réutiliser le pattern buck — l'auth GHCR est probablement déjà configurée sur le VPS via `~/.docker/config.json` |
| `INFRA_DISPATCH_PAT` expiré | dispatch fail | Régénérer via Task 10 |
| OAuth `client_id` change → claude.ai connector cassé | claude.ai erreur 401 | OK en P1 (test deploy), à régler en P2 avec rapatriement des creds existants depuis `~/.config/gerber/config.json` |
