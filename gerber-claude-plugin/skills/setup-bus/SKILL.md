---
name: setup-bus
description: "Initialise (ou répare) l'infrastructure Airtable du bus messages gerber : workspace `gerber-bus`, base `bus`, table `Messages` avec ses 5 fields. Idempotent. Déclenche quand l'utilisateur dit 'setup bus', '/gerber:setup-bus', 'configure l'airtable gerber'."
user-invocable: true
---

# setup-bus

Garantit que l'infra Airtable du bus messages est en place. Idempotente : vérifier avant d'agir, ne jamais delete ni modifier.

## Schéma cible

| Niveau | Nom | Notes |
|---|---|---|
| Workspace | `gerber-bus` | Créé manuellement (MCP n'expose pas la création). |
| Base | `bus` | Créée si absente. |
| Table | `Messages` | Créée si absente. |

Fields sur `Messages` (ordre `title`, `project`, `importance`, `content`, `status`) :
- `title` (singleLineText, **primary**)
- `project` (singleLineText) — kebab-case, défaut `caserne`
- `importance` (singleSelect) — choices : `🟢 low` (greenBright), `🟠 medium` (orangeBright), `🔴 high` (redBright)
- `content` (multilineText) — markdown
- `status` (singleSelect) — choices : `Pending` (yellowBright), `Done` (grayBright)

`createdTime` est natif Airtable.

## Étape 0 — MCP Airtable connecté

`mcp__plugin_airtable_airtable__ping` doit retourner `pong`. Sinon : `/plugin install airtable` → `/reload-plugins` → `/mcp` pour authentifier.

## Étape 1 — Workspace

```
mcp__plugin_airtable_airtable__list_workspaces
```

Match `name == "gerber-bus"` (case-insensitive). Si absent : STOP avec instructions UI Airtable + relancer la skill.

## Étape 2 — Base `bus`

```
mcp__plugin_airtable_airtable__list_bases
```

Match `name == "bus"`.

Si **absente** : créer la base AVEC la table `Messages` et tous les fields en un seul appel :
```
mcp__plugin_airtable_airtable__create_base({
  workspaceId: "<workspace_id>",
  name: "bus",
  tables: [{
    name: "Messages",
    description: "Bus de messages inter-sessions Claude.",
    fields: [
      { name: "title", type: "singleLineText" },
      { name: "project", type: "singleLineText" },
      { name: "importance", type: "singleSelect", options: { choices: [
        { name: "🟢 low", color: "greenBright" },
        { name: "🟠 medium", color: "orangeBright" },
        { name: "🔴 high", color: "redBright" }
      ]}},
      { name: "content", type: "multilineText" },
      { name: "status", type: "singleSelect", options: { choices: [
        { name: "Pending", color: "yellowBright" },
        { name: "Done", color: "grayBright" }
      ]}}
    ]
  }]
})
```

Passer directement à l'étape 5.

## Étape 3 — Table `Messages`

```
mcp__plugin_airtable_airtable__list_tables_for_base({ baseId: "<base_id>" })
```

Match `name == "Messages"`.

Si **absente** : `create_table` avec le même payload de fields que ci-dessus → passer à l'étape 5.

## Étape 4 — Fields (table préexistante)

Pour chaque field requis dans l'ordre :
- S'il existe → noter son `id`, ne PAS le modifier (même si type semble différer — destructif).
- S'il n'existe pas → `create_field` avec la définition correspondante.

Si un choice de `importance`/`status` manque : ne PAS le créer (modification de singleSelect destructive). Log warning et continuer.

## Étape 5 — Récap

```
Infra Airtable du bus messages : OK ✓

  Workspace : gerber-bus (<workspace_id>)
  Base      : bus (<base_id>)
  Table     : Messages (<table_id>)
  Fields    :
    - title       (<field_id>) singleLineText [primary]
    - project     (<field_id>) singleLineText
    - importance  (<field_id>) singleSelect 🟢 / 🟠 / 🔴
    - content     (<field_id>) multilineText
    - status      (<field_id>) singleSelect Pending / Done

  Actions : <created | found> × <nb>
```

## Contraintes

- Ne JAMAIS delete (aucune destruction).
- Ne JAMAIS modifier un field existant (`update_field` non appelée).
- Toujours passer les IDs Airtable tels quels (`app/tbl/fld/rec...`), jamais les noms.
- Idempotence : relance sans effet si l'infra est correcte.
