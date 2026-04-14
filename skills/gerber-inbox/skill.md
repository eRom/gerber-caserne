---
name: gerber-inbox
description: "Consulte les messages inter-sessions (context, reminder) du bus central erom via gerber MCP."
user-invocable: true
---

# /inbox — Consulte les messages inter-sessions

## Étape 1 — Lister les messages

Tous les messages transitent par le projet central `erom`.

Déterminer le filtre de statut selon l'argument :

| Invocation      | Filtre status   |
|-----------------|-----------------|
| `/inbox`        | `"pending"`     |
| `/inbox all`    | aucun filtre    |
| `/inbox done`   | `"done"`        |

Appeler `mcp__gerber__message_list` avec :
- `projectSlug` : `"erom"` (toujours)
- `status` : le filtre (omettre pour `/inbox all`)

## Étape 2 — Affichage formaté

```
=== Inbox ({count} {status}) ===

[i] Design system: utiliser les tokens amber pour...
    from: erom | 1d ago

[R] Tester le flow HealthKit sur device physique avant...
    from: myhealth | 1d ago
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
=== Inbox (0 pending) ===
Aucun message en attente.
```

## Étape 3 — Proposer des actions

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
