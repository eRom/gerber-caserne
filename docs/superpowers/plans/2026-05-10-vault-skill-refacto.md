# Vault Skill Refacto Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the gerber `vault` skill to make `INDEX.md` always reflect actual content, prevent ghost project folders, distinguish push errors from "no remote", and add a `clean` subcommand.

**Architecture:** Three shared sub-routines (`regenIndexProjet`, `regenIndexGlobal`, `commitAndPush`) introduced in the agent doc. All vault operations are rewritten to use them. New subcommand `clean` removes empty project folders. Doc-only changes (markdown agent prompt + skill doc), no executable code.

**Tech Stack:** Markdown (agent + skill prompts), bash (pseudo-code shown to the agent for git operations), gerber plugin (1.4.0 → 1.5.0).

**Spec:** `docs/superpowers/specs/2026-05-10-vault-skill-refacto-design.md`

---

## File Structure

| Path | Action | Responsibility |
|---|---|---|
| `agents/agent-vault.md` | Modify | Sub-routines + refactored operations + new `clean` |
| `skills/vault/SKILL.md` | Modify | User-facing subcommand table, pre-flight doc, summary format |
| `.claude-plugin/plugin.json` | Modify | Bump version to 1.5.0 |

No new files. Single-source design — everything lives in the existing files.

---

## Task 1: Insert `regenIndexProjet(slug)` sub-routine

**Files:**
- Modify: `agents/agent-vault.md`

Insert a new section between the "Etape 0" block and "Operation : archive" header.

- [ ] **Step 1: Read current file to confirm location**

Run: `head -30 agents/agent-vault.md`
Expected: see "## Etape 0 — Verification du vault" section followed by "## Operation : archive".

- [ ] **Step 2: Insert sub-routines header + first sub-routine**

Use Edit on `agents/agent-vault.md`. Find the line `## Operation : archive` and replace it with:

```markdown
## Sous-routines partagees

Trois routines reutilisees par les operations. Definies une fois ici, appelees par nom dans les operations.

### `regenIndexProjet(slug)`

Reconstruit `~/.config/gerber-vault/<slug>/INDEX.md` from-scratch a partir du contenu reel du dossier projet. Idempotent.

```bash
PROJECT_DIR="$HOME/.config/gerber-vault/<slug>"
INDEX_FILE="$PROJECT_DIR/INDEX.md"

# Liste tous les fichiers (hors INDEX.md), ordre stable (sort)
FILES=$(find "$PROJECT_DIR" -type f ! -name "INDEX.md" | sort)

# Header
{
  echo "# Index — <slug>"
  echo ""
  echo "| Fichier | Description | Date |"
  echo "|---------|-------------|------|"
} > "$INDEX_FILE"

# Une ligne par fichier
for f in $FILES; do
  REL=$(python3 -c "import os; print(os.path.relpath('$f', '$PROJECT_DIR'))")
  NAME=$(basename "$f")
  # Description : premiere ligne non vide, tronquee a 80 chars
  DESC=$(awk 'NF{print; exit}' "$f" | head -c 80)
  # Date : mtime au format YYYY-MM-DD
  DATE=$(date -r "$f" +%Y-%m-%d)
  echo "| [$NAME]($REL) | $DESC | $DATE |" >> "$INDEX_FILE"
done
```

## Operation : archive
```

- [ ] **Step 3: Verify the insertion**

Run: `grep -n "regenIndexProjet" agents/agent-vault.md`
Expected: at least 2 matches (one in the section header, one in subsequent operation calls — but at this stage, only the definition exists, so 1 match expected).

- [ ] **Step 4: Commit**

```bash
git add agents/agent-vault.md
git commit -m "refacto(vault): introduce regenIndexProjet sub-routine"
```

---

## Task 2: Add `regenIndexGlobal()` sub-routine

**Files:**
- Modify: `agents/agent-vault.md`

- [ ] **Step 1: Insert after `regenIndexProjet`**

Use Edit on `agents/agent-vault.md`. Find:

```markdown
  echo "| [$NAME]($REL) | $DESC | $DATE |" >> "$INDEX_FILE"
done
```

## Operation : archive
```

Replace with:

```markdown
  echo "| [$NAME]($REL) | $DESC | $DATE |" >> "$INDEX_FILE"
