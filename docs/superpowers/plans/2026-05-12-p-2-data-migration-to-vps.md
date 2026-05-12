# P-2 : Migration data Mac → VPS — Implementation Plan

> **For agentic workers:** Execute inline (controller). All steps touch the SQLite DB — DO NOT dispatch subagents.

**Goal:** Transférer la DB locale `~/.agent-brain/brain.db` (24 projects, 254 notes, 248 chunks, 69 tasks, 39 issues, 12 messages, ~3.3 MB) vers `/opt/gerber/data/brain.db` sur le VPS, sans perte ni corruption, avec validation par comptage.

**Architecture:** Stop services Mac → checkpoint WAL → dump cohérent via `.backup` → scp → stop container VPS → replace DB → start container → validation counts via MCP tool calls.

**Oracle de référence:**
- 24 projects, **254 notes**, **248 chunks**, 69 tasks, 39 issues, 12 messages
- DB size ~3.3 MB (cf `docs/superpowers/snapshots/2026-05-12-gerber-snapshot-pre-migration.md`)

**Pré-requis:**
- ✅ P-1.1 mergée — container VPS `gerber-mcp` running healthy avec DB vide
- ✅ Backup paranoïa déjà fait : `~/.agent-brain.bak-pre-rename-20260512/`
- ✅ DNS + cert + Traefik routing OK

---

### Task 1 : Snapshot counts Mac (oracle pré-migration)

```bash
sqlite3 ~/.agent-brain/brain.db <<'SQL' | tee /tmp/gerber-pre-migration-counts.txt
SELECT 'projects', COUNT(*) FROM projects;
SELECT 'notes', COUNT(*) FROM notes;
SELECT 'tasks', COUNT(*) FROM tasks;
SELECT 'issues', COUNT(*) FROM issues;
SELECT 'messages', COUNT(*) FROM messages;
SELECT 'chunks', COUNT(*) FROM chunks;
SQL
```

Expected match oracle UI : `projects=24, notes=254, chunks=248, tasks=69, issues=39, messages=12`.

---

### Task 2 : Tuer les process qui tiennent la DB (4 orphelins)

```bash
lsof ~/.agent-brain/brain.db | awk 'NR>1 {print $2}' | sort -u | xargs -I{} kill -TERM {}
sleep 2
lsof ~/.agent-brain/brain.db 2>/dev/null && echo "STILL LOCKED" || echo "DB free"
```

Si toujours locked, escalate `kill -9`.

---

### Task 3 : Checkpoint WAL + dump cohérent via `.backup`

```bash
sqlite3 ~/.agent-brain/brain.db "PRAGMA wal_checkpoint(TRUNCATE);"
sqlite3 ~/.agent-brain/brain.db ".backup '/tmp/gerber-snapshot.db'"
sqlite3 /tmp/gerber-snapshot.db "PRAGMA integrity_check;"
# Expected: ok
ls -lh /tmp/gerber-snapshot.db
```

---

### Task 4 : Stop container VPS

```bash
ssh srv1314306 'docker stop gerber-mcp'
```

---

### Task 5 : Transfer + replace + chown

```bash
scp /tmp/gerber-snapshot.db srv1314306:/tmp/gerber-snapshot.db

ssh srv1314306 <<'REMOTE'
  set -euo pipefail
  # Move empty/auto-initialized DB out of the way (paranoia backup)
  if [ -f /opt/gerber/data/brain.db ]; then
    mv /opt/gerber/data/brain.db /opt/gerber/data/brain.db.empty-bak-$(date +%Y%m%d-%H%M%S)
  fi
  # Also clear WAL/SHM if any (no longer relevant)
  rm -f /opt/gerber/data/brain.db-wal /opt/gerber/data/brain.db-shm
  # Install the real DB
  cp /tmp/gerber-snapshot.db /opt/gerber/data/brain.db
  chown 1000:1000 /opt/gerber/data/brain.db
  rm /tmp/gerber-snapshot.db
  ls -lh /opt/gerber/data/
REMOTE
```

---

### Task 6 : Verify DB integrity côté VPS (avant restart)

```bash
ssh srv1314306 'docker run --rm -v /opt/gerber/data:/data alpine sh -c "apk add -q sqlite && sqlite3 /data/brain.db \"PRAGMA integrity_check;\""'
# Expected: ok
```

---

### Task 7 : Start container + wait for healthcheck

```bash
ssh srv1314306 'docker start gerber-mcp'
sleep 10
ssh srv1314306 'docker ps --filter name=gerber-mcp --format "{{.Status}}"'
# Expected: Up X seconds (healthy ou starting)

# Wait until healthy (up to 60s)
for i in 1 2 3 4 5 6; do
  status=$(ssh srv1314306 'docker inspect -f "{{.State.Health.Status}}" gerber-mcp')
  echo "attempt $i: $status"
  [ "$status" = "healthy" ] && break
  sleep 10
done
```

