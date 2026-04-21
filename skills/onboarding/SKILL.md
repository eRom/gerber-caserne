---
name: onboarding
description: "Initialise un projet dans gerber et configure le CLAUDE.md du repo courant."
user-invocable: true
---

# Skill: onboarding

Tu initialises un projet dans Gerber et configures le CLAUDE.md du repo courant.

## Arguments

- `[slug]` (optionnel) : identifiant du projet. Si absent, utilise `basename "$PWD"`.

## Etape 0 — Resoudre le slug (pre requis)

Si un argument a ete fourni apres `/gerber:onboarding`, utilise-le comme slug.
Sinon, determine le slug via `basename "$PWD"`.

## Etape 1 — Initialisation workspace

1. Configurer le repo Git :

- Si un repo git **n'existe pas** : Faire un `git init`
- Si un repo git **existe deja** : ne rien faire.

2. Configurer le dossier `.cave/` :
- Si le dossier **n'existe pas** : Creer le dossier `.cave/` dans le projet

Note : `.cave/` n'est PAS gitignore — il est versionne avec le projet.

## Etape 2 — Verifier si le projet existe deja

Appeler `mcp__gerber__project_list` (sans parametres).

Chercher dans la reponse un projet dont le `slug` correspond au slug resolu.

- Si le projet **existe deja** : noter son `id`.
  - Si son `repoPath` est vide OU different du `$PWD` courant : appeler `mcp__gerber__project_update` avec `{ id, repoPath: "$PWD" }` pour synchroniser le chemin. Afficher `Path projet mis a jour : {ancien} -> {PWD}`.
  - Passer directement a l'Etape 4 (slug file).
- Si le projet **n'existe pas** : passer a l'Etape 3 (creation).

## Etape 3 — Creer le projet

Demander confirmation a Romain avant de creer :

```
Projet << {slug} >> introuvable dans agent-brain.
Je vais creer :
  - slug     : {slug}
  - name     : {slug} (peut etre modifie)
  - repoPath : {PWD}

On y va ? (oui/non)
```

Si confirmation recue, appeler `mcp__gerber__project_create` avec :
- `slug` : le slug resolu
- `name` : le slug (ou le nom donne par l'utilisateur)
- `repoPath` : le repertoire courant

Verifier que la reponse contient un `id` valide. Si erreur, rapporter et STOPPER.

## Etape 4 — Creer `.cave/.gerber-slug`

Creer (ou ecraser) le fichier `.cave/.gerber-slug` contenant uniquement le slug suivi d'un saut de ligne.

Ce fichier est lu par le hook `gerber-poll.sh` au demarrage de session pour resoudre le slug du projet.

## Etape 5 — Configurer le CLAUDE.md

Ouvrir le fichier `CLAUDE.md` a la racine du repo courant.

### Section `## Gerber`

Chercher une section `## Gerber`.

- Si elle **existe deja** : la mettre a jour avec le contenu ci-dessous.
- Si elle **n'existe pas** : l'ajouter a la fin du fichier.

Contenu de la section a inserer/remplacer :

```markdown
## Gerber

Ce projet est indexe dans **gerber** sous le slug `{slug}`.
Slug cross-projet : `caserne` (design system, conventions, preferences personnelles). Pour les sujets design/UI, conventions, stack : chercher aussi dans `caserne`.

Entites :
- **Notes** (atoms + documents) — memoire de connaissance, recherche semantique/fulltext
- **Tasks** — taches projet avec kanban 7 colonnes (inbox -> brainstorming -> specification -> plan -> implementation -> test -> done)
- **Issues** — problemes/bugs avec kanban 4 colonnes (inbox -> in_progress -> in_review -> closed)
- **Messages** — bus inter-sessions (context + reminder)

Skills disponibles :
- `/gerber:recall` — recherche contextuelle dans la memoire cross-projets
- `/gerber:capture` — capture rapide d'un atome de connaissance
- `/gerber:archive` — extraction et archivage fin de session
- `/gerber:session-complete` — cartographie de fin de session (.cave/ + archive)
- `/gerber:review` — maintenance hebdomadaire (notes, tasks, issues)
- `/gerber:import` — migration one-shot depuis .cave/
- `/gerber:inbox` — consulter les messages inter-sessions
- `/gerber:send` — envoyer un message inter-session
- `/gerber:task` — gestion des taches projet (kanban)
- `/gerber:issue` — gestion des issues projet
- `/gerber:vault` — archivage cross-projets dans un vault git
- `/gerber:runbook` — composer le runbook d'un projet (run_cmd, url, env) depuis la stack du repo
```

Remplacer `{slug}` par la valeur resolue.

### Section `## Contexte projet (.cave)`

Chercher une section `## Contexte projet`.

- Si elle **existe deja** : la mettre a jour.
- Si elle **n'existe pas** : l'ajouter apres la section `## Gerber`.

Contenu :

```markdown
## Contexte projet (.cave)

Le dossier `.cave/` contient la cartographie persistante du projet :
- `architecture.md` — vue d'ensemble, stack, flux de donnees
- `key-files.md` — fichiers critiques et leur role
- `patterns.md` — conventions et patterns recurrents
- `gotchas.md` — pieges, bugs resolus, workarounds

**Ne lis PAS ces fichiers au demarrage.** Lis-les a la demande, uniquement quand la question de l'utilisateur touche au domaine concerne (ex: question archi -> `architecture.md`, bug etrange -> `gotchas.md`). Pour une question triviale ou sans rapport avec le projet lui-meme, ne les lis pas du tout.
```

## Etape 6 — Initialiser le vault

Le vault git local (`~/.config/gerber-vault/`) est utilise par `/gerber:vault` pour archiver des fichiers cross-projets.

### 6a — Verifier si le vault existe

```bash
test -d ~/.config/gerber-vault/.git && echo "EXISTS" || echo "MISSING"
```

- Si `EXISTS` : afficher `Vault deja initialise.` et passer a l'etape 6d.
- Si `MISSING` : continuer avec 6b.

### 6b — Creer et initialiser le vault

```bash
mkdir -p ~/.config/gerber-vault
cd ~/.config/gerber-vault && git init && git commit --allow-empty -m "init: gerber vault"
```

### 6c — Proposer un remote (optionnel)

Demander :

```
Vault git initialise dans ~/.config/gerber-vault/
Veux-tu configurer un remote GitHub ? (url ou 'skip')
```

- Si l'utilisateur donne une URL : `git remote add origin <url> && git push -u origin main`
- Si `skip` : afficher `Remote skippe — le vault fonctionne en local. Tu pourras ajouter un remote plus tard avec : cd ~/.config/gerber-vault && git remote add origin <url>`

### 6d — Creer le dossier projet dans le vault

```bash
mkdir -p ~/.config/gerber-vault/{slug}
```

## Etape 7 — Proposition d'import

Si `.cave/` contient des fichiers `.md` (non-vide) :

```
Le dossier .cave/ contient du contenu existant.
Veux-tu lancer /gerber:import pour migrer ces fichiers vers gerber ? (oui/non)
```

- Si **oui** → lancer `/gerber:import`
- Si **non** → continuer

Si `.cave/` est vide → skip silencieux.

## Etape 8 — Confirmation finale

Afficher :

```
Projet << {slug} >> initialise dans gerber.

  [x] Workspace (.cave/)
  [x] Projet cree dans gerber
  [x] .cave/.gerber-slug
  [x] CLAUDE.md § Gerber + § Contexte projet (.cave)
  [x] Vault (~/.config/gerber-vault/)
```