done
```

### `regenIndexGlobal()`

Reconstruit `~/.config/gerber-vault/INDEX.md` from-scratch a partir des dossiers projet existants.

```bash
VAULT="$HOME/.config/gerber-vault"
GLOBAL_INDEX="$VAULT/INDEX.md"

{
  echo "# Gerber Vault"
  echo ""
  echo "| Projet | Fichiers | Derniere archive |"
  echo "|--------|----------|------------------|"
} > "$GLOBAL_INDEX"

# Pour chaque dossier projet (non cache)
for d in "$VAULT"/*/; do
  SLUG=$(basename "$d")
  # Compte fichiers hors INDEX.md
  N=$(find "$d" -type f ! -name "INDEX.md" | wc -l | tr -d ' ')
  # Date de derniere modif du <slug>/INDEX.md (s'il existe)
  if [ -f "$d/INDEX.md" ]; then
    DATE=$(date -r "$d/INDEX.md" +%Y-%m-%d)
  else
    DATE="-"
  fi
  echo "| $SLUG | $N | $DATE |" >> "$GLOBAL_INDEX"
done
```

## Operation : archive
```

- [ ] **Step 2: Verify**

Run: `grep -n "regenIndexGlobal" agents/agent-vault.md`
Expected: 1 match (the definition).

- [ ] **Step 3: Commit**

```bash
git add agents/agent-vault.md
git commit -m "refacto(vault): introduce regenIndexGlobal sub-routine"
```

---

## Task 3: Add `commitAndPush(message)` sub-routine

**Files:**
- Modify: `agents/agent-vault.md`

- [ ] **Step 1: Insert after `regenIndexGlobal`**

Use Edit on `agents/agent-vault.md`. Find:

```markdown
  echo "| $SLUG | $N | $DATE |" >> "$GLOBAL_INDEX"
done
```

## Operation : archive
```

Replace with:

```markdown
  echo "| $SLUG | $N | $DATE |" >> "$GLOBAL_INDEX"
done
```

### `commitAndPush(message)`

Stage tout le vault, commit (no-op si rien a commit), push (4 etats distincts).

```bash
cd "$HOME/.config/gerber-vault"
git add -A

# Commit : "nothing to commit" est un cas OK, pas un FAIL
if git diff --cached --quiet; then
  COMMIT_RESULT="no-op"
else
  if git commit -m "<message>"; then
    COMMIT_RESULT="OK"
  else
    COMMIT_RESULT="FAIL"
  fi
fi

# Push : distinguer pas-de-remote / rien-a-push / push-OK / push-FAIL
if ! git remote get-url origin >/dev/null 2>&1; then
  PUSH_RESULT="skipped (no remote)"
elif [ "$(git rev-list --count @{u}..HEAD 2>/dev/null || echo 0)" = "0" ]; then
  PUSH_RESULT="skipped (nothing to push)"
else
  if PUSH_OUTPUT=$(git push 2>&1); then
    PUSH_RESULT="OK"
  else
    PUSH_RESULT="FAIL: $PUSH_OUTPUT"
  fi
fi
```

## Operation : archive
```

- [ ] **Step 2: Verify**

Run: `grep -n "commitAndPush" agents/agent-vault.md`
Expected: 1 match (the definition).

- [ ] **Step 3: Commit**

```bash
git add agents/agent-vault.md
git commit -m "refacto(vault): introduce commitAndPush sub-routine"
```

---

## Task 4: Refactor `archive` operation to use sub-routines + add empty-list pre-flight

**Files:**
- Modify: `agents/agent-vault.md`

- [ ] **Step 1: Read the current archive section**

Run: `awk '/^## Operation : archive/,/^---$/' agents/agent-vault.md`
Expected: see steps 1-6 of the current archive operation.

- [ ] **Step 2: Replace the archive operation**

Use Edit on `agents/agent-vault.md`. Replace the entire block from `## Operation : archive` to the `---` that ends it (the separator before `## Operation : index`) with:

```markdown
## Operation : archive

Parametres recus : `SLUG`, `FICHIERS` (liste de chemins absolus), `REPO_ROOT` (chemin absolu racine du repo source).

### Etape 1 — Pre-flight liste vide

Si `FICHIERS` est vide :

```
echo "Aucun fichier a archiver pour ${SLUG}. Operation annulee."
```

STOPPE l'operation. Ne cree PAS de dossier projet, ne commit PAS.

### Etape 2 — Preparation du dossier projet

```bash
mkdir -p ~/.config/gerber-vault/${SLUG}
echo "Dossier ~/.config/gerber-vault/${SLUG} pret."
```

### Etape 3 — Copie des fichiers

Pour CHAQUE fichier de la liste :

1. Calcule le chemin relatif depuis REPO_ROOT :
```bash
RELATIVE=$(python3 -c "import os; print(os.path.relpath('<CHEMIN_ABSOLU>', '<REPO_ROOT>'))")
```

2. Cree les sous-dossiers si necessaire :
```bash
mkdir -p "$(dirname ~/.config/gerber-vault/${SLUG}/${RELATIVE})"
```

3. Copie le fichier :
```bash
cp "<CHEMIN_ABSOLU>" "~/.config/gerber-vault/${SLUG}/${RELATIVE}"
echo "[COPIE] ${RELATIVE}"
```

### Etape 4 — Regeneration des index

Appelle `regenIndexProjet(${SLUG})` puis `regenIndexGlobal()`.

L'INDEX.md projet et l'INDEX.md global sont reconstruits from-scratch a partir du contenu reel du vault. Plus de dedup par chemin : les dates et descriptions sont toujours a jour.

### Etape 5 — Commit et push

Appelle `commitAndPush("archive(${SLUG}): +<N> fichier(s)")` ou `<N>` est le nombre de fichiers copies a l'etape 3.

### Etape 6 — Resume

Affiche :
```
Archive terminee -- ${SLUG}
---------------------------
Copies   : <N> fichier(s)
Index    : regenere (projet + global)
Commit   : ${COMMIT_RESULT}
Push     : ${PUSH_RESULT}
```

---
```

- [ ] **Step 3: Verify the structure**

Run: `awk '/^## Operation : archive/,/^---$/' agents/agent-vault.md | grep -E "^### Etape"`
Expected: 6 matches (Etape 1 through Etape 6).

- [ ] **Step 4: Commit**

```bash
git add agents/agent-vault.md
git commit -m "refacto(vault): rewrite archive op with sub-routines + empty-list pre-flight"
```

---

## Task 5: Refactor `index` operation to use sub-routines

**Files:**
- Modify: `agents/agent-vault.md`

- [ ] **Step 1: Read the current index section**

Run: `awk '/^## Operation : index/,/^---$/' agents/agent-vault.md`
Expected: see the current 5-step index operation.

- [ ] **Step 2: Replace the index operation**

Use Edit on `agents/agent-vault.md`. Replace the entire block from `## Operation : index` to its terminating `---` with:

```markdown
## Operation : index

Aucun parametre. Regenere tous les INDEX.md depuis le contenu reel du vault.

### Etape 1 — Pre-flight

Verifier que `~/.config/gerber-vault/.git` existe (cf. Etape 0). Sinon STOPPE.

### Etape 2 — Regeneration des INDEX projet

Pour chaque dossier projet trouve via `ls -d ~/.config/gerber-vault/*/` :
- Extraire le slug (`basename`).
- Appeler `regenIndexProjet(slug)`.
- Afficher `[INDEX] <slug> — <N> fichier(s)`.

### Etape 3 — Regeneration de l'INDEX global

Appeler `regenIndexGlobal()`.

### Etape 4 — Commit et push

Appeler `commitAndPush("index: regeneration complete")`.

### Etape 5 — Resume

Affiche :
```
Index regenere
--------------
Projets  : <N>
Fichiers : <T> au total
Commit   : ${COMMIT_RESULT}
Push     : ${PUSH_RESULT}
```

---
```

