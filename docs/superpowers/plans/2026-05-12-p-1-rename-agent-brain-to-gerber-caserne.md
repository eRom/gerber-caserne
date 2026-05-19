# P-1 : Rename `agent-brain` → `gerber-caserne` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aligner tout le naming interne (dossier local, package racine, packages internes, scripts pnpm, image Docker, CLAUDE.md) avec le nom Git existant `gerber-caserne`. Aucun changement de comportement, aucune perte de données.

**Architecture:** Refactor de rename atomique sur une branche dédiée `refactor/rename-gerber-caserne`. Tous les changements convergent vers un commit atomique (impossible de laisser le build dans un état semi-renommé). Vérification par parité `pnpm typecheck && pnpm test && pnpm build` avant/après.

**Tech Stack:** pnpm 9 workspaces, TypeScript 5.6, Vitest, tsup. macOS Darwin 25 + zsh. Outils : `sed -i ''` (BSD), `find`, `git`, `launchctl`.

**Spec source :** `docs/superpowers/specs/2026-05-12-gerber-plugin-vps-migration-design.md` §11 P-1 + §11.0.

**Préservation critique :** la DB `~/.config/gerber/gerber.db` n'est PAS touchée. Aucun `pnpm mcp:reindex`, aucune migration de schéma, aucun redémarrage du serveur en mode dégradé.

**Oracle de référence (snapshot UI gerber pré-rename)** — cf. `docs/superpowers/snapshots/2026-05-12-gerber-snapshot-pre-migration.md` :
- **23 projets** (1 actif `A2A-production-profile` + 22 autres)
- **254 notes**
- **248 chunks**
- **468 embeddings**
- **DB Size 3.3 MB**
- **2 messages pending**, **1 handoff inbox**

Toutes ces valeurs DOIVENT être identiques après le rename (Task 12).

---

## File Structure (changements)

**Fichiers à modifier** :

| Fichier | Changement |
|---------|------------|
| `package.json` (racine) | `name`, scripts `--filter @agent-brain/*` |
| `packages/mcp/package.json` | `name`, `bin`, dep `@agent-brain/shared` |
| `packages/shared/package.json` | `name` |
| `packages/ui/package.json` | `name`, dep `@agent-brain/shared` |
| `packages/tui/package.json` | `name`, dep `@agent-brain/shared` |
| `packages/mcp/tsup.config.ts` | `noExternal: ['@agent-brain/shared']` → `@gerber-caserne/shared` |
| `packages/{mcp,shared,ui,tui}/src/**/*.ts(x)` | imports `from '@agent-brain/...'` (44 fichiers source) |
| `CLAUDE.md` (racine) | titre + références |
| `README.md` (racine) | mention `agent-brain` → `gerber-caserne` |

**Fichiers à déplacer** :
- `/Users/recarnot/dev/agent-brain/` → `/Users/recarnot/dev/gerber-caserne/`

