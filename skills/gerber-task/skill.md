---
name: gerber-task
description: "Gestion rapide des tâches projet via agent-brain MCP. Triggers: /gerber-task [action] [args]"
user-invocable: true
---

# /gerber-task — Gestion des tâches projet

## Usage

```
/gerber-task                         # Liste les tâches du projet courant
/gerber-task add "Titre de la tâche" # Créer une tâche (status: inbox)
/gerber-task <id> done               # Déplacer une tâche vers done
/gerber-task <id> <status>           # Changer le status d'une tâche
/gerber-task <id>                    # Afficher le détail d'une tâche
```

## Étape 1 — Résoudre le projet

1. Chercher le slug dans le `CLAUDE.md` du projet courant (section `## agent-brain`)
2. Fallback : lire `.gerber-slug`, puis `basename` du répertoire courant
3. Si aucun slug trouvé → erreur : "Exécute /gerber-onboarding d'abord."

## Mode : Liste (pas d'arguments)

Appeler `mcp__gerber__task_list` avec :
- `projectSlug` : le slug résolu
- `limit` : 50

Afficher les tâches groupées par status (colonnes kanban) :

```
=== Tâches — {slug} ({total}) ===

INBOX (3)
  #1  Dashboard agent-brain custom          [high] #ui
  #2  Skill /inbox enrichi                         #mcp
  #3  Export TASKS.md depuis agent-brain            #cli

BRAINSTORM (1)
  #4  Notifications Telegram issues high           #telegram

SPEC (0)

PLAN (0)

IMPLEM (1)
  #5  UI kanban tasks & issues              [high] #ui

TEST (0)

DONE (2)
  #6  ~~Schema messages simplifié~~                 10 avr
  #7  ~~Skill /send inter-sessions~~                10 avr
```

**Format par tâche :**
```
  #{n}  {title}    [{priority si != normal}] #{tags}
```

Pour les tâches done : titre barré (`~~titre~~`) + date de completion.

Numéroter les tâches séquentiellement (#1, #2...) pour permettre les actions rapides.

## Mode : Add

```
/gerber-task add "Titre"
/gerber-task add "Titre" --priority high --tags ui,frontend
```

Appeler `mcp__gerber__task_create` avec :
- `projectSlug` : le slug résolu
- `title` : le titre fourni
- `status` : `"inbox"` (toujours)
- `priority` : si `--priority` fourni, sinon `"normal"`
- `tags` : si `--tags` fourni (split par virgule), sinon `[]`

Confirmer :
```
Tâche créée : "{title}" → Inbox
  ID : {id}
```

## Mode : Changer le status

```
/gerber-task <id_ou_numero> <status>
```

Statuts valides : `inbox`, `brainstorming`, `specification`, `plan`, `implementation`, `test`, `done`

Raccourcis acceptés :
- `brain` ou `bs` → `brainstorming`
- `spec` → `specification`
- `impl` ou `dev` → `implementation`

Appeler `mcp__gerber__task_update` avec :
- `id` : l'UUID de la tâche (résolu depuis le numéro si # utilisé)
- `status` : le nouveau status

Confirmer :
```
Tâche "{title}" → {status}
```

## Mode : Détail

```
/gerber-task <id_ou_numero>
```

Appeler `mcp__gerber__task_get` avec `id`.

Afficher :

```
=== {title} ===
Status   : {status}
Priority : {priority}
Assignee : {assignee ou "—"}
Due      : {dueDate formaté ou "—"}
Tags     : [{tags}]
Created  : {date}
Updated  : {date}

{description ou "(pas de description)"}

Subtasks ({n}) :
  [x] Sous-tâche terminée
  [ ] Sous-tâche en cours
```

Proposer des actions :
```
Action ? (status/edit/delete/q)
```

- `status` → demander le nouveau status
- `edit` → demander quel champ modifier (title, description, priority, assignee, tags, dueDate)
- `delete` → confirmation puis `mcp__gerber__task_delete`

## Contraintes

- Utiliser exclusivement les outils MCP `mcp__gerber__*`
- Le status par défaut à la création est toujours `inbox`
- Ne jamais modifier les notes ou messages (uniquement les tasks)