- [ ] **Step 3: Verify**

Run: `awk '/^## Operation : index/,/^---$/' agents/agent-vault.md | grep -c "regenIndex"`
Expected: 2 (one call to regenIndexProjet, one to regenIndexGlobal).

- [ ] **Step 4: Commit**

```bash
git add agents/agent-vault.md
git commit -m "refacto(vault): rewrite index op with sub-routines"
```

---

## Task 6: Add `clean` operation to agent-vault.md

**Files:**
- Modify: `agents/agent-vault.md`

- [ ] **Step 1: Locate insertion point**

Run: `grep -n "^## " agents/agent-vault.md`
Expected: list of `## ` headings. Identify the last `---` of the file (after the index operation).

- [ ] **Step 2: Append the clean operation at the end of the file**

Use Edit on `agents/agent-vault.md`. Find the final content of the file (after the `index` operation closing `---`) and append:

```markdown

## Operation : clean

Aucun parametre. Supprime les dossiers projet vides du vault.

### Etape 1 — Pre-flight

Verifier que `~/.config/gerber-vault/.git` existe. Sinon STOPPE.

### Etape 2 — Detection

```bash
EMPTY_DIRS=$(find "$HOME/.config/gerber-vault" -mindepth 1 -maxdepth 1 -type d -empty -not -name '.*')
```

Si la liste est vide :
```
echo "Aucun dossier vide a nettoyer."
```
STOPPE.

### Etape 3 — Confirmation utilisateur

Afficher la liste des dossiers detectes (un par ligne, basename uniquement).

Demander confirmation via `AskUserQuestion` :
- Question : "Supprimer ces N dossiers vides du vault ?"
- Options : "Oui, supprimer" / "Non, annuler"

Si "Non" → STOPPE. Aucune modification, aucun commit.

### Etape 4 — Suppression

Pour chaque dossier de `EMPTY_DIRS` :
```bash
rmdir "<dossier>"
echo "[CLEAN] removed <basename>"
```

### Etape 5 — Regeneration de l'INDEX global

Appeler `regenIndexGlobal()` (le tableau ne doit plus contenir les dossiers supprimes).

### Etape 6 — Commit et push

Appeler `commitAndPush("clean: removed <N> empty project folder(s)")`.

### Etape 7 — Resume

Affiche :
```
Clean termine
-------------
Supprimes : <N> dossier(s)
Commit    : ${COMMIT_RESULT}
Push      : ${PUSH_RESULT}
```
```

