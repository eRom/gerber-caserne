---
name: gerber-issue
description: "Gestion rapide des issues projet via agent-brain MCP. Triggers: /gerber-issue [action] [args]"
user-invocable: true
---

# /gerber-issue — Gestion des issues projet

## Usage

```
/gerber-issue                              # Liste les issues du projet courant
/gerber-issue add "Titre"                  # Créer une issue (status: inbox, severity: bug)
/gerber-issue <id> close                   # Fermer une issue
/gerber-issue <id> <status>                # Changer le status d'une issue
/gerber-issue <id>                         # Afficher le détail d'une issue
```

## Étape 1 — Résoudre le projet

1. Chercher le slug dans le `CLAUDE.md` du projet courant (section `## agent-brain`)
2. Fallback : lire `.gerber-slug`, puis `basename` du répertoire courant
3. Si aucun slug trouvé → erreur : "Exécute /gerber-onboarding d'abord."

## Mode : Liste (pas d'arguments)

Appeler `mcp__gerber__issue_list` avec :
- `projectSlug` : le slug résolu
- `limit` : 50

Afficher les issues groupées par status :

```
=== Issues — {slug} ({total}) ===

INBOX (2)
  #1  [bug]         FTS5 accents cassés              [high] #search
  #2  [enhancement] Tags manquants sur messages              #schema

IN PROGRESS (1)
  #3  [regression]  Embeddings crash large docs       [critical] #embeddings

IN REVIEW (0)

CLOSED (1)
  #4  [bug]         ~~FTS5 rowid collision~~                  9 avr
```

**Format par issue :**
```
  #{n}  [{severity}]  {title}    [{priority si != normal}] #{tags}
```

Pour les issues closed : titre barré + date.

## Mode : Add

```
/gerber-issue add "Titre"
/gerber-issue add "Titre" --severity regression --priority critical --tags search,fts5
```

Appeler `mcp__gerber__issue_create` avec :
- `projectSlug` : le slug résolu
- `title` : le titre fourni
- `status` : `"inbox"` (toujours)
- `severity` : si `--severity` fourni, sinon `"bug"`
- `priority` : si `--priority` fourni, sinon `"normal"`
- `tags` : si `--tags` fourni (split par virgule), sinon `[]`

Si aucune `--severity` fournie et que le titre contient des mots-clés, suggérer :
- "crash", "broken", "fails" → `bug`
- "regression", "worked before" → `regression`
- "should", "could", "would be nice" → `enhancement`
- "slow", "timeout" → `warning`

Confirmer :
```
Issue créée : [{severity}] "{title}" → Inbox
  ID : {id}
```

## Mode : Changer le status

```
/gerber-issue <id_ou_numero> <status>
```

Statuts valides : `inbox`, `in_progress`, `in_review`, `closed`

Raccourcis acceptés :
- `wip` ou `progress` → `in_progress`
- `review` → `in_review`
- `close` → `closed`

Appeler `mcp__gerber__issue_update` avec :
- `id` : l'UUID de l'issue
- `status` : le nouveau status

Si le status est `closed`, utiliser `mcp__gerber__issue_close` à la place.

Confirmer :
```
Issue "{title}" → {status}
```

## Mode : Détail

```
/gerber-issue <id_ou_numero>
```

Appeler `mcp__gerber__issue_get` avec `id`.

Afficher :

```
=== [{severity}] {title} ===
Status   : {status}
Priority : {priority}
Severity : {severity}
Assignee : {assignee ou "—"}
Tags     : [{tags}]
Task liée: {relatedTaskId ou "—"}
Created  : {date}
Updated  : {date}

{description ou "(pas de description)"}
```

Proposer des actions :
```
Action ? (status/edit/close/q)
```

- `status` → demander le nouveau status
- `edit` → demander quel champ modifier (title, description, severity, priority, assignee, tags)
- `close` → `mcp__gerber__issue_close`

## Contraintes

- Utiliser exclusivement les outils MCP `mcp__gerber__*`
- Le status par défaut à la création est toujours `inbox`
- La severity par défaut est `bug`
- Ne jamais modifier les notes, messages ou tasks (uniquement les issues)
