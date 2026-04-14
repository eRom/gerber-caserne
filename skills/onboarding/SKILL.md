---
name: onboarding
description: "Initialise un projet dans gerber et configure le CLAUDE.md du repo courant."
user-invocable: true
---

# Skill: onboarding

Tu initialises un projet dans Gerber et configures le CLAUDE.md du repo courant.

## Arguments

- `[slug]` (optionnel) : identifiant du projet. Si absent, utilise `basename "$PWD"`.

## Étape 0 — Résoudre le slug (pré requis)

Si un argument a été fourni après `/gerber:onboarding`, utilise-le comme slug.
Sinon, détermine le slug via `basename "$PWD"`.

## Étape 1 - Initialsation workspace 

1. Configurer le repo Git  :

- Si un repo git **n'existe pas** : Faire un `git init`
- Si un repo git **existe déjà** : ne rien faire.

2. Configuer le dossier `.memory/` si pas existant
- Si le dossier **n'existe pas** : Créer un dossier dans le projet `.memory/`
- Vérifier que `.memory/` est dans le `.gitignore` du projet. Si ce n'est pas le cas, l'ajouter.

## Étape 2 — Vérifier si le projet existe déjà

Appeler `mcp__gerber__project_list` (sans paramètres).

Chercher dans la réponse un projet dont le `slug` correspond au slug résolu.

- Si le projet **existe déjà** : noter son `id` et passer directement à l'Étape 4 (slug file).
- Si le projet **n'existe pas** : passer à l'Étape 3 (création).

## Étape 3 — Créer le projet

Demander confirmation à Romain avant de créer :

```
Projet « {slug} » introuvable dans agent-brain.
Je vais créer :
  - slug     : {slug}
  - name     : {slug} (peut être modifié)
  - repoPath : {PWD}

On y va ? (oui/non)
```

Si confirmation reçue, appeler `mcp__gerber__project_create` avec :
- `slug` : le slug résolu
- `name` : le slug (ou le nom donné par l'utilisateur)
- `repoPath` : le répertoire courant

Vérifier que la réponse contient un `id` valide. Si erreur, rapporter et STOPPER.

## Étape 4 — Créer `.gerber-slug`

Créer (ou écraser) le fichier `.gerber-slug` à la racine du repo courant, contenant uniquement le slug suivi d'un saut de ligne.

Ce fichier est lu par le hook `gerber-poll.sh` au démarrage de session pour résoudre le slug du projet.

Vérifier que `.gerber-slug` est dans le `.gitignore` du projet. Si ce n'est pas le cas, l'ajouter.

## Étape 5 — Configurer le CLAUDE.md

Ouvrir le fichier `CLAUDE.md` à la racine du repo courant.

Chercher une section `## Gerber`.

- Si elle **existe déjà** : la mettre à jour avec le contenu ci-dessous.
- Si elle **n'existe pas** : l'ajouter à la fin du fichier.

Contenu de la section à insérer/remplacer :

```markdown
## Gerber

Ce projet est indexé dans **gerber** sous le slug `{slug}`.
Slug cross-projet : `erom` (design system, conventions, preferences personnelles). Pour les sujets design/UI, conventions, stack : chercher aussi dans `erom`.

Entites :
- **Notes** (atoms + documents) — mémoire de connaissance, recherche sémantique/fulltext
- **Tasks** — tâches projet avec kanban 7 colonnes (inbox → brainstorming → specification → plan → implementation → test → done)
- **Issues** — problèmes/bugs avec kanban 4 colonnes (inbox → in_progress → in_review → closed)
- **Messages** — bus inter-sessions (context + reminder)

Skills disponibles :
- `/gerber:recall` — recherche contextuelle dans la mémoire cross-projets
- `/gerber:capture` — capture rapide d'un atome de connaissance
- `/gerber:archive` — extraction et archivage fin de session
- `/gerber:review` — maintenance hebdomadaire (notes, tasks, issues)
- `/gerber:import` — migration one-shot depuis .memory/
- `/gerber:inbox` — consulter les messages inter-sessions
- `/gerber:send` — envoyer un message inter-session
- `/gerber:task` — gestion des tâches projet (kanban)
- `/gerber:issue` — gestion des issues projet
- `/gerber:vault` — archivage cross-projets dans un vault git
```

Remplacer `{slug}` par la valeur résolue.

## Étape 6 — Confirmation finale

Afficher :

```
Projet « {slug} » initialisé dans agent-brain.

CLAUDE.md mis à jour avec la section ## agent-brain.

Prochaine étape : /gerber:import pour migrer le contenu existant.
```