- [ ] **Step 3: Verify**

Run: `grep -c "^## Operation" agents/agent-vault.md`
Expected: 3 (archive, index, clean).

- [ ] **Step 4: Commit**

```bash
git add agents/agent-vault.md
git commit -m "feat(vault): add clean op to remove empty project folders"
```

---

## Task 7: Update `skills/vault/SKILL.md`

**Files:**
- Modify: `skills/vault/SKILL.md`

- [ ] **Step 1: Update the subcommands table**

Use Edit on `skills/vault/SKILL.md`. Find:

```markdown
| Commande | Description |
|----------|-------------|
| `archive <dossier \| fichier1 fichier2 ...>` | Archiver des fichiers dans le vault |
| `search <query>` | Rechercher dans le vault |
| `status` | Afficher l'index global du vault |
| `index` | Regenerer l'index du vault |
```

Replace with:

```markdown
| Commande | Description |
|----------|-------------|
| `archive <dossier \| fichier1 fichier2 ...>` | Archiver des fichiers dans le vault |
| `search <query>` | Rechercher dans le vault |
| `status` | Afficher l'index global du vault |
| `index` | Regenerer tous les INDEX.md du vault |
| `clean` | Supprimer les dossiers projet vides (avec confirmation) |
```

- [ ] **Step 2: Update the archive pre-traitement to add the empty-list pre-flight**

Use Edit on `skills/vault/SKILL.md`. Find:

```markdown
### Pre-traitement (contexte principal — AVANT de lancer l'agent)

1. **Resoudre le slug** : `_gerber_/.gerber-slug` → section `## Gerber` du `CLAUDE.md` → `basename $PWD`
2. **Resoudre la liste de fichiers** :
   - Si l'argument est un **dossier** : lister recursivement tous les fichiers du dossier (Glob tool)
   - Si les arguments sont des **fichiers** : utiliser la liste telle quelle
   - Convertir tous les chemins en **chemins absolus**
3. **Obtenir la racine du repo** : executer `git rev-parse --show-toplevel` depuis le dossier courant. Si echec (pas un repo git), utiliser `$PWD`.
4. **Verifier le vault** : s'assurer que `~/.config/gerber-vault/.git` existe. Si non → afficher "Vault non initialise. Le dossier `~/.config/gerber-vault/` doit etre un repo git." et STOPPER.
5. Afficher : `Archivage lance en background...`
```

Replace with:

```markdown
### Pre-traitement (contexte principal — AVANT de lancer l'agent)

