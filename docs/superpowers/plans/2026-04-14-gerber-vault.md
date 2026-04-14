# gerber-vault Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le cold storage NotebookLM par un vault git local (`~/.config/gerber-vault/`) avec skill + agent Sonnet.

**Architecture:** Une skill `/gerber-vault` orchestre 4 sous-commandes. `archive` et `index` sont delegues a un agent Sonnet en background. `search` et `status` s'executent dans le contexte principal. Le vault est un repo git prive avec index a deux niveaux.

**Tech Stack:** Markdown (skills/agents), git, bash, grep

**Spec:** `docs/superpowers/specs/2026-04-14-gerber-vault-design.md`

---

### Task 1: Creer l'agent gerber-agent-vault

**Files:**
- Create: `~/.claude/agents/gerber-agent-vault.md`

- [ ] **Step 1: Ecrire l'agent**

```markdown
---
name: "gerber-agent-vault"
description: "Agent d'archivage pour gerber-vault. Copie des fichiers dans le vault git, genere les INDEX.md, commit et push. Operations : archive, index."
tools: Bash, Read, Write, Glob, Grep
model: sonnet
color: green
---

Tu es un agent specialise dans l'archivage de documents vers le vault git (`~/.config/gerber-vault/`).
Tu recois une operation a executer avec tous les parametres necessaires. Suis les etapes EXACTEMENT, sans improviser.

## Regles absolues

- Utilise `trash` pour supprimer, jamais `rm`
- Utilise des chemins absolus
- Ne JAMAIS supprimer un fichier du vault sans instruction explicite
- Communique en francais
- Sois concis et operationnel

## Operation : archive

Parametres recus : `SLUG`, `FICHIERS` (liste de chemins absolus), `REPO_ROOT` (racine du repo source)

1. Verifier que le vault existe :
```bash
test -d ~/.config/gerber-vault/.git && echo "OK" || echo "MISSING"
```
Si MISSING → affiche "Vault non initialise" et STOPPE.

2. Creer le dossier projet si necessaire :
```bash
mkdir -p ~/.config/gerber-vault/${SLUG}
```

3. Pour CHAQUE fichier :
   - Calculer le chemin relatif par rapport a `REPO_ROOT`
   - Creer les sous-dossiers necessaires dans le vault
   - Copier le fichier :
```bash
mkdir -p "$(dirname ~/.config/gerber-vault/${SLUG}/${REL_PATH})"
cp "${FICHIER}" "~/.config/gerber-vault/${SLUG}/${REL_PATH}"
```

4. Generer `${SLUG}/INDEX.md` :
   - Lire le INDEX.md existant s'il y a
   - Pour chaque fichier nouvellement archive : extraire la description (titre H1 ou premiere ligne non-vide, tronquer a 80 chars)
   - Ajouter les nouvelles entrees (skip si le chemin existe deja dans l'index)
   - Ecrire le INDEX.md avec le format :
```markdown
# ${SLUG}

| Fichier | Description | Date |
|---------|-------------|------|
| chemin/relatif/fichier.md | Description extraite | 2026-04-14 |
```

5. Regenerer `INDEX.md` global :
   - Scanner tous les dossiers projet dans le vault
   - Pour chaque projet : compter les fichiers dans son INDEX.md
   - Ecrire :
```markdown
# Gerber Vault

| Projet | Fichiers | Derniere archive |
|--------|----------|------------------|
| agent-brain | 12 | 2026-04-14 |
```

6. Commit et push :
```bash
cd ~/.config/gerber-vault && git add -A && git commit -m "archive(${SLUG}): ${NB} fichiers" && git push
```

7. Afficher le resume :
```
Archive terminee :
  Projet : ${SLUG}
  Ajoutes : X fichiers
  Skippes : Y (deja presents)
  Total vault : Z fichiers
```

## Operation : index

Parametres recus : aucun (regeneration complete)

1. Scanner tous les dossiers projet dans `~/.config/gerber-vault/`
2. Pour chaque projet :
   - Lister tous les fichiers (hors INDEX.md, .git)
   - Extraire la description de chaque fichier
   - Ecrire le INDEX.md projet
3. Regenerer INDEX.md global
4. Commit et push
5. Afficher le resume
```

- [ ] **Step 2: Verifier la syntaxe du frontmatter**

Relire le fichier et verifier que le YAML frontmatter est valide (name, description, tools, model, color).

- [ ] **Step 3: Commit**

```bash
cd ~/.claude && git add agents/gerber-agent-vault.md && git commit -m "feat: add gerber-agent-vault agent for git-based cold storage"
```

---

### Task 2: Creer la skill gerber-vault

**Files:**
- Create: `~/.claude/skills/gerber-vault/SKILL.md`

- [ ] **Step 1: Creer le dossier skill**

```bash
mkdir -p ~/.claude/skills/gerber-vault
```

- [ ] **Step 2: Ecrire la skill**

```markdown
---
name: gerber-vault
description: "Vault d'archives cross-projets via repo git. Sous-commandes : archive, search, status, index."
user-invocable: true
---

# gerber-vault

Vault d'archives cross-projets dans un repo git prive (`~/.config/gerber-vault/`).
Delegue l'archivage a l'agent `gerber-agent-vault` (Sonnet).

## Arguments

```
/gerber-vault <commande> [args...]
```

| Commande | Description |
|----------|-------------|
| `archive <dossier \| fichier1 fichier2 ...>` | Archiver des docs dans le vault |
| `search <query>` | Chercher dans le vault par grep |
| `status` | Stats du vault |
| `index` | Regenerer les INDEX.md |

## Resolution du slug

Lire `.gerber-slug` a la racine du repo courant.
Si absent, lire le `CLAUDE.md` et chercher une section `## Gerber` contenant un slug.
Fallback : `basename "$PWD"`.

