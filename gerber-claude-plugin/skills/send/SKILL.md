---
name: send
description: "Envoie un message sur le bus gerber (Airtable workspace `gerber-bus`, base `bus`, table `Messages`). Destinataire par défaut : `caserne` (global). Sinon nom de projet en kebab-case. Les IDs Airtable sont déjà en contexte global via ~/.claude/GERBER.md. Déclenche dès que l'utilisateur dit 'envoie un message', 'note pour caserne', 'send', 'rappelle-moi sur <projet>', '/gerber:send', ou veut déposer une idée/note volatile pour une session future."
user-invocable: true
---

# Skill : send — Déposer un message sur le bus gerber

Le bus messages est hébergé sur Airtable. Un message = 1 destinataire (kebab-case), 1 titre, 1 contenu markdown, 1 importance, status `Pending` à la création.

## Étape 1 — Résoudre les IDs Airtable

Les IDs sont déjà en contexte global via `~/.claude/GERBER.md` (chargé automatiquement par `~/.claude/CLAUDE.md`). Utilise directement :

- `base_id` = `appnSsuI4s3PjHqJg` (bus)
- `table_id` = `tblrTrs0RAH6MkJ2h` (Messages)
- `title_id` = `fldGH4oVJgied1rZm`
- `project_id` = `fldTOGX0IIajBdXa8`
- `importance_id` = `fldPP2ozFl8HQPqRE`
- `content_id` = `fld0hGeNFXq2KrpDv`
- `status_id` = `fldROhGQVvAhhMJDZ`

Si jamais ces IDs ne sont pas en contexte (cas dégénéré, GERBER.md absent), invite l'utilisateur à relancer `/gerber:setup-bus`.

## Étape 2 — Composer le draft

À partir de la conversation (ou des arguments passés à la skill), composer :

### `project` (destinataire)

- Si l'utilisateur a **nommé explicitement** un projet (« envoie à caserne », « pour agent-brain », « note sur gerber-caserne ») → utiliser ce nom en **kebab-case minuscule**.
- Si l'utilisateur a dit « pour ce projet », « le projet courant » → résoudre via `git remote get-url origin` → fallback `basename "$PWD"`.
- **Sinon** (silence ou ambiguïté) → défaut **`caserne`** (broadcast global).

Toujours en kebab-case minuscule final. Si l'utilisateur dit « Agent Brain » → convertir en `agent-brain`.

### `title`

3 à 8 mots, descriptif du sujet principal. Pas de ponctuation finale. Exemples :
- `Idée : extraire la regex en util commune`
- `Tester l'export markdown sur gros docs`
- `Penser à virer le dead code dans X`

### `content` (markdown brut)

Adapter à la nature du message :
- **Idée** : 1–3 phrases + éventuellement un lien ou un snippet
- **Rappel** : la chose à faire en 1 ligne + le contexte « pourquoi maintenant »
- **Note technique** : la conclusion, un repro, un pointeur de code

**Pas de template imposé**. Vise un contenu suffisant pour qu'une session fraîche comprenne sans repartir de zéro.

### `importance`

- `🟢 low` (défaut) — idée volatile, pas urgent, pas critique
- `🟠 medium` — sujet à traiter dans la semaine
- `🔴 high` — à voir dès la prochaine session sur le projet

Si l'utilisateur n'a pas exprimé d'urgence, défaut **`🟢 low`**.

## Étape 3 — Confirmation

Afficher le draft :

```
--- Message ---
À          : <project>
Importance : <emoji + label>
Titre      : <title>

<content>
---------------
Envoyer ? (oui / modifier / annuler)
```

- `oui` → enchaîner étape 4
- `modifier` → demander quel champ corriger, reboucler
- `annuler` / `non` → terminer la skill sans appel API

## Étape 4 — Créer le record

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

**Note** : pour les fields `singleSelect`, le tool accepte directement le `name` du choice (`"🟢 low"`, `"Pending"`), pas besoin du choice ID.

## Étape 5 — Confirmation finale

```
Message envoyé sur "<project>" — <rec_id>
https://airtable.com/<base_id>/<table_id>/<rec_id>
```

Si l'utilisateur veut envoyer un autre message juste après, reboucler à l'étape 2 (le draft est jetable, on repart à blanc).

## Contraintes

- **Toujours demander confirmation** avant d'écrire (étape 3) — le contenu est généré par l'agent, l'utilisateur doit pouvoir l'amender ou l'annuler.
- **Toujours en kebab-case minuscule** pour le `project`. Si l'utilisateur fournit un nom avec espaces ou majuscules, convertir avant de créer.
- **Défaut `caserne` + `🟢 low`** si l'utilisateur n'a rien précisé. Ne pas inventer un destinataire ou une importance.
- **IDs hardcodés dans cette skill ET dans `~/.claude/GERBER.md`** : single source of truth = GERBER.md global. La skill duplique pour rester self-contained, mais en cas de changement, c'est GERBER.md qui fait référence.
- **Ne JAMAIS écrire `status: Done` à la création**. Done est réservé à la lecture via `/gerber:inbox`.
- **Un seul message par appel** (la skill compose, confirme, envoie). Si l'utilisateur veut envoyer 3 idées d'un coup, faire 3 appels distincts.
