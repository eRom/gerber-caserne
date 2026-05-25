---
name: inbox
description: "Affiche les messages Pending du bus gerber pour le projet courant + le projet global `caserne`. IDs Airtable déjà en contexte global via ~/.gemini/GERBER.md. Triés par importance (🔴 → 🟠 → 🟢) puis date. Déclenche dès que l'utilisateur dit 'inbox', 'mes messages', 'qu'est-ce que j'ai en attente', '/gerber:inbox', 'check ma boîte de réception'."
user-invocable: true
---

# inbox

Lit les messages `status = Pending` adressés au projet courant ET au projet global `caserne`.

## IDs Airtable

Depuis `~/.gemini/GERBER.md` (déjà en contexte) retrouvé les IDs Airtable.


## Étape 1 — Détecter le projet courant

`git remote get-url origin` → dernier segment sans `.git`. Fallback : `basename "$PWD"`. Résultat en **kebab-case minuscule**.

## Étape 2 — Récupérer les messages

```
mcp_airtable_list_records_for_table({
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

Filtrer côté client : `records.filter(r => r.cellValuesByFieldId[status_id]?.name === "Pending")`.

## Étape 3 — Affichage

Groupé par importance, du plus urgent au moins urgent :

```
=== Inbox (<N> messages Pending) ===

🔴 high
  ▸ <recXXXXXXX> · <project> · <age>
    <title>
    > <première ligne de content tronquée à 80 chars>

🟠 medium
  ...

🟢 low
  ...
```

- `age` calculé depuis `createdTime` (`2h`, `hier`, `3j`).
- Si vide : `=== Inbox (0 messages Pending) ===\n\nRien en attente sur "<current_project>" ni "caserne". ✨`

## Étape 4 — Marquer Done (optionnel)

Demander : `Marquer un ou plusieurs messages Done ? (id court / "all" / "non")`

Pour chaque id :
```
mcp_airtable_update_records_for_table({
  baseId: "<base_id>",
  tableId: "<table_id>",
  records: [{ id: "<rec_id>", fields: { "<status_id>": "Done" }}]
})
```

## Contraintes

- Read-only par défaut. Écriture uniquement si l'utilisateur le demande à l'étape 4.
- Ne JAMAIS lister les messages `Done` par défaut. Si demandé explicitement, refaire l'appel sans filtre client.
