---
name: gerber-status
description: "Affiche le dashboard du projet gerber courant : infos projet, notebook, compteurs notes/tasks/issues."
user-invocable: true
---

# /gerber-status — Dashboard projet

Affiche un dashboard complet du projet gerber courant.

## Etape 1 — Resoudre le projet

Lire le CLAUDE.md du projet courant pour trouver le `projectSlug` dans la section `## Gerber`.
Fallback : lire `.gerber-slug` a la racine du repo, puis `basename "$PWD"`.

Appeler `mcp__gerber__project_list` et chercher le projet correspondant au slug resolu.

- Si le projet **n'existe pas** : executer `/gerber-onboarding` puis reprendre a l'etape 1.
- Si le projet **existe** : noter son `id`, `name`, `description`, `repoPath`, `badgeColor`, `createdAt`, `updatedAt`.

## Etape 2 — Recuperer le repo Git

Executer `git remote get-url origin 2>/dev/null` dans le repertoire courant.
- Si un remote existe : noter l'URL (format HTTPS si possible).
- Sinon : `None`.

## Etape 3 — Chercher le notebook NotebookLM

Appeler `mcp__notebooklm-mcp__notebook_list` avec `max_results: 200`.

Chercher un notebook dont le titre correspond a `{slug}-dev-notebook`.

- Si trouve : noter l'ID du notebook pour construire l'URL `https://notebooklm.google.com/notebook/{NOTEBOOK_ID}`.
- Si non trouve : `None`.

## Etape 4 — Compter les notes

Appeler `mcp__gerber__note_list` avec `projectSlug: {slug}`, `kind: "atom"`, `limit: 1`.
Noter le `total` retourne dans la reponse → `atomCount`.

Appeler `mcp__gerber__note_list` avec `projectSlug: {slug}`, `kind: "document"`, `limit: 1`.
Noter le `total` retourne dans la reponse → `documentCount`.

## Etape 5 — Compter les tasks

Appeler `mcp__gerber__task_list` avec `projectSlug: {slug}`, `limit: 1`.
Noter le `total` retourne → `totalTasks`.

Appeler `mcp__gerber__task_list` avec `projectSlug: {slug}`, `status: "done"`, `limit: 1`.
Noter le `total` retourne → `doneTasks`.

Calculer : `pendingTasks = totalTasks - doneTasks`.

## Etape 6 — Compter les issues

Appeler `mcp__gerber__issue_list` avec `projectSlug: {slug}`, `limit: 1`.
Noter le `total` retourne → `totalIssues`.

Appeler `mcp__gerber__issue_list` avec `projectSlug: {slug}`, `status: "inbox"`, `limit: 1`.
Noter le `total` retourne → `inboxIssues`.

## Etape 7 — Affichage

Afficher le dashboard formate :

```
=== {name} ===

Description : {description}
Repo Path   : {repoPath}
Repo Git    : {gitRemoteUrl | None}
NotebookLM  : {notebookUrl | None}
Created     : {createdAt} | Updated : {updatedAt}
Badge       : {badgeColor}

--- Resume ---
Notes  : {atomCount} Atom(s) | {documentCount} Document(s)
Tasks  : {pendingTasks} pending / {totalTasks} total
Issues : {inboxIssues} inbox / {totalIssues} total
```

## Contraintes

- Ce skill ne cree ni ne modifie aucune donnee (sauf si onboarding necessaire).
- Utiliser exclusivement les outils MCP `mcp__gerber__*` et `mcp__notebooklm-mcp__*` — jamais curl.
- Tous les appels MCP independants (notes atom/document, tasks total/done, issues total/inbox) doivent etre lances en parallele pour la performance.