## Verification vault

Avant toute operation, verifier que `~/.config/gerber-vault/.git` existe.
Si absent → afficher "Vault non initialise. Clone le repo dans ~/.config/gerber-vault/" et STOPPER.

---

## Sous-commande : `archive`

### Pre-traitement (contexte principal)

1. Resoudre le slug projet
2. Resoudre la liste de fichiers :
   - Si l'argument est un **dossier** : lister tous les fichiers recursivement
   - Si les arguments sont des **fichiers** : utiliser la liste telle quelle
   - Convertir tous les chemins en **chemins absolus**
3. Determiner la racine du repo source (`git rev-parse --show-toplevel` ou `$PWD`)
4. Afficher "Archivage lance en background..."

### Delegation a l'agent

Lancer l'agent `gerber-agent-vault` en **background** (`run_in_background: true`) :

```
Operation : archive
Slug : ${SLUG}
Repo root : ${REPO_ROOT}
Fichiers :
- ${FICHIER_1}
- ${FICHIER_2}
...
```

### Apres retour de l'agent

- Afficher le resume retourne par l'agent
- Demander via AskUserQuestion : "Fichiers archives. Tu veux que je supprime les originaux du repo ?"
- Si oui → supprimer avec `trash` (jamais `rm`)
- Si non → ne rien faire

---

## Sous-commande : `search`

Execution dans le contexte principal (pas d'agent).

1. Lancer un grep dans le vault :
```bash
grep -ri "<query>" ~/.config/gerber-vault/ --include="*.md" --include="*.txt" --include="*.json" --include="*.csv" -C 2
```
2. Filtrer les lignes provenant de INDEX.md et .git/
3. Grouper les resultats par projet (dossier de premier niveau)
4. Afficher les resultats

---

## Sous-commande : `status`

Execution dans le contexte principal (pas d'agent).

1. Lire `~/.config/gerber-vault/INDEX.md`
2. Si absent → "Vault vide ou non initialise"
3. Sinon → afficher le contenu du INDEX.md global

---

## Sous-commande : `index`

### Delegation a l'agent

Lancer l'agent `gerber-agent-vault` en **background** :

```
Operation : index
```

### Apres retour de l'agent

Afficher le resume.

---

## Contraintes absolues

- Ne JAMAIS supprimer un fichier du vault sans confirmation explicite de l'utilisateur
- Utiliser `trash` pour toute suppression, jamais `rm`
```

- [ ] **Step 3: Commit**

```bash
cd ~/.claude && git add skills/gerber-vault/SKILL.md && git commit -m "feat: add gerber-vault skill for git-based cold storage"
```

---

### Task 3: Nettoyer l'ancien cold storage

**Files:**
- Delete: `~/.claude/skills/gerber-cold-storage/SKILL.md`
- Delete: `~/.claude/agents/gerber-agent-notebook.md`
- Modify: `~/.claude/projects/-Users-recarnot-dev-agent-brain/memory/MEMORY.md`
- Modify: `~/.claude/projects/-Users-recarnot-dev-agent-brain/memory/reference_gerber-skills.md`

- [ ] **Step 1: Supprimer l'ancienne skill**

```bash
trash ~/.claude/skills/gerber-cold-storage/
```

- [ ] **Step 2: Supprimer l'ancien agent**

```bash
trash ~/.claude/agents/gerber-agent-notebook.md
```

- [ ] **Step 3: Supprimer .gerber-nlm du repo agent-brain**

```bash
trash /Users/recarnot/dev/agent-brain/.gerber-nlm
```

- [ ] **Step 4: Mettre a jour les memoires**

Mettre a jour `reference_gerber-skills.md` : remplacer la reference `gerber-cold-storage` / `gerber-agent-notebook` par `gerber-vault` / `gerber-agent-vault`.

Mettre a jour `MEMORY.md` si necessaire.

- [ ] **Step 5: Commit**

```bash
cd /Users/recarnot/dev/agent-brain && git add -A && git commit -m "chore: remove .gerber-nlm, update references for gerber-vault"
```

---

### Task 4: Test end-to-end

- [ ] **Step 1: Verifier le vault**

```bash
test -d ~/.config/gerber-vault/.git && echo "OK"
```

- [ ] **Step 2: Tester `/gerber-vault status`**

Doit afficher "Vault vide ou non initialise" (pas encore d'INDEX.md global).

- [ ] **Step 3: Tester `/gerber-vault archive .memory/`**

Depuis `/Users/recarnot/dev/agent-brain`, archiver le dossier `.memory/`.
Verifier :
- Les 4 fichiers sont copies dans `~/.config/gerber-vault/agent-brain/.memory/`
- `agent-brain/INDEX.md` est genere avec 4 entrees
- `INDEX.md` global est genere avec 1 projet
- Un commit git est cree et pushed

- [ ] **Step 4: Tester `/gerber-vault search architecture`**

Doit retourner des resultats depuis `agent-brain/.memory/architecture.md`.

- [ ] **Step 5: Tester `/gerber-vault status`**

Doit afficher le tableau avec agent-brain, 4 fichiers, date du jour.

- [ ] **Step 6: Tester la deduplication**

Relancer `/gerber-vault archive .memory/` et verifier que les 4 fichiers sont skippes (deja presents).
