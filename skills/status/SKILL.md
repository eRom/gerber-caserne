---
name: status
description: "Affiche le dashboard du projet gerber courant : infos projet, compteurs notes/tasks/issues."
user-invocable: true
---

# /status — Dashboard projet

Affiche un dashboard complet du projet gerber courant.
Delegue le gros du travail a l'agent `gerber:agent-status` en background.

## Etape 1 — Pre-traitement (contexte principal)

### Resoudre le projet

Lire le CLAUDE.md du projet courant pour trouver le `projectSlug` dans la section `## Gerber`.
Fallback : lire `.gerber-slug` a la racine du repo, puis `basename "$PWD"`.

Appeler `mcp__gerber__project_list` et chercher le projet correspondant au slug resolu.

- Si le projet **n'existe pas** : executer `/gerber:onboarding` puis reprendre a l'etape 1.
- Si le projet **existe** : noter son `id`, `name`, `description`, `repoPath`, `color`, `createdAt`, `updatedAt`.

### Formater les dates

Convertir `createdAt` et `updatedAt` (timestamps) en dates lisibles (ex: `10 avr 2026`).

## Etape 2 — Delegation a l'agent

Afficher : `Dashboard en cours...`

Lancer l'agent `gerber:agent-status` via l'outil `Agent` avec `subagent_type: "gerber:agent-status"`, `run_in_background: true` et `mode: "bypassPermissions"`.

Prompt a envoyer :

```
Slug : ${SLUG}
Project ID : ${PROJECT_ID}
Project name : ${NAME}
Description : ${DESCRIPTION}
Repo path : ${REPO_PATH}
Badge color : ${COLOR}
Created : ${CREATED_AT_FORMATTED}
Updated : ${UPDATED_AT_FORMATTED}
```

## Etape 3 — Apres retour de l'agent

Afficher le dashboard retourne par l'agent tel quel.

## Contraintes

- Ce skill ne cree ni ne modifie aucune donnee (sauf si onboarding necessaire).
- Le pre-traitement (resolution projet) reste dans le contexte principal pour gerer le fallback onboarding.
