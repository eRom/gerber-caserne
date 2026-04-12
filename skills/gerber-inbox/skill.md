---
name: gerber-inbox
description: "Consulte les messages inter-sessions (context, reminder) en attente pour le projet courant via agent-brain MCP. Triggers: /gerber-inbox, /gerber-inbox all, /gerber-inbox done"
user-invocable: true
---

# /inbox — Consulte les messages inter-sessions

## Étape 1 — Résoudre le projet

1. Chercher le slug dans le `CLAUDE.md` du projet courant (section `## agent-brain`)
2. Fallback : lire `.gerber-slug`, puis `basename` du répertoire de travail courant
3. Override possible via arg `--project <slug>`

## Étape 2 — Lister les messages

Déterminer le filtre de statut selon l'argument :

| Invocation      | Filtre status   |
|-----------------|-----------------|
| `/inbox`        | `"pending"`     |
| `/inbox all`    | aucun filtre    |
| `/inbox done`   | `"done"`        |

Appeler `mcp__gerber__message_list` avec :
- `projectSlug` : le slug résolu
- `status` : le filtre (omettre pour `/inbox all`)

## Étape 3 — Affichage formaté

```
=== Inbox — {slug} ({count} {status}) ===

[i] agent-brain: .memory/ ingéré dans le MCP
    from: cruchot | 3h ago

[R] Configurer agent-brain MCP dans les settings
    from: cruchot | 3h ago
```

**Icônes par type :**
- `[i]` = context
- `[R]` = reminder

**Format de chaque message :**
```
{icone} {title}
    from: {sourceProject} | {age relatif}
```

**Si inbox vide :**
```
=== Inbox — {slug} (0 pending) ===
Aucun message en attente.
```

## Étape 4 — Proposer des actions

Afficher après la liste :

```
Action sur un message ? (numéro + done, ou 'q' pour quitter)
```

Si l'utilisateur choisit une action, appeler `mcp__gerber__message_update` avec :
- `id` : l'ID du message
- `status` : `"done"`

Confirmer : `Message "{title}" → done`

## Contraintes

- Ne JAMAIS créer de messages (c'est le rôle de `/gerber-send`)
- Ne JAMAIS supprimer de messages
- Statuts disponibles : `pending` | `done` (pas de ack/dismissed)
- Types disponibles : `context` | `reminder` (pas de issue/task)
- Utiliser exclusivement les outils MCP `mcp__gerber__*` — jamais curl
