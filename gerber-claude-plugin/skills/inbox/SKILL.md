---
name: inbox
description: "Affiche les messages Pending du bus gerber pour le projet courant + le projet global `caserne`. Les IDs Airtable sont déjà en contexte global via ~/.claude/GERBER.md. Triés par importance (🔴 → 🟠 → 🟢) puis par date (récents en premier). Déclenche dès que l'utilisateur dit 'inbox', 'mes messages', 'qu'est-ce que j'ai en attente', '/gerber:inbox', 'check ma boîte de réception', ou veut consulter les messages laissés par ses sessions précédentes."
user-invocable: true
---

# Skill : inbox — Lire les messages en attente du bus gerber

Le bus messages est hébergé sur Airtable (workspace `gerber-bus`, base `bus`, table `Messages`). Cette skill liste les messages `status = Pending` adressés à :

- le **projet courant** (détecté via git remote / basename), ET
- le **projet global** `caserne` (broadcast cross-projet).

## Étape 1 — Résoudre les IDs Airtable

Les IDs sont déjà en contexte global via `~/.claude/GERBER.md` (chargé automatiquement par `~/.claude/CLAUDE.md`). Utilise directement :

- `base_id` = `appnSsuI4s3PjHqJg` (bus)
- `table_id` = `tblrTrs0RAH6MkJ2h` (Messages)
- `title_id` = `fldGH4oVJgied1rZm`
- `project_id` = `fldTOGX0IIajBdXa8`
- `importance_id` = `fldPP2ozFl8HQPqRE`
- `content_id` = `fld0hGeNFXq2KrpDv`
- `status_id` = `fldROhGQVvAhhMJDZ`

Aucune résolution dynamique à faire. Si jamais ces IDs ne sont pas en contexte (cas dégénéré, GERBER.md absent), invite l'utilisateur à relancer `/gerber:setup-bus`.

## Étape 2 — Détecter le projet courant

Ordre de priorité :

1. **Remote Git** : `git remote get-url origin` → extraire le dernier segment, retirer `.git`. Ex : `git@github.com:eRom/agent-brain.git` → `agent-brain`.
2. **Dossier courant** : `basename "$PWD"`.
3. **Ask user** si aucune commande n'est exécutable.

Le résultat doit être en **kebab-case minuscule** (forme dans laquelle les messages sont stockés).

## Étape 3 — Récupérer les messages

Appel unique :

```
mcp__plugin_airtable_airtable__list_records_for_table({
  baseId: "<base_id>",
  tableId: "<table_id>",
  fieldIds: ["<title_id>", "<project_id>", "<importance_id>", "<content_id>", "<status_id>"],
  filters: {
    operator: "or",
    operands: [
      { operator: "=", operands: ["<project_id>", "<current_project>"] },
      { operator: "=", operands: ["<project_id>", "caserne"] }
    ]
  },
  sort: [
    { fieldId: "<importance_id>", direction: "desc" },
    { fieldId: "createdTime", direction: "desc" }
  ],
  pageSize: 50
})
```

**Note** : on filtre par `project` côté Airtable (champ texte → opérateur `=` direct). Le filtre `status = Pending` est appliqué **côté client** après réception (singleSelect → nécessiterait le choice ID hardcodé, on s'en passe pour rester simple).

Côté client, filtrer : `records.filter(r => r.cellValuesByFieldId[status_id]?.name === "Pending")`.

## Étape 4 — Affichage

Format groupé par importance, du plus urgent au moins urgent. Pour chaque message :

```
=== Inbox (<N> messages Pending) ===

🔴 high
  ▸ <recXXXXXXX> · <project> · <age>
    <title>
    > <première ligne de content tronquée à 80 chars>

🟠 medium
  ▸ <recXXXXXXX> · <project> · <age>
    <title>
    ...

🟢 low
  ▸ <recXXXXXXX> · <project> · <age>
    <title>
    ...
```

- `age` calculé depuis `createdTime` (ex: `2h`, `hier`, `3j`).
- `recXXXXXXX` = id court (14 chars après `rec`), utile pour `--mark-done`.
- Si vide :
  ```
  === Inbox (0 messages Pending) ===

  Rien en attente sur "<current_project>" ni "caserne". ✨
  ```

## Étape 5 — Optionnel — Marquer un message Done

Après affichage, demander :

```
Veux-tu marquer un (ou plusieurs) message(s) comme Done ? (id court / "all" / "non")
```

- Si `non` (ou vide) → terminer.
- Si `all` → boucler sur tous les ids affichés et update à `Done`.
- Si un ou plusieurs ids → boucler.

Pour chaque id à fermer :

```
mcp__plugin_airtable_airtable__update_records_for_table({
  baseId: "<base_id>",
  tableId: "<table_id>",
  records: [{ id: "<rec_id>", fields: { "<status_id>": "Done" }}]
})
```

Confirmer : `<rec_id> marqué Done.`

## Contraintes

- **Read-only par défaut** : la skill n'écrit dans Airtable que si l'utilisateur demande explicitement à marquer Done à l'étape 5.
- **IDs hardcodés dans cette skill ET dans `~/.claude/GERBER.md`** : single source of truth = GERBER.md global. La skill duplique les valeurs pour rester self-contained, mais en cas de changement, c'est GERBER.md qui fait référence (les skills sont rebuildées via release-plugin).
- Toujours passer les IDs Airtable (`app...`, `tbl...`, `fld...`, `rec...`) tels quels — jamais substituer les noms aux IDs.
- Ne JAMAIS lister les messages `status = Done` par défaut. Si l'utilisateur demande explicitement (« montre l'historique », « les messages traités »), refaire l'appel sans filtre côté client.