---

### Task 8 : Validation counts via DB direct + MCP call

```bash
# Direct DB query via better-sqlite3 inside container
ssh srv1314306 'docker exec gerber-mcp node -e "
const Database = require(\"better-sqlite3\");
const db = new Database(\"/data/brain.db\", {readonly: true});
[\"projects\",\"notes\",\"tasks\",\"issues\",\"messages\",\"chunks\"].forEach(t => {
  const c = db.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get();
  console.log(t + \"|\" + c.c);
});
db.close();
" 2>&1' | tee /tmp/gerber-post-migration-counts.txt

# Compare
diff /tmp/gerber-pre-migration-counts.txt /tmp/gerber-post-migration-counts.txt && echo "✅ COUNTS IDENTIQUES" || echo "❌ DIFFERENCE"
```

---

### Task 9 : MCP-level smoke test (project_list via /mcp/stream)

```bash
BEARER=$(ssh srv1314306 'docker exec gerber-mcp printenv GERBER_BEARER_TOKEN')

# First initialize the session (required before tools/list / tools/call)
INIT=$(curl -sS -X POST https://gerber.mcp.romain-ecarnot.com/mcp/stream \
  -H "Authorization: Bearer ${BEARER}" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -i \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"p2-smoke","version":"1.0"}}}')
SESSION_ID=$(echo "$INIT" | grep -i '^mcp-session-id:' | awk '{print $2}' | tr -d '\r')
echo "Session: $SESSION_ID"

# initialized notification + project_list
curl -sS -X POST https://gerber.mcp.romain-ecarnot.com/mcp/stream \
  -H "Authorization: Bearer ${BEARER}" \
  -H "mcp-session-id: ${SESSION_ID}" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","method":"notifications/initialized"}'

curl -sS -X POST https://gerber.mcp.romain-ecarnot.com/mcp/stream \
  -H "Authorization: Bearer ${BEARER}" \
  -H "mcp-session-id: ${SESSION_ID}" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"project_list","arguments":{}}}' | head -100
```

Expected : liste des 24 projets contenant `A2A-production-profile`, `agent-brain`, `caserne`, `buck-writer-app`, `trinity`, etc.

---

### Task 10 : Update gerber's `publicUrl` config dans la DB (si stocké)

La DB pourrait contenir une ancienne référence à `gerber.romain-ecarnot.com` (l'ancien tunnel). Vérifier si une table de config gerber stocke cette URL — sinon skip.

Probablement pas stocké en DB (juste dans `~/.config/gerber/config.json` côté user). Le container utilise `GERBER_PUBLIC_URL=https://gerber.mcp.romain-ecarnot.com` via env var, donc la migration data ne touche pas à ça.

---

### Task 11 : (Plus tard) — Update claude.ai custom connector

Les OAuth client_id/secret côté claude.ai pointent sur les anciennes valeurs (depuis l'ancien `~/.config/gerber/config.json` du Mac). Sur le VPS, les NOUVELLES valeurs sont :
- `client_id`: `gerber-365ff71aa76be8ef`
- `client_secret`: (chiffré dans `secrets/gerber.enc.yaml`)
- `mcp_server_url`: `https://gerber.mcp.romain-ecarnot.com/mcp/stream` (différent de l'ancien `gerber.romain-ecarnot.com`)

→ **Action manuelle Romain** : reconfigurer le custom connector côté claude.ai avec le nouveau URL + client_id + client_secret. Fait hors automation.

À noter dans P-3 (plugin) ou en post-P-2 manuel.

---

## Success criteria

- [ ] Diff counts pré/post = vide
- [ ] DB sur VPS = 254 notes, 248 chunks, 24 projects (oracle match)
- [ ] `/mcp/stream` initialize OK avec bearer
- [ ] `project_list` retourne 24 projets visibles
- [ ] Container `gerber-mcp` healthy
- [ ] Backup `~/.agent-brain.bak-pre-rename-20260512/` toujours présent (à conserver 1 semaine minimum)

## Risques

| Risque | Détection | Mitigation |
|--------|-----------|------------|
| Process Mac refusent SIGTERM | `lsof` toujours rouge | `kill -9 <PID>` |
| Schema migrations diffèrent entre versions Mac et VPS | erreur SQLite au start container | `applyMigrations` est idempotent ; checker logs container |
| `chunks.embedding` blobs corrompus en transfer | recherche sémantique cassée | scp transfère en binaire (default), `integrity_check` détecte |
| sqlite-vec ou extensions natives manquantes dans container | erreur SQLite ouverture DB | Container utilise même better-sqlite3 que local ; pas d'extension custom dans le schema actuel (uniquement FTS5 builtin) |
