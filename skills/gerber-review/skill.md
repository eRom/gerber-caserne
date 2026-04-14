---
name: gerber-review
description: "Maintenance hebdomadaire gerber — stats, notes stale, drafts en attente, nettoyage."
user-invocable: true
context: fork
---

# gerber-review

Maintenance hebdomadaire du corpus gerber : stats globales, drafts en attente, notes stale, doublons potentiels.

## Usage

```
/gerber-review [project_slug|--all]
```

- Sans argument : utilise le slug du projet courant (lu dans CLAUDE.md)
- Avec `--all` : passe en revue tous les projets

## Contraintes absolues

- Ne JAMAIS créer de notes
- Ne JAMAIS modifier le contenu d'une note (uniquement les changements de `status`)
- Suppressions uniquement après double confirmation explicite de l'utilisateur
- Utiliser exclusivement les outils MCP `mcp__gerber__*` — jamais curl

## Workflow

### Étape 1 — Résolution du projet

- Si un `project_slug` est passé en argument → l'utiliser directement
- Sinon → lire le CLAUDE.md du projet courant pour en extraire le slug
- Si `--all` → ne pas filtrer par projet dans les appels suivants

### Étape 2 — Stats globales

Appeler `mcp__gerber__get_stats` (sans paramètres).

Affichage :
```
agent-brain : {N} projets | {M} notes ({atoms} atoms, {docs} docs) | {C} chunks | {S} MB
Top tags : #gotcha ({n}) #pattern ({n}) ...
```

### Étape 2b — Stats tasks & issues

Appeler `mcp__gerber__task_list` avec `limit: 1` pour obtenir le total.
Appeler `mcp__gerber__issue_list` avec `limit: 1` pour obtenir le total.

Si le `projectSlug` est défini, filtrer par projet.

Appeler aussi `mcp__gerber__task_list` avec `status: 'inbox'` et `limit: 200` pour compter les tasks en inbox.

Affichage :
```
Tasks : {total} total | {inbox} en inbox | {done} terminées
Issues : {total} total | {inbox} en inbox | {closed} fermées
```

Si des tasks sont en inbox depuis > 7 jours, les signaler :
```
⚠ {N} tasks en inbox depuis > 7 jours — à trier ?
```

### Étape 3 — Drafts en attente

Appeler `mcp__gerber__note_list` avec :
- `status` : `"draft"`
- `sort` : `"created_desc"`
- `limit` : 20

Si des drafts existent, les lister (titre, projet, date de création) et proposer :
```
Drafts trouvés ({N}) — que faire ?
  [A] Activer tout   [R] Archiver tout   [S] Supprimer   [D] Détail   [I] Ignorer
```

Appliquer les actions confirmées via `mcp__gerber__note_update` (`status: "active"` ou `"archived"`) ou `mcp__gerber__note_delete` après double confirmation.

### Étape 4 — Notes stale (> 30 jours sans mise à jour)

Appeler `mcp__gerber__note_list` avec :
- `status` : `"active"`
- `sort` : `"updated_desc"`
- `limit` : 50

Comparer `updated_at` à la date du jour. Identifier les notes non mises à jour depuis > 30 jours.

Proposer :
```
{N} notes stale (> 30j sans mise à jour) — Archiver ? (o/n/détail)
```

Si confirmé → `mcp__gerber__note_update` avec `status: "archived"` pour chacune.

### Étape 5 — Doublons potentiels (corpus > 50 notes uniquement)

Pour les 10 notes les plus récentes, effectuer une recherche sémantique par titre via `mcp__gerber__search` :
- `query` : le titre de la note
- `limit` : 5

Si un résultat différent de la note elle-même a un score > 0.90 → le signaler comme doublon potentiel.

Afficher la liste des paires suspectes sans action automatique. L'utilisateur décide.

### Étape 6 — Résumé final

```
Review terminée :
  - {N} drafts activés
  - {M} notes archivées (stale > 30j)
  - {K} doublons signalés
  Prochaine review suggérée : semaine prochaine
```