1. **Resoudre le slug** : `_gerber_/.gerber-slug` → section `## Gerber` du `CLAUDE.md` → `basename $PWD`
2. **Resoudre la liste de fichiers** :
   - Si l'argument est un **dossier** : lister recursivement tous les fichiers du dossier (Glob tool)
   - Si les arguments sont des **fichiers** : utiliser la liste telle quelle
   - Convertir tous les chemins en **chemins absolus**
3. **Pre-flight liste vide** : si la liste resolue est vide, afficher `Aucun fichier a archiver pour <slug>.` et STOPPER. Ne PAS lancer l'agent.
4. **Obtenir la racine du repo** : executer `git rev-parse --show-toplevel` depuis le dossier courant. Si echec (pas un repo git), utiliser `$PWD`.
5. **Verifier le vault** : s'assurer que `~/.config/gerber-vault/.git` existe. Si non → afficher "Vault non initialise. Le dossier `~/.config/gerber-vault/` doit etre un repo git." et STOPPER.
6. Afficher : `Archivage lance en background...`
```

- [ ] **Step 3: Add the `clean` subcommand documentation**

Use Edit on `skills/vault/SKILL.md`. Find:

```markdown
## Sous-commande : `index`

### Delegation a l'agent

Lancer l'agent `gerber:agent-vault` via l'outil `Agent` avec `subagent_type: "gerber:agent-vault"`, `run_in_background: true` et `mode: "bypassPermissions"`.

Afficher au lancement : `Indexation du vault lancee en background...`

Prompt a envoyer :

```
Operation : index
```

### Apres retour de l'agent

Afficher le resume retourne par l'agent.

---

## Contraintes absolues
```

Replace with:

```markdown
## Sous-commande : `index`

### Delegation a l'agent

Lancer l'agent `gerber:agent-vault` via l'outil `Agent` avec `subagent_type: "gerber:agent-vault"`, `run_in_background: true` et `mode: "bypassPermissions"`.

Afficher au lancement : `Indexation du vault lancee en background...`

Prompt a envoyer :

```
Operation : index
```

### Apres retour de l'agent

Afficher le resume retourne par l'agent.

---

## Sous-commande : `clean`

### Delegation a l'agent

Lancer l'agent `gerber:agent-vault` via l'outil `Agent` avec `subagent_type: "gerber:agent-vault"`, `run_in_background: false` et `mode: "bypassPermissions"`.

Pourquoi pas en background : l'agent doit poser une question de confirmation a l'utilisateur via `AskUserQuestion`. Le mode background empecherait cette interaction.

Prompt a envoyer :

```
Operation : clean
```

### Apres retour de l'agent

Afficher le resume retourne par l'agent.

---

## Contraintes absolues
```

- [ ] **Step 4: Verify**

Run: `grep -cE "^## Sous-commande" skills/vault/SKILL.md`
Expected: `5` (archive, search, status, index, clean).

- [ ] **Step 5: Commit**

```bash
git add skills/vault/SKILL.md
git commit -m "docs(vault): document clean op + empty-list pre-flight + new subcommand table"
```

---

## Task 8: Bump plugin version to 1.5.0

**Files:**
- Modify: `.claude-plugin/plugin.json`

- [ ] **Step 1: Edit version field**

Use Edit on `.claude-plugin/plugin.json`. Find:

```json
  "version": "1.4.0",
```

Replace with:

```json
  "version": "1.5.0",
