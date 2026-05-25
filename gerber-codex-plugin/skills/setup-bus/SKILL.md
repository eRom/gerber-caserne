---
name: setup-bus
description: "Initialise ou repare l'infrastructure Airtable du bus messages Gerber. Idempotent. Use when l'utilisateur dit setup bus, configure Airtable Gerber, ou /gerber:setup-bus."
user-invocable: true
---

# setup-bus

Garantit que l'infra Airtable du bus messages est en place. Idempotent : verifier avant d'agir, ne jamais supprimer ni modifier un field existant.

## Schema cible

| Niveau | Nom |
|---|---|
| Workspace | `gerber-bus` |
| Base | `bus` |
| Table | `Messages` |

Fields sur `Messages`, dans l'ordre :
- `title` : `singleLineText`, primary
- `project` : `singleLineText`
- `importance` : `singleSelect`, choices `🟢 low`, `🟠 medium`, `🔴 high`
- `content` : `multilineText`
- `status` : `singleSelect`, choices `Pending`, `Done`

`createdTime` est natif Airtable.

## Workflow

1. Verifier que le MCP Airtable deja installe repond. Sinon stopper avec une instruction d'authentification Airtable.
2. Lister les workspaces, chercher `gerber-bus` case-insensitive. Si absent, stopper : le workspace doit etre cree dans l'UI Airtable.
3. Lister les bases, chercher `bus`.
4. Si `bus` est absente, creer la base avec la table `Messages` et tous les fields en un seul appel.
5. Si `bus` existe, lister ses tables et chercher `Messages`.
6. Si `Messages` est absente, creer la table avec les fields cibles.
7. Si la table existe, verifier chaque field par nom :
   - s'il existe, noter son id sans le modifier;
   - s'il manque, le creer;
   - si un choice manque dans un `singleSelect`, ne pas modifier le field, logguer un warning.

## Recap

```text
Infra Airtable du bus messages : OK

  Workspace : gerber-bus (<workspace_id>)
  Base      : bus (<base_id>)
  Table     : Messages (<table_id>)
  Fields    :
    - title       (<field_id>) singleLineText [primary]
    - project     (<field_id>) singleLineText
    - importance  (<field_id>) singleSelect
    - content     (<field_id>) multilineText
    - status      (<field_id>) singleSelect

  Actions : <created | found> x <nb>
```

## Contraintes

- Ne jamais supprimer.
- Ne jamais appeler d'update sur un field existant.
- Toujours utiliser les IDs Airtable reels, jamais les noms en remplacement d'ID.
- Relance sans effet si l'infra est deja correcte.