**Fichiers à NE PAS toucher** :
- `~/.config/gerber/` (path user, déjà "gerber")
- `.claude-plugin/plugin.json` (le `name: "gerber"` reste, c'est le nom du plugin)
- `skills/`, `agents/`, `hooks/` (skills `gerber:*` inchangées)
- `packages/admin/Cargo.toml` (déjà `name = "gerber-admin"`)
- `tsconfig.base.json` (pas de `paths`)
- La DB SQLite + WAL/SHM + le contenu de `~/.config/gerber/`
- Les fichiers `docs/superpowers/specs/*` et `docs/superpowers/plans/*` (référence historique, exception : ce plan lui-même)
- `_gerber_/` (cartographie projet, référence historique)

---

## Pré-requis

- Working directory propre (`git status` clean) ou commits/stash avant de commencer.
- Aucun client Claude Code actif n'utilisant le MCP `gerber` local (les sessions ouvertes peuvent verrouiller la DB).
- Branche `main` à jour côté origin (`git pull origin main`).

---

### Task 1 : Préparation — branch, backup, snapshot counts

**Files:**
- Read: `~/.config/gerber/gerber.db`
- Create: `/tmp/gerber-pre-rename-snapshot.txt`, `~/.config/gerber.bak-pre-rename-YYYYMMDD/`

- [ ] **Step 1 : Vérifier l'état Git propre**

```bash
cd /Users/recarnot/dev/agent-brain
git status
git pull origin main
```
Expected : `nothing to commit, working tree clean` et branche `main` à jour.

- [ ] **Step 2 : Créer la branche de refactor**

```bash
git checkout -b refactor/rename-gerber-caserne
```
Expected : `Switched to a new branch 'refactor/rename-gerber-caserne'`

- [ ] **Step 3 : Backup ceinture-bretelles de la DB (paranoïa : >10 projets ingérés)**

```bash
DATE=$(date +%Y%m%d)
cp -R ~/.config/gerber ~/.config/gerber.bak-pre-rename-${DATE}
ls -lh ~/.config/gerber.bak-pre-rename-${DATE}/
```
Expected : copie complète de `gerber.db` (+ WAL/SHM si présents) + `config.json`.

- [ ] **Step 4 : Snapshot des counts DB (référence post-refactor)**

```bash
sqlite3 ~/.config/gerber/gerber.db <<'SQL' | tee /tmp/gerber-pre-rename-snapshot.txt
SELECT 'projects', COUNT(*) FROM projects;
SELECT 'notes', COUNT(*) FROM notes;
SELECT 'tasks', COUNT(*) FROM tasks;
SELECT 'issues', COUNT(*) FROM issues;
SELECT 'messages', COUNT(*) FROM messages;
SELECT 'chunks', COUNT(*) FROM chunks;
SELECT 'embeddings', COUNT(*) FROM chunks WHERE embedding IS NOT NULL;
SQL
```
Expected (oracle UI snapshot 2026-05-12) :
- `projects` ≥ 23
- `notes` = 254
- `chunks` = 248
- `embeddings` = 468

Si écart significatif, **STOP** et investiguer avant de continuer le refactor.

- [ ] **Step 5 : Capturer l'état test/build avant rename**

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
```
Expected : tous les checks passent. Si l'un échoue, **STOP** — résoudre le problème pré-existant avant de toucher au rename.

- [ ] **Step 6 : Pas de commit ici** — l'état pré-refactor est juste la branche `refactor/rename-gerber-caserne` au HEAD identique à `main`.

---

### Task 2 : Stopper les services launchd qui pointent sur le dossier

**Files:**
- Read: `~/Library/LaunchAgents/com.recarnot.agent-brain.plist`
- Read: `~/Library/LaunchAgents/com.recarnot.gerber-brain.plist`

- [ ] **Step 1 : Identifier les services actifs**

```bash
launchctl list | grep -E "(agent-brain|gerber-brain)"
```
Expected : 1-3 lignes selon les plists chargés.

- [ ] **Step 2 : Unload tous les services gerber/agent-brain**

```bash
launchctl unload ~/Library/LaunchAgents/com.recarnot.agent-brain.plist 2>/dev/null || true
launchctl unload ~/Library/LaunchAgents/com.recarnot.gerber-brain.plist 2>/dev/null || true
launchctl unload ~/Library/LaunchAgents/com.recarnot.gerber-brain.purger.plist 2>/dev/null || true
launchctl unload ~/Library/LaunchAgents/com.recarnot.gerber-brain.querylog-purge.plist 2>/dev/null || true
```
Expected : aucune erreur visible (le `|| true` swallow les "Could not find specified service" si déjà unloaded).

- [ ] **Step 3 : Vérifier que la DB n'est plus verrouillée**

```bash
lsof ~/.config/gerber/gerber.db 2>/dev/null && echo "STILL LOCKED" || echo "DB free"
```
Expected : `DB free`. Si `STILL LOCKED`, identifier le PID (`lsof ~/.config/gerber/gerber.db | awk 'NR==2 {print $2}'`) et arrêter le process.

- [ ] **Step 4 : Pas de commit** (changements OS, hors VCS).

---

### Task 3 : Renommer le dossier local et reconfigurer les paths Claude Code

**Files:**
- Move: `/Users/recarnot/dev/agent-brain/` → `/Users/recarnot/dev/gerber-caserne/`
- Modify: `~/.claude.json` (si référence au path existe)

- [ ] **Step 1 : Renommer le dossier**

```bash
cd /Users/recarnot/dev
mv agent-brain gerber-caserne
cd gerber-caserne
pwd
```
Expected : `/Users/recarnot/dev/gerber-caserne`

- [ ] **Step 2 : Vérifier qu'aucun lien symbolique cassé ne pointe sur l'ancien path**

```bash
find ~ -maxdepth 4 -type l -lname '*agent-brain*' 2>/dev/null
```
Expected : aucune sortie (ou si sortie, recréer le lien vers le nouveau path).

- [ ] **Step 3 : Mettre à jour `~/.claude.json` si nécessaire**

```bash
grep -n 'agent-brain' ~/.claude.json 2>/dev/null || echo "no reference"
```
Si des références existent, les corriger :
```bash
# Backup puis remplacer
cp ~/.claude.json ~/.claude.json.bak-pre-rename
sed -i '' 's|/Users/recarnot/dev/agent-brain|/Users/recarnot/dev/gerber-caserne|g' ~/.claude.json
```
Expected : `no reference` OU diff de path corrigé.

- [ ] **Step 4 : Pas de commit** (le dossier renommé est implicite côté Git via `cd`).

---

### Task 4 : Renommer le package racine `package.json`

**Files:**
- Modify: `/Users/recarnot/dev/gerber-caserne/package.json`

- [ ] **Step 1 : Mettre à jour le champ `name`**

```bash
sed -i '' 's|"name": "agent-brain-workspace"|"name": "gerber-caserne"|' package.json
```

- [ ] **Step 2 : Mettre à jour tous les `pnpm --filter @agent-brain/*` dans `scripts`**

```bash
sed -i '' 's|@agent-brain/|@gerber-caserne/|g' package.json
```

- [ ] **Step 3 : Vérifier le diff**

```bash
git diff package.json
```
Expected : `name` corrigé + 6 lignes `--filter @agent-brain/*` → `@gerber-caserne/*` dans les scripts `dev`, `serve`, `build`, `tui`, `tui:build`.

- [ ] **Step 4 : Pas encore de commit** (état intermédiaire : le root référence `@gerber-caserne/*` mais les packages s'appellent encore `@agent-brain/*`. Le projet ne build pas pour l'instant).

---

### Task 5 : Renommer les 4 packages internes (`packages/{mcp,shared,ui,tui}/package.json`)

**Files:**
- Modify: `packages/mcp/package.json`, `packages/shared/package.json`, `packages/ui/package.json`, `packages/tui/package.json`

- [ ] **Step 1 : Sed global sur tous les `package.json` des sous-packages**

```bash
find packages -maxdepth 2 -name 'package.json' -exec sed -i '' 's|@agent-brain/|@gerber-caserne/|g' {} \;
```
Ceci renomme :
- Le champ `name` de chaque package (`@agent-brain/mcp` → `@gerber-caserne/mcp`, etc.)
- Les dépendances inter-packages (`@agent-brain/shared: workspace:*` → `@gerber-caserne/shared: workspace:*`)

- [ ] **Step 2 : Vérifier le diff sur chaque package**

```bash
git diff packages/*/package.json
```
Expected :
- `packages/mcp/package.json` : `name` modifié + 1 dep
- `packages/shared/package.json` : `name` modifié uniquement
- `packages/ui/package.json` : `name` modifié + 1 dep
- `packages/tui/package.json` : `name` modifié + 1 dep

- [ ] **Step 3 : Pas encore de commit** (les imports source pointent encore vers `@agent-brain/*`).

---

### Task 6 : Renommer le binaire CLI `agent-brain` → `gerber-mcp`

**Files:**
- Modify: `packages/mcp/package.json` (champ `bin`)

> **Rationale** : le binaire actuel s'appelle `agent-brain` (utilisé en CLI direct, ex. `npx agent-brain --help`). Le renommer en `gerber-mcp` est cohérent avec le nom du container Docker cible et lève la dette de naming. Si jamais quelqu'un dépend de `agent-brain` en CLI (peu probable, single-user), c'est un breaking change attendu en v2.0.0.

- [ ] **Step 1 : Vérifier l'état actuel du champ `bin`**

```bash
grep -A1 '"bin":' packages/mcp/package.json
```
Expected : `"bin": { "agent-brain": "./dist/index.js" }`

- [ ] **Step 2 : Renommer**

```bash
sed -i '' 's|"agent-brain": "./dist/index.js"|"gerber-mcp": "./dist/index.js"|' packages/mcp/package.json
```

- [ ] **Step 3 : Vérifier**

```bash
git diff packages/mcp/package.json | grep -A1 'bin'
```
Expected : nouvelle ligne `"gerber-mcp": "./dist/index.js"`.

- [ ] **Step 4 : Vérifier qu'aucun fichier source ne hardcode le nom binaire**

```bash
grep -rn '"agent-brain"' packages --include='*.ts' --include='*.tsx' 2>/dev/null
```
Expected : aucune sortie. Si sortie, lister et corriger au cas par cas (peu probable).

- [ ] **Step 5 : Pas de commit**.

---

### Task 7 : Sed global des imports source `@agent-brain/*` → `@gerber-caserne/*`

**Files:**
- Modify: ~44 fichiers TS/TSX dans `packages/{mcp,shared,ui,tui}/src/**/*`

- [ ] **Step 1 : Lister les fichiers source à modifier (sanity check)**

```bash
grep -rl '@agent-brain/' packages --include='*.ts' --include='*.tsx' --include='*.json' 2>/dev/null | sort > /tmp/files-to-rewrite.txt
wc -l /tmp/files-to-rewrite.txt
cat /tmp/files-to-rewrite.txt | head -10
```
Expected : ~44 fichiers (les `package.json` ont déjà été traités en Task 5, ils peuvent rester listés pour info).

- [ ] **Step 2 : Sed atomique sur les fichiers TS/TSX source**

```bash
grep -rl '@agent-brain/' packages --include='*.ts' --include='*.tsx' 2>/dev/null | \
  xargs sed -i '' 's|@agent-brain/|@gerber-caserne/|g'
```

- [ ] **Step 3 : Vérifier qu'il ne reste aucune occurrence dans le code source**

```bash
grep -rn '@agent-brain/' packages --include='*.ts' --include='*.tsx' 2>/dev/null
```
Expected : aucune sortie.

- [ ] **Step 4 : Vérifier le diff (sanity)**

```bash
git diff --stat packages/ | head -20
```
Expected : ~44 fichiers modifiés, chacun avec 1-3 lignes changées.

- [ ] **Step 5 : Pas encore de commit** (tsup.config.ts pas encore mis à jour).

---

### Task 8 : Mettre à jour `tsup.config.ts` (MCP)

**Files:**
- Modify: `packages/mcp/tsup.config.ts`

- [ ] **Step 1 : Mettre à jour `noExternal`**

```bash
sed -i '' "s|'@agent-brain/shared'|'@gerber-caserne/shared'|" packages/mcp/tsup.config.ts
```

- [ ] **Step 2 : Vérifier**

```bash
grep noExternal packages/mcp/tsup.config.ts
```
Expected : `noExternal: ['@gerber-caserne/shared'],`

- [ ] **Step 3 : Vérifier qu'il ne reste plus aucune référence `@agent-brain/` dans le code+config (hors docs)**

```bash
grep -rn '@agent-brain/' \
  --include='*.ts' --include='*.tsx' --include='*.json' --include='*.toml' \
  packages/ package.json 2>/dev/null
```
Expected : aucune sortie.

- [ ] **Step 4 : Pas de commit**.

---

### Task 9 : Mettre à jour `CLAUDE.md`

**Files:**
- Modify: `/Users/recarnot/dev/gerber-caserne/CLAUDE.md`

- [ ] **Step 1 : Lire le `CLAUDE.md` actuel**

```bash
head -30 CLAUDE.md
```

- [ ] **Step 2 : Remplacer le titre et toute mention `agent-brain`**

```bash
sed -i '' 's|# CLAUDE.md — agent-brain|# CLAUDE.md — gerber-caserne|' CLAUDE.md
sed -i '' 's|@agent-brain/|@gerber-caserne/|g' CLAUDE.md
sed -i '' 's|`agent-brain`|`gerber-caserne`|g' CLAUDE.md
# Ne PAS remplacer "agent-brain" dans le slug Gerber existant — la section §Gerber dit "Ce projet est indexé dans gerber sous le slug agent-brain"
# On laisse le slug Gerber tel quel (changement de slug = retravail séparé sur le coffre Gerber)
```

- [ ] **Step 3 : Vérifier le diff**

```bash
git diff CLAUDE.md
```
Expected : titre corrigé + références packages corrigées. Le slug `agent-brain` du §Gerber reste intact (à traiter dans un futur ticket si besoin).

- [ ] **Step 4 : Pas de commit**.

---

### Task 10 : Mettre à jour `README.md`

**Files:**
- Modify: `/Users/recarnot/dev/gerber-caserne/README.md`

- [ ] **Step 1 : Identifier les occurrences**

```bash
grep -n 'agent-brain' README.md
```

- [ ] **Step 2 : Remplacer les références au nom de projet (pas les références historiques explicites)**

```bash
# Lecture manuelle requise : ouvrir README.md, remplacer les mentions de package/projet
# en gardant éventuellement une note historique en bas si pertinent.
# Pour un rename mécanique, sed simple :
sed -i '' 's|@agent-brain/|@gerber-caserne/|g' README.md
sed -i '' 's|`agent-brain`|`gerber-caserne`|g' README.md
sed -i '' 's|agent-brain-workspace|gerber-caserne|g' README.md
```

- [ ] **Step 3 : Vérifier**

```bash
git diff README.md
```

- [ ] **Step 4 : Pas de commit**.

---

### Task 11 : Reinstall + Typecheck + Test + Build (verification gate)

**Files:** none modified, this is the verification step.

- [ ] **Step 1 : Réinstaller les `node_modules` (les noms de packages workspace ont changé)**

```bash
rm -rf node_modules packages/*/node_modules
pnpm install
```
Expected : `Done in Xs`. Les workspace links pointent désormais sur `@gerber-caserne/*`.

- [ ] **Step 2 : Typecheck**

```bash
pnpm typecheck
```
Expected : 0 erreur. Si erreur "Cannot find module '@agent-brain/...'", il reste une référence non-traitée — repasser le `grep` du Step 3 de Task 8.

- [ ] **Step 3 : Tests**

```bash
pnpm test
```
Expected : tous les tests passent, identiques au compte pré-refactor (Task 1, Step 5).

- [ ] **Step 4 : Build**

```bash
pnpm build
```
Expected : build MCP produit `packages/mcp/dist/index.js` sans erreur.

- [ ] **Step 5 : Vérifier que le binaire CLI nouveau nom est généré**

```bash
ls packages/mcp/dist/
node packages/mcp/dist/index.js --help 2>&1 | head -10
```
Expected : `dist/index.js` existe, exécution sans crash (peut afficher l'aide ou démarrer en mode dégradé sans DB — c'est OK).

- [ ] **Step 6 : Pas de commit ici** (commit final après smoke test runtime en Task 12).

---

### Task 12 : Smoke test runtime — MCP local démarre + DB intacte

**Files:** none modified.

- [ ] **Step 1 : Démarrer le MCP local en mode stdio (smoke test rapide)**

```bash
GERBER_DATA_DIR="$HOME/.config/gerber" node packages/mcp/dist/index.js --help 2>&1 | head -20
```
Expected : pas de crash, aide affichée.

- [ ] **Step 2 : Vérifier l'intégrité de la DB (rien n'a été touché mais on confirme)**

```bash
sqlite3 ~/.config/gerber/gerber.db "PRAGMA integrity_check;"
```
Expected : `ok`.

- [ ] **Step 3 : Re-snapshot des counts et comparer**

```bash
sqlite3 ~/.config/gerber/gerber.db <<'SQL' | tee /tmp/gerber-post-rename-snapshot.txt
SELECT 'projects', COUNT(*) FROM projects;
SELECT 'notes', COUNT(*) FROM notes;
SELECT 'tasks', COUNT(*) FROM tasks;
SELECT 'issues', COUNT(*) FROM issues;
SELECT 'messages', COUNT(*) FROM messages;
SELECT 'chunks', COUNT(*) FROM chunks;
SQL

diff /tmp/gerber-pre-rename-snapshot.txt /tmp/gerber-post-rename-snapshot.txt
```
Expected : diff vide (aucune différence).

- [ ] **Step 4 : Vérifier qu'aucune référence orpheline `agent-brain` ne traîne dans le code source ou config (hors docs/specs/_gerber_)**

```bash
grep -rn 'agent-brain' \
  --include='*.ts' --include='*.tsx' --include='*.json' --include='*.toml' \
  packages/ package.json CLAUDE.md README.md tsconfig.base.json 2>/dev/null
```
Expected : aucune sortie. Si sortie, traiter au cas par cas.

- [ ] **Step 5 : Pas de commit ici** (commit unique en Task 13).

---

### Task 13 : Commit atomique du refactor

**Files:** staging area.

- [ ] **Step 1 : Vérifier ce qui sera commité**

```bash
git status
git diff --stat HEAD
```
Expected : ~50 fichiers modifiés (5 package.json + 1 tsup.config.ts + ~44 sources + CLAUDE.md + README.md + pnpm-lock.yaml).

- [ ] **Step 2 : Stager tout**

```bash
git add -A
git status
```
Expected : tous les fichiers staged, aucun "Untracked".

- [ ] **Step 3 : Commit avec message descriptif**

```bash
git commit -m "$(cat <<'EOF'
refactor: rename agent-brain workspace → gerber-caserne

Align all internal naming with the Git repo name (gerber-caserne) and
the upcoming Docker image / plugin distribution. No behavior change,
no schema migration, no data touched.

Changes:
- Root workspace: agent-brain-workspace → gerber-caserne
- Packages: @agent-brain/{mcp,shared,ui,tui} → @gerber-caserne/{...}
- CLI bin: agent-brain → gerber-mcp
- pnpm scripts, tsup config, source imports (~44 files)
- CLAUDE.md, README.md
- Folder rename: /Users/recarnot/dev/agent-brain → gerber-caserne

Preserved as-is:
- Plugin name (gerber), skill names (gerber:*), MCP tools (mcp__gerber__*)
- User data path (~/.config/gerber/), SQLite DB, embeddings
- Cargo admin package (already named gerber-admin)
- Gerber slug "agent-brain" (separate vault rename ticket)

Spec: docs/superpowers/specs/2026-05-12-gerber-plugin-vps-migration-design.md §11.0
Plan: docs/superpowers/plans/2026-05-12-p-1-rename-agent-brain-to-gerber-caserne.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 4 : Vérifier le commit**

```bash
git log --oneline -3
git show --stat HEAD | head -20
```
Expected : commit visible avec le bon message et le bon nombre de fichiers.

- [ ] **Step 5 : Re-run la verification gate post-commit**

```bash
pnpm typecheck && pnpm test && pnpm build
```
Expected : tous passent. Aucune régression post-commit.

---

### Task 14 : Merge sur `main` + push

**Files:** Git history.

- [ ] **Step 1 : Repasser sur `main` et vérifier l'état**

```bash
git checkout main
git status
git log --oneline -3
```

- [ ] **Step 2 : Merge fast-forward de la branche refactor**

```bash
git merge --ff-only refactor/rename-gerber-caserne
```
Expected : `Fast-forward` + le nouveau commit visible sur `main`.

- [ ] **Step 3 : Push origin**

```bash
git push origin main
```
Expected : push réussi.

- [ ] **Step 4 : Supprimer la branche locale**

```bash
git branch -d refactor/rename-gerber-caserne
```
Expected : `Deleted branch refactor/rename-gerber-caserne`.

- [ ] **Step 5 : Validation finale**

```bash
git log --oneline -3
pnpm typecheck && pnpm test && pnpm build
```
Expected : commit sur `main`, tous les checks passent.

---

## Post-plan : checklist de fin

- [ ] La DB locale `~/.config/gerber/gerber.db` est intacte (counts pré/post identiques).
- [ ] Le backup `~/.config/gerber.bak-pre-rename-YYYYMMDD/` existe (à conserver au moins jusqu'à la fin de P2).
- [ ] Le serveur MCP local n'est plus chargé via launchd (`launchctl list | grep gerber` retourne vide ou seulement les services non-gerber).
- [ ] Le dossier local est bien `/Users/recarnot/dev/gerber-caserne/`.
- [ ] Aucune référence `@agent-brain/` ne traîne dans le code source (`grep -rn '@agent-brain/' packages/ package.json` retourne vide).
- [ ] La branche `refactor/rename-gerber-caserne` est mergée et supprimée localement.
- [ ] `pnpm typecheck && pnpm test && pnpm build` passent sur `main`.

**Si tout est vert : P-1 est complète, on peut enchaîner avec le plan P0 (préparation Docker MCP).**

**En cas de problème** : rollback simple via `git checkout main && git reset --hard origin/main` puis `mv /Users/recarnot/dev/gerber-caserne /Users/recarnot/dev/agent-brain` puis `pnpm install`. La DB n'a pas été touchée → aucune perte possible.

---

## Risques résiduels

| Risque | Détection | Mitigation |
|--------|-----------|------------|
| Cache pnpm stale après rename | Erreurs "Cannot find module @gerber-caserne/*" malgré install | `pnpm store prune && rm -rf node_modules packages/*/node_modules && pnpm install` |
| Hardcoded path dans un test (unlikely) | `pnpm test` échoue avec un path `agent-brain` | Grep des tests, corriger manuellement |
| Référence `agent-brain` dans un fichier non-TS/TSX/JSON (ex: `.env`, scripts shell) | Build échoue de manière obscure | Task 8 step 3 vise les extensions principales ; étendre `grep` si besoin (`--include='*.sh'`, `--include='*.env'`) |
| Plist launchd recharge automatiquement le service au prochain reboot | `launchctl list \| grep gerber` non-vide après reboot | OK temporairement, sera nettoyé en P4 (suppression définitive des plists) |
| `~/.claude.json` contient un autre chemin que `/Users/recarnot/dev/agent-brain` | Claude Code ne trouve plus le projet | Task 3 step 3 fait le sed ; si chemin différent, ajuster manuellement |
