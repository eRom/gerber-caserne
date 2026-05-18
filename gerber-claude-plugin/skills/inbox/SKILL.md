---
name: inbox
description: "Affiche les messages Pending du bus gerber pour le projet courant + le projet global `caserne`. Lit les IDs Airtable depuis la section `## Messages bus` du CLAUDE.md du repo. Triés par importance (🔴 → 🟠 → 🟢) puis par date (récents en premier). Déclenche dès que l'utilisateur dit 'inbox', 'mes messages', 'qu'est-ce que j'ai en attente', '/gerber:inbox', 'check ma boîte de réception', ou veut consulter les messages laissés par ses sessions précédentes."
user-invocable: true
---

# Skill : inbox — Lire les messages en attente du bus gerber

Le bus messages est hébergé sur Airtable (workspace `gerber-bus`, base `bus`, table `Messages`). Cette skill liste les messages `status = Pending` adressés à :

- le **projet courant** (détecté via git remote / basename), ET
- le **projet global** `caserne` (broadcast cross-projet).

## Étape 1 — Résoudre les IDs Airtable

Lire la section `## Messages bus` du fichier `CLAUDE.md` à la racine du repo courant.

Le bloc attendu :
```markdown
## Messages bus

- **Workspace** : gerber-bus (`wsp...`)
- **Base** : bus (`app...`)
- **Table** : Messages (`tbl...`)
- **Fields** :
  - `title` (primary) : `fld...`
  - `project` : `fld...`
  - `importance` (🟢 low / 🟠 medium / 🔴 high) : `fld...`
  - `content` : `fld...`
  - `status` (Pending / Done) : `fld...`
```

Extraire `base_id`, `table_id`, et les 5 `field_id`.

**Si la section est absente** :
```
La section ## Messages bus est absente du CLAUDE.md de ce projet.
Lance /gerber:onboarding pour l'ajouter (ou /gerber:setup-bus si l'infra
Airtable n'est pas encore créée).
```
STOP.

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
- **Lire les IDs depuis le CLAUDE.md, pas en hardcodé dans cette skill** : ça permet à la même skill de servir tous les repos onboardés, chacun avec ses propres `base_id`/`table_id`/`field_id` si la config évolue.
- Toujours passer les IDs Airtable (`app...`, `tbl...`, `fld...`, `rec...`) tels quels — jamais substituer les noms aux IDs.
- Ne JAMAIS lister les messages `status = Done` par défaut. Si l'utilisateur demande explicitement (« montre l'historique », « les messages traités »), refaire l'appel sans filtre côté client.