```

- [ ] **Step 2: Verify**

Run: `grep version .claude-plugin/plugin.json`
Expected: `"version": "1.5.0",`

- [ ] **Step 3: Commit**

```bash
git add .claude-plugin/plugin.json
git commit -m "chore(release): bump plugin to 1.5.0 — vault skill refacto"
```

---

## Task 9: Smoke tests (manual)

**Files:**
- None (test the actual skill behavior in a Claude Code session)

These tests verify the refactored agent doc produces the right behavior. They are MANUAL — Claude Code must execute the skill via the running plugin, not from this plan session. Reload the plugin first (or run from the source directory if Claude Code points there).

- [ ] **Step 1: Reload plugin**

Reload Claude Code so the updated plugin source is active. Either:
- `/plugin reload gerber` if available
- Restart the Claude Code session

- [ ] **Step 2: Test empty-list pre-flight**

In a Claude Code session, run:
```
/gerber:vault archive /tmp/empty-dir-that-does-not-exist
```

Expected output: `Aucun fichier a archiver pour <slug>. Operation annulee.`
Expected side-effect: NO new directory created in `~/.config/gerber-vault/`.

Verify: `ls ~/.config/gerber-vault/ | grep -c '<slug>'` should NOT include a new empty folder.

- [ ] **Step 3: Test archive with valid file**

Create a test file:
```bash
echo "# Test smoke 1" > /tmp/vault-smoke-test.md
```

Run from `agent-brain` repo:
```
/gerber:vault archive /tmp/vault-smoke-test.md
```

Expected: file copied, INDEX.md updated with today's date, `agent-brain/INDEX.md` shows mtime = today.

Verify:
```bash
ls ~/.config/gerber-vault/agent-brain/ | grep vault-smoke-test
cat ~/.config/gerber-vault/agent-brain/INDEX.md | grep vault-smoke-test
```

- [ ] **Step 4: Test idempotent re-archive (no-op commit)**

Run the same command again immediately:
```
/gerber:vault archive /tmp/vault-smoke-test.md
```

Expected: `Commit: no-op`, `Push: skipped (nothing to push)`. No spurious FAIL.

- [ ] **Step 5: Test clean op**

Create a fake empty project folder:
```bash
mkdir ~/.config/gerber-vault/__smoke-empty__
```

Run:
```
/gerber:vault clean
```

Expected: agent lists `__smoke-empty__`, asks for confirmation. Confirm "Oui". Folder removed, commit done, push done.

Verify:
```bash
ls ~/.config/gerber-vault/__smoke-empty__ 2>&1
```
Expected: `No such file or directory`.

- [ ] **Step 6: Test push error remontée (optional, harder to set up)**

If you want to test the push error path: temporarily break the remote URL.
```bash
cd ~/.config/gerber-vault && git remote set-url origin https://invalid.example/no.git
```

Run any vault op that produces a commit. Expected: `Push: FAIL: <real error>` instead of `NO_REMOTE`.

Restore:
```bash
cd ~/.config/gerber-vault && git remote set-url origin https://github.com/eRom/gerber-vault.git
```

- [ ] **Step 7: Cleanup smoke artifacts**

```bash
trash /tmp/vault-smoke-test.md
cd ~/.config/gerber-vault && git log --oneline | head -10  # confirm clean state
```

---

## Task 10: Release plugin (use existing release-plugin skill)

**Files:**
- All committed in previous tasks.

- [ ] **Step 1: Verify clean working tree**

Run: `git status`
Expected: `nothing to commit, working tree clean`.

- [ ] **Step 2: Invoke the release-plugin skill**

In Claude Code, invoke `/release-plugin` (the plugin already has this skill configured). The skill will:
- Build `gerber.zip`
- Create git tag (likely `v1.5.0`)
- Push commits + tag

If `release-plugin` does not exist or fails, fall back to manual:
```bash
git tag v1.5.0
git push origin main
git push origin v1.5.0
```

- [ ] **Step 3: Verify the release**

Check GitHub: `https://github.com/eRom/gerber-caserne/releases/tag/v1.5.0`. Confirm the tag is present.

---

## Self-Review

**Spec coverage:**
- Sub-routine `regenIndexProjet` → Task 1 ✅
- Sub-routine `regenIndexGlobal` → Task 2 ✅
- Sub-routine `commitAndPush` → Task 3 ✅
- `archive` empty-list pre-flight + sub-routine usage → Task 4 ✅
- `index` sub-routine usage → Task 5 ✅
- `clean` new operation → Task 6 ✅
- SKILL.md updates (subcommand table, archive pre-flight, clean docs) → Task 7 ✅
- Plugin version bump → Task 8 ✅
- Smoke tests for all edge cases (empty list, idempotent re-archive, clean, push error) → Task 9 ✅
- Release → Task 10 ✅

**Placeholder scan:** No TBDs, no "implement later", every step has the exact content. Smoke tests Task 9 step 6 is marked optional but has full instructions if executed.

**Type/name consistency:**
- `regenIndexProjet(slug)` used consistently across Tasks 1, 4, 5.
- `regenIndexGlobal()` used consistently across Tasks 2, 4, 5, 6.
- `commitAndPush(message)` used consistently across Tasks 3, 4, 5, 6.
- Variables `${SLUG}`, `${COMMIT_RESULT}`, `${PUSH_RESULT}` consistent across operations.

Plan is complete and self-consistent.
