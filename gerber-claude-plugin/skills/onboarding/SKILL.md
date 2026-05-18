---
name: onboarding
description: "Initialise un projet : crée le projet Linear (workspace eRom, team eRom-Agents), configure le repo Git + remote GitHub, le dossier .cave/, enregistre le repo dans le vault RAG gerber, et écrit la section Linear dans le CLAUDE.md. Déclenche dès que l'utilisateur demande à onboarder/initialiser/configurer un projet."
user-invocable: true
---

# Skill : onboarding

Tu initialises un nouveau projet du côté Linear, GitHub, `.cave/`, vault gerber, et écris la config Linear dans le `CLAUDE.md` du repo courant.

**Décisions figées** (ne pas demander à l'utilisateur) :
- Workspace Linear : `eRom`
- Team Linear : `eRom-Agents`
- Owner GitHub : `eRom`
- Visibilité du repo GitHub créé : `private`
- `.cave/` est **versionné** (jamais dans `.gitignore`)
- L'enregistrement vault gerber est **obligatoire** (pas une option)

## Étape 0 — Préchecks

### 0.1 Bearer `GERBER_TOKEN` (pour `mcp__gerber__rag_onboard`)

Vérifier que le MCP gerber répond. Si l'appel suivant échoue avec 401/Unauthorized :

```
mcp__gerber__rag_onboard({ repo: "eRom/probe-only-skip" })
```

(ce repo factice provoquera une erreur métier, mais une erreur 401 indique un bearer manquant)

Si bearer absent : suivre la même procédure que les autres skills gerber (sops décode → `~/.claude/settings.json` `env.GERBER_TOKEN` → redémarrer Claude Code). Reprendre la skill après redémarrage.

### 0.2 `gh` CLI authentifié

```bash
gh auth status
```

Si échec : `gh auth login` puis reprendre.

## Étape 1 — Détecter le nom de base du projet

Ordre de priorité :

1. **Remote Git** : `git remote get-url origin` — extraire le dernier segment de l'URL, retirer `.git`. Ex : `git@github.com:eRom/agent-brain.git` → `agent-brain`.
2. **Dossier courant** : `basename "$PWD"` (Claude Code CLI / Desktop).
3. **Ask user** : si aucune des deux commandes n'est exécutable (Claude.ai web, mobile), demander :
   ```
   Quel est le nom du projet ? (ex: agent-brain)
   ```

Le résultat de cette étape est le **nom de base** (string brute, typiquement kebab-case).

## Étape 2 — Dériver les deux noms

À partir du nom de base, dériver :

- **Nom Linear** : Title Case avec espaces. Algorithme : split sur `-`/`_`, capitaliser chaque mot, join avec espace.
  - `agent-brain` → `Agent Brain`
  - `gerber_caserne` → `Gerber Caserne`
  - `MyApp` (déjà PascalCase) → `My App` (inserer espace avant majuscules internes)
- **Nom GitHub** : kebab-case, tout en minuscules. Si la source est PascalCase ou Title Case : split sur majuscules/espaces, join avec `-`, lowercase.
  - `Agent Brain` → `agent-brain`
  - `agent-brain` → `agent-brain` (inchangé)

## Étape 3 — Vérifier la disponibilité

### 3.1 Côté Linear

```
mcp__plugin_linear_linear__list_projects({
  team: "eRom-Agents",
  query: "<nom_linear>"
})
```

Match si un projet renvoyé a le `name` **strictement égal** (case-insensitive) au nom dérivé.

### 3.2 Côté GitHub

```bash
gh repo view eRom/<nom_github> --json name 2>/dev/null
```

Match si la commande renvoie un JSON (exit code 0).

### 3.3 Si conflit

Si **l'un OU l'autre** existe déjà, demander à l'utilisateur un autre nom :

```
"<nom_linear>" existe déjà sur Linear / "<nom_github>" existe déjà sur GitHub.

Propose un autre nom (sera utilisé pour Linear + GitHub) :
```

Reboucler sur les étapes 2 et 3 avec le nouveau nom jusqu'à obtenir un couple libre des deux côtés.

## Étape 4 — Confirmation

Afficher :

```
Je vais créer :
  - Linear     : <nom_linear>      (team eRom-Agents)
  - Repository : eRom/<nom_github> (privé)
  - Vault RAG  : OK

On y va ? (oui/non)
```

Si `non` → terminer la skill avec un message neutre. Si `oui` → enchaîner.

## Étape 5 — Créer le projet Linear

```
mcp__plugin_linear_linear__save_project({
  name: "<nom_linear>",
  addTeams: ["eRom-Agents"]
})
```

Stocker `id` (UUID) et `url` retournés. Si erreur, rapporter et **STOPPER** (rien n'a été créé localement).

## Étape 6 — Setup Git local + remote GitHub

### 6.1 Repo Git local

- Si `.git/` **n'existe pas** :
  ```bash
  git init
  ```
- Si `.git/` **existe déjà** : ne rien faire.

### 6.2 Remote `origin`

Vérifier `git remote get-url origin`.

- Si `origin` **existe** et pointe vers `github.com/eRom/<nom_github>` → ne rien faire.
- Si `origin` **n'existe pas** :
  1. Créer le repo distant :
     ```bash
     gh repo create eRom/<nom_github> --private
     ```
  2. Ajouter le remote :
     ```bash
     git remote add origin git@github.com:eRom/<nom_github>.git
     ```
- Si `origin` pointe ailleurs : ne PAS écraser silencieusement. Avertir l'utilisateur et lui demander quoi faire (rename `origin` → `upstream`, ou utiliser un autre nom de remote, ou skipper).

## Étape 7 — Setup `.cave/`

```bash
mkdir -p .cave
```

**Ne pas** ajouter `.cave/` dans `.gitignore` — il est versionné avec le projet. Si une entrée `.cave/` existe dans `.gitignore` du repo, la retirer.

(Les fichiers `architecture.md`, `key-files.md`, `patterns.md`, `gotchas.md` sont créés à la demande par `/gerber:session-complete`, pas à l'onboarding.)

## Étape 8 — Enregistrer le repo dans le vault RAG gerber

```
mcp__gerber__rag_onboard({ repo: "eRom/<nom_github>" })
```

Cet appel est **idempotent**. Retours possibles :
- `status: "added"` → ajouté à `sources.yml`, premier indexage RAG dans 15-30 min (prochain cron `pull-sources.yml`)
- `status: "already_registered"` → déjà présent, OK
- Erreur → rapporter mais ne pas bloquer la suite (le vault n'est pas critique pour l'usage local du projet)

## Étape 9 — Écrire la section `## Linear` dans `CLAUDE.md`

À la racine du repo courant.

### 9.1 Récupérer l'`id` de la team

Si pas déjà connu dans le contexte :

```
mcp__plugin_linear_linear__list_teams({ query: "eRom-Agents" })
```

Récupérer le `id` (UUID) de la team `eRom-Agents`.

### 9.2 Section à insérer

Contenu **strict** (ne pas ajouter de notice d'utilisation des skills gerber, ne pas ajouter d'autre section) :

```markdown
## Linear

- **Project** : <nom_linear>  (`<project_id>`)
- **Team** : eRom-Agents (`<team_id>`)
- **Workflow Issues** : Triage → Backlog → Todo → Plan → Specification → Code → Test → Done
- **Projet Status** : Backlog → Planned → In Progress → Completed
```

Remplacer `<nom_linear>`, `<project_id>`, `<team_id>` par les valeurs résolues.

### 9.3 Application

- Si `CLAUDE.md` **n'existe pas** : le créer avec le titre `# CLAUDE.md — <nom_linear>` sur la première ligne, puis une ligne vide, puis la section `## Linear` ci-dessus.
- Si `CLAUDE.md` **existe** :
  - S'il contient déjà une section `## Linear` : la remplacer intégralement par le bloc ci-dessus.
  - Sinon : insérer la section `## Linear` immédiatement après la première ligne de titre (avant toute autre section).

**Important** : ne RIEN écrire d'autre dans `CLAUDE.md`. Pas de liste des skills `/gerber:*`, pas de description du projet, pas de stack. La skill `/gerber:session-complete` et l'utilisateur enrichiront le reste plus tard.

## Étape 10 — Commit + push (si modifications)

### 10.1 Détecter les changements

```bash
git status --porcelain
```

- Si la sortie est **vide** → pas de modif, skipper cette étape.
- Sinon → continuer.

### 10.2 Staging ciblé

Ne PAS faire `git add .` (risque d'inclure des fichiers non liés). Ajouter explicitement ce que l'onboarding a touché :

```bash
git add CLAUDE.md
# Si .gitignore a été modifié (entrée .cave/ retirée à l'étape 7) :
git add .gitignore
```

Si le repo contient d'autres fichiers non-trackés à la racine (ex: README initial, code déjà en place), demander à l'utilisateur s'il faut les inclure dans le commit d'onboarding ou les laisser pour plus tard :

```
Les fichiers suivants ne sont pas trackés :
  <liste>

Les inclure dans le commit d'onboarding ? (oui/non)
```

### 10.3 Commit

```bash
git commit -m "chore: onboard project — CLAUDE.md + Linear"
```

### 10.4 Push

Détecter la situation :

```bash
CURRENT_BRANCH=$(git branch --show-current)
UPSTREAM=$(git rev-parse --abbrev-ref --symbolic-full-name "@{u}" 2>/dev/null)
```

- Si `$UPSTREAM` est **vide** (jamais pushé) :
  ```bash
  git push -u origin "$CURRENT_BRANCH"
  ```
- Sinon :
  ```bash
  git push
  ```

Si push échoue (ex: non fast-forward, branche par défaut GitHub différente), afficher l'erreur et laisser l'utilisateur résoudre.

## Étape 11 — Récap

Afficher :

```
Projet "<nom_linear>" initialisé.

  [x] Linear      : <project_url>
  [x] GitHub      : https://github.com/eRom/<nom_github>
  [x] .cave/      : <PWD>/.cave/
  [x] Vault RAG   : <status> (added | already_registered | error)
  [x] CLAUDE.md   : section ## Linear écrite
  [x/skipped] Commit + push : <sha court> sur <branch> (ou "rien à committer")
```

## Contraintes

- Toujours demander confirmation à l'étape 4 avant de créer quoi que ce soit côté Linear ou GitHub (actions irréversibles côté distant).
- Ne JAMAIS ajouter de liste de skills `/gerber:*` dans le `CLAUDE.md` généré.
- Ne JAMAIS écrire le moindre slug `gerber` dans le `CLAUDE.md` ni dans le repo (la skill n'utilise pas le système de slugs gerber pour l'instant).
- Ne JAMAIS toucher à un remote `origin` qui pointe ailleurs sans demander explicitement.
- Tous les noms (Linear + GitHub) restent **identiques** sur les deux plateformes modulo le casing. Si l'utilisateur veut deux noms différents, sortir du flow nominal et lui demander.
