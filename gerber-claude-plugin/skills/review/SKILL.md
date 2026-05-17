---
name: review
description: "Maintenance hebdomadaire gerber — stats projet, tasks en inbox/stale, issues ouvertes."
user-invocable: true
context: fork
---

# review

Maintenance hebdomadaire du state engine gerber : stats projet, tasks à trier, issues à traiter.

## Usage

```
/gerber:review [project_slug|--all]
```

- Sans argument : utilise le slug du projet courant (lu dans CLAUDE.md)
- Avec `--all` : passe en revue tous les projets

## Contraintes absolues

- Ne JAMAIS créer ni modifier de tasks/issues — lecture seule
- Utiliser exclusivement les outils MCP `mcp__gerber__*` — jamais curl

## Workflow

### Étape 1 — Résolution du projet

- Si un `project_slug` est passé en argument → l'utiliser directement
- Sinon → lire le CLAUDE.md du projet courant pour en extraire le slug
- Si `--all` → ne pas filtrer par projet dans les appels suivants

### Étape 2 — Stats tasks & issues

Appeler `mcp__gerber__task_list` avec `limit: 1` pour obtenir le total.
Appeler `mcp__gerber__task_list` avec `status: 'inbox'` et `limit: 200` pour compter les tasks en inbox.
Appeler `mcp__gerber__task_list` avec `status: 'done'` et `limit: 1` pour compter les tasks terminées.
Appeler `mcp__gerber__issue_list` avec `limit: 1` pour obtenir le total.
Appeler `mcp__gerber__issue_list` avec `status: 'inbox'` et `limit: 200` pour compter les issues en inbox.
Appeler `mcp__gerber__issue_list` avec `status: 'closed'` et `limit: 1` pour compter les issues fermées.

Si le `projectSlug` est défini, filtrer chaque appel par projet.

Affichage :
```
Tasks  : {total} total | {inbox} en inbox | {done} terminées
Issues : {total} total | {inbox} en inbox | {closed} fermées
```

### Étape 3 — Tasks en inbox stale (> 7 jours)

Parmi les tasks en inbox récupérées à l'étape 2, identifier celles dont `createdAt` est > 7 jours.

Signaler :
```
⚠ {N} tasks en inbox depuis > 7 jours — à trier ?
```

Lister les titres + ID + date de création.

### Étape 4 — Issues sans activité (> 14 jours)

Appeler `mcp__gerber__issue_list` avec `status: 'in_progress'` ou `'in_review'`, `limit: 50`.

Identifier celles dont `updatedAt` est > 14 jours. Signaler :
```
⚠ {N} issues actives sans mise à jour depuis > 14 jours
```

### Étape 5 — Résumé final

```
Review terminée :
  - {N} tasks à trier (inbox stale)
  - {M} issues sans activité
  Prochaine review suggérée : semaine prochaine
```
