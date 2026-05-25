---
name: send
description: "Envoie un message sur le bus Gerber Airtable. Destinataire par defaut : `caserne`. Use when l'utilisateur dit envoie un message, note pour caserne, /gerber:send, ou rappelle-moi sur un projet."
user-invocable: true
---

# send

Compose et depose un message sur le bus Gerber. Le status est toujours `Pending` a la creation.

## IDs Airtable

Depuis `~/.codex/GERBER.md` :
- `base_id` = `appnSsuI4s3PjHqJg`
- `table_id` = `tblrTrs0RAH6MkJ2h`
- `title_id` = `fldGH4oVJgied1rZm`
- `project_id` = `fldTOGX0IIajBdXa8`
- `importance_id` = `fldPP2ozFl8HQPqRE`
- `content_id` = `fld0hGeNFXq2KrpDv`
- `status_id` = `fldROhGQVvAhhMJDZ`

## Composer

- `project` : projet nomme par l'utilisateur, ou projet courant si demande, sinon `caserne`.
- Projet courant : `git remote get-url origin` puis fallback `basename "$PWD"`.
- Normaliser `project` en kebab-case minuscule.
- `title` : 3 a 8 mots descriptifs, sans ponctuation finale.
- `content` : markdown brut, assez complet pour une session fraiche.
- `importance` : `🟢 low` par defaut, `🟠 medium` si a traiter dans la semaine, `🔴 high` si prochaine session.

## Confirmation obligatoire

```text
--- Message ---
A          : <project>
Importance : <emoji + label>
Titre      : <title>

<content>
---------------
Envoyer ? (oui / modifier / annuler)
```

`modifier` demande le champ a changer puis reboucle. `annuler` termine sans appel API.

## Creation

Apres confirmation, utiliser le MCP Airtable deja installe pour creer un record dans `Messages` :
- `title`
- `project`
- `importance`
- `content`
- `status = Pending`

Confirmer : `Message envoye sur "<project>" - <rec_id>` avec l'URL Airtable si disponible.

## Contraintes

- Toujours demander confirmation avant ecriture.
- Ne jamais creer un message directement en `Done`.
- Un message par appel.
