---
name: send
description: "Envoie un message sur le bus gerber (Airtable). Destinataire par défaut : `caserne` (global). Sinon nom de projet en kebab-case. IDs Airtable déjà en contexte global via ~/.claude/GERBER.md. Déclenche dès que l'utilisateur dit 'envoie un message', 'note pour caserne', 'send', 'rappelle-moi sur <projet>', '/gerber:send'."
user-invocable: true
---

# send

Compose et dépose un message sur le bus. Status `Pending` à la création.

## IDs Airtable

Depuis `~/.claude/GERBER.md` (déjà en contexte) :
- `base_id` = `appnSsuI4s3PjHqJg`, `table_id` = `tblrTrs0RAH6MkJ2h`
- `title_id` = `fldGH4oVJgied1rZm`, `project_id` = `fldTOGX0IIajBdXa8`, `importance_id` = `fldPP2ozFl8HQPqRE`, `content_id` = `fld0hGeNFXq2KrpDv`, `status_id` = `fldROhGQVvAhhMJDZ`

## Étape 1 — Composer le draft

**`project`** (destinataire, kebab-case minuscule final) :
- Si l'utilisateur a nommé un projet → utiliser ce nom.
- Si « pour ce projet », « le projet courant » → `git remote get-url origin` → fallback `basename "$PWD"`.
- Sinon (silence/ambiguïté) → **`caserne`** (broadcast global).

**`title`** : 3–8 mots descriptifs, pas de ponctuation finale.

**`content`** : markdown brut. Pas de template imposé — adapter à la nature (idée / rappel / note technique). Suffisant pour qu'une session fraîche comprenne sans repartir de zéro.

**`importance`** :
- `🟢 low` (défaut) — volatile, pas urgent
- `🟠 medium` — à traiter dans la semaine
- `🔴 high` — à voir dès la prochaine session

## Étape 2 — Confirmation

```
--- Message ---
À          : <project>
Importance : <emoji + label>
Titre      : <title>

<content>
---------------
Envoyer ? (oui / modifier / annuler)
```

`modifier` → demander quel champ, reboucler. `annuler`/`non` → terminer sans appel API.

## Étape 3 — Créer le record

```
mcp__plugin_airtable_airtable__create_records_for_table({
  baseId: "<base_id>",
  tableId: "<table_id>",
  records: [{
    fields: {
      "<title_id>": "<title>",
      "<project_id>": "<project>",
      "<importance_id>": "<importance_choice_name>",
      "<content_id>": "<content>",
      "<status_id>": "Pending"
    }
  }]
})
```

Les `singleSelect` acceptent directement le `name` du choice (`"🟢 low"`, `"Pending"`).

Confirmer : `Message envoyé sur "<project>" — <rec_id>` + URL Airtable.

## Contraintes

- Toujours demander confirmation avant d'écrire — le contenu est généré, l'utilisateur doit pouvoir amender.
- `project` toujours en kebab-case minuscule (convertir si besoin).
- Défaut `caserne` + `🟢 low` si rien n'est précisé.
- Ne JAMAIS écrire `status: Done` à la création.
- Un message par appel. Si l'utilisateur en veut 3, faire 3 appels.
