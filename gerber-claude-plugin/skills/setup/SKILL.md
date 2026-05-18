---
name: setup
description: "Initialise (ou répare) l'infrastructure Airtable du bus messages gerber : workspace `gerber-bus`, base `bus`, table `Messages` avec ses 5 fields. Idempotent — peut être relancé à tout moment, ne touche pas à ce qui existe déjà. Déclenche quand l'utilisateur dit 'setup gerber', 'setup bus messages', '/gerber:setup', 'configure l'airtable gerber', ou veut s'assurer que l'infra du bus est en place."
user-invocable: true
---

# Skill : setup — Infra Airtable du bus messages

Cette skill garantit que l'infrastructure Airtable du bus de messages gerber est en place et conforme au schéma attendu. **Idempotente** : à chaque step, on vérifie l'existence avant d'agir.

Le bus repose sur cette structure (immuable, conventions de naming gravées) :

| Niveau | Nom | Notes |
|---|---|---|
| Workspace | `gerber-bus` | Créé manuellement dans l'UI Airtable (le MCP n'expose pas la création de workspace). |
| Base | `bus` | Créée par cette skill si absente. |
| Table | `Messages` | Créée par cette skill si absente. |

**Fields requis sur la table `Messages`** (créés/vérifiés dans cet ordre) :

| Field | Type | Notes |
|---|---|---|
| `title` | `singleLineText` | Primary field. |
| `project` | `singleLineText` | Destinataire en kebab-case (ex: `agent-brain`, `caserne`). Défaut `caserne` (global). |
| `importance` | `singleSelect` | Choices : `🟢 low` (greenBright), `🟠 medium` (orangeBright), `🔴 high` (redBright). |
| `content` | `multilineText` | Markdown brut. |
| `status` | `singleSelect` | Choices : `Pending` (yellowBright), `Done` (grayBright). |

`createdTime` est natif Airtable, pas besoin de le créer.

## Étape 0 — Préchecks

### 0.1 MCP Airtable connecté

```
mcp__plugin_airtable_airtable__ping
```

Doit retourner `pong`. Sinon : prévenir l'utilisateur qu'il faut installer le plugin Airtable (`/plugin install airtable` → `/reload-plugins` → `/mcp` pour authentifier).

## Étape 1 — Workspace `gerber-bus`

```
mcp__plugin_airtable_airtable__list_workspaces
```

Chercher dans la réponse un workspace avec `name == "gerber-bus"` (case-insensitive).

- Si **trouvé** : noter son `id` (`wsp...`). Continuer.
- Si **absent** : STOP avec ce message :
  ```
  Workspace "gerber-bus" introuvable.

  La création de workspace n'est pas exposée par le MCP Airtable.
  Crée-le manuellement :
    1. Ouvrir https://airtable.com
    2. Cliquer "+ Add a workspace"
    3. Nommer "gerber-bus"
    4. Relancer /gerber:setup
  ```

## Étape 2 — Base `bus`

```
mcp__plugin_airtable_airtable__list_bases
```

Chercher dans la réponse une base avec `name == "bus"`. Si la réponse n'expose pas le `workspaceId` par base, on accepte la première qui matche par nom (on assume qu'elle est dans `gerber-bus`).

- Si **trouvée** : noter son `id` (`app...`). Passer à l'étape 3.
- Si **absente** : créer la base AVEC la table `Messages` et tous les fields en un seul appel (atomique) :
  ```
  mcp__plugin_airtable_airtable__create_base({
    workspaceId: "<workspace_id>",
    name: "bus",
    tables: [{
      name: "Messages",
      description: "Bus de messages inter-sessions Claude. 1 message = 1 projet destinataire (kebab-case, defaut: caserne). Status Pending tant que non lu, Done une fois traite.",
      fields: [
        { name: "title", type: "singleLineText", description: "Titre court du message." },
        { name: "project", type: "singleLineText", description: "Projet destinataire en kebab-case. Defaut: caserne." },
        { name: "importance", type: "singleSelect", options: { choices: [
          { name: "🟢 low", color: "greenBright" },
          { name: "🟠 medium", color: "orangeBright" },
          { name: "🔴 high", color: "redBright" }
        ]}, description: "Priorite visuelle." },
        { name: "content", type: "multilineText", description: "Corps du message en markdown brut." },
        { name: "status", type: "singleSelect", options: { choices: [
          { name: "Pending", color: "yellowBright" },
          { name: "Done", color: "grayBright" }
        ]}, description: "Pending = pas encore lu/traite. Done = traite." }
      ]
    }]
  })
  ```
  Tout est créé en une passe. **Passer directement à l'étape 5 (récap)** — pas besoin de vérifier les fields un par un.

## Étape 3 — Table `Messages`

```
mcp__plugin_airtable_airtable__list_tables_for_base({ baseId: "<base_id>" })
```

Chercher une table avec `name == "Messages"`.

- Si **trouvée** : noter son `id` (`tbl...`) et son tableau `fields` (avec leurs `id`, `name`, `type`). Passer à l'étape 4.
- Si **absente** : créer la table avec tous les fields (même payload que la définition du `create_base` ci-dessus, mais via `create_table`) :
  ```
  mcp__plugin_airtable_airtable__create_table({
    baseId: "<base_id>",
    name: "Messages",
    description: "...",
    fields: [ ...même 5 fields que ci-dessus... ]
  })
  ```
  **Passer directement à l'étape 5** — tous les fields viennent d'être créés en une passe.

## Étape 4 — Fields individuels (cas table préexistante)

Pour **chaque field requis** (dans l'ordre `title`, `project`, `importance`, `content`, `status`) :

1. Chercher s'il existe déjà dans le tableau `fields` de l'étape 3 (match par `name`, case-sensitive).
2. S'il **existe** : noter son `id`. Ne PAS le modifier même si son type/options semblent différer (modifications destructives potentielles).
3. S'il **n'existe pas** : le créer via :
   ```
   mcp__plugin_airtable_airtable__create_field({
     baseId: "<base_id>",
     tableId: "<table_id>",
     field: { ...définition du field manquant... }
   })
   ```

**Cas particulier `importance` et `status`** : si l'un des choices manque (ex: tu as renommé `Pending` en `Inbox`), la skill ne corrige PAS automatiquement — elle log un warning et continue. Pour reset propre : delete la base manuellement et relance `/gerber:setup`.

## Étape 5 — Récap

Afficher :

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

  Actions effectuées : <created | found> × <nb>

Tu peux maintenant utiliser /gerber:send et /gerber:inbox.
```

Détailler dans la section « Actions effectuées » ce qui a été réellement créé vs trouvé existant. Ex :
- `base "bus" créée + 5 fields` (cas full setup)
- `tous les éléments existent déjà — rien à faire` (cas idempotent re-run)
- `field "importance" créé, le reste existait` (cas réparation partielle)

## Contraintes

- **Ne jamais delete** : aucune destruction, jamais. Si la base ou la table existe avec un mauvais schéma, on log et on continue. L'utilisateur fait le reset manuellement.
- **Ne jamais modifier un field existant** : `update_field` n'est PAS appelée, même si le type semble différent. Trop risqué (perte de données).
- **Respecter les IDs Airtable** : ne JAMAIS substituer les noms aux IDs dans les calls (`baseId`, `tableId`, `fieldId` sont toujours des `app/tbl/fld...`).
- **Idempotence avant tout** : à chaque relance, la skill doit pouvoir tourner sans effet de bord si l'infra est déjà correcte.
