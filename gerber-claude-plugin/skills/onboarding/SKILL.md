---
name: onboarding
description: "Initialise un projet : crée le projet Linear (workspace eRom, team eRom-Agents), configure le repo Git + remote GitHub, le dossier _gerber_/, enregistre le repo dans le vault RAG gerber, et écrit la section `## Linear` dans CLAUDE.md. Déclenche dès que l'utilisateur demande à onboarder/initialiser/configurer un projet."
user-invocable: true
---

# onboarding

**Décisions figées** (ne pas demander) :
- Workspace Linear : `eRom` · Team : `eRom-Agents`
- Owner GitHub : `eRom` · Visibilité : `private`
- `_gerber_/` **versionné** (jamais dans `.gitignore`)
- Enregistrement vault gerber **obligatoire**

## Étape 0 — Préchecks

- **`gh auth status`** → sinon `gh auth login` puis reprendre.
- **MCP gerber** : si `mcp__gerber__rag_onboard` retourne 401, bearer absent (suivre la procédure sops → `~/.claude/settings.json` `env.GERBER_TOKEN` → redémarrer).

## Étape 1 — Détecter le nom de base

Ordre :
1. `git remote get-url origin` → dernier segment sans `.git`.
2. `basename "$PWD"`.
3. Ask user (web/mobile) : « Quel est le nom du projet ? »

Résultat : string brute (typiquement kebab-case).

## Étape 2 — Dériver les deux noms

- **Linear** (Title Case avec espaces) : split sur `-`/`_`/majuscules internes, capitaliser, join avec espace. `agent-brain` → `Agent Brain`.
- **GitHub** (kebab-case lowercase) : split sur majuscules/espaces, lowercase, join avec `-`. `Agent Brain` → `agent-brain`.

## Étape 3 — Vérifier la disponibilité

### Linear
```
mcp__plugin_linear_linear__list_projects({ team: "eRom-Agents", query: "<nom_linear>" })
```
Match si `name` strictement égal (case-insensitive).

### GitHub
```bash
gh repo view eRom/<nom_github> --json name 2>/dev/null
```
Match si exit code 0.

### Conflit
Si l'un OU l'autre existe → demander un autre nom et reboucler étapes 2-3.

## Étape 4 — Confirmation

```
Je vais créer :
  - Linear     : <nom_linear>      (team eRom-Agents)
  - Repository : eRom/<nom_github> (privé)
  - Vault RAG  : OK

On y va ? (oui/non)
```

`non` → terminer.

## Étape 5 — Créer le projet Linear

```
mcp__plugin_linear_linear__save_project({
  name: "<nom_linear>",
  addTeams: ["eRom-Agents"]
})
```

Stocker `id` (UUID) et `url`. Sur erreur : rapporter et **STOPPER** (rien n'est créé localement).

## Étape 6 — Git local + remote GitHub

- `.git/` absent → `git init`.
- `origin` absent → `gh repo create eRom/<nom_github> --private --source=. --remote=origin` (laisse `gh` choisir HTTPS/SSH selon `gh config`).
- `origin` pointe ailleurs → ne PAS écraser, demander à l'utilisateur.

## Étape 7 — `_gerber_/`

```bash
mkdir -p _gerber_
```

Retirer `_gerber_/` du `.gitignore` s'il y figure. Les fichiers `architecture.md`/`key-files.md`/`patterns.md`/`gotchas.md` seront créés à la demande par `/gerber:session-complete`.

## Étape 8 — Enregistrer dans le vault RAG

```
mcp__gerber__rag_onboard({ repo: "eRom/<nom_github>" })
```

Idempotent. Retours : `added` / `already_registered` / erreur (à rapporter, mais ne pas bloquer).

## Étape 9 — Section `## Linear` dans CLAUDE.md

À la racine du repo. Minimale (la team id + workflows sont dans `~/.claude/GERBER.md`) :

```markdown
## Linear

- **Project** : <nom_linear>  (`<project_id>`)
```

- `CLAUDE.md` absent → créer avec `# CLAUDE.md — <nom_linear>` puis la section.
- Section `## Linear` déjà présente → la remplacer par la ligne minimale.
- Sinon → insérer après le titre.

**Ne RIEN écrire d'autre** dans CLAUDE.md (pas de liste skills, pas de stack, pas de section bus — les IDs Airtable sont en contexte global).

## Étape 10 — Commit + push (si modifs)

```bash
git status --porcelain
```

Si vide → skipper. Sinon :

Staging ciblé (PAS de `git add .`) :
```bash
git add CLAUDE.md
# Si .gitignore modifié :
git add .gitignore
```

Si fichiers non-trackés à la racine → demander à l'utilisateur s'il faut les inclure.

```bash
git commit -m "chore: onboard project — CLAUDE.md + Linear"
```

Push :
```bash
CURRENT_BRANCH=$(git branch --show-current)
UPSTREAM=$(git rev-parse --abbrev-ref --symbolic-full-name "@{u}" 2>/dev/null)
```
- `$UPSTREAM` vide → `git push -u origin "$CURRENT_BRANCH"`.
- Sinon → `git push`.

Si push échoue → afficher l'erreur, laisser l'utilisateur résoudre.

## Étape 11 — Récap

```
Projet "<nom_linear>" initialisé.

  [x] Linear        : <project_url>
  [x] GitHub        : https://github.com/eRom/<nom_github>
  [x] _gerber_/     : <PWD>/_gerber_/
  [x] Vault RAG     : <added | already_registered | error>
  [x] CLAUDE.md     : section ## Linear écrite
  [x/skipped] Commit + push : <sha court> sur <branch> (ou "rien à committer")
```

## Contraintes

- Toujours confirmer à l'étape 4 avant créations distantes (irréversibles).
- Jamais de liste de skills `/gerber:*` dans le CLAUDE.md généré.
- Jamais toucher à un `origin` qui pointe ailleurs sans demander.
- Noms Linear et GitHub **identiques** modulo casing. Si l'utilisateur veut deux noms différents → sortir du flow nominal.
