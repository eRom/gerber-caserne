---
name: inbox
description: "Affiche les messages Pending du bus Gerber pour le projet courant + `caserne`. Use when l'utilisateur dit inbox, mes messages, /gerber:inbox, ou demande ce qui est en attente."
user-invocable: true
---

# inbox

Lit les messages `Pending` adresses au projet courant et au projet global `caserne`.

## IDs Airtable

Depuis `~/.codex/GERBER.md` :
- `base_id` = `appnSsuI4s3PjHqJg`
- `table_id` = `tblrTrs0RAH6MkJ2h`
- `title_id` = `fldGH4oVJgied1rZm`
- `project_id` = `fldTOGX0IIajBdXa8`
- `importance_id` = `fldPP2ozFl8HQPqRE`
- `content_id` = `fld0hGeNFXq2KrpDv`
- `status_id` = `fldROhGQVvAhhMJDZ`

## Workflow

1. Detecter le projet courant : `git remote get-url origin`, dernier segment sans `.git`; fallback `basename "$PWD"`. Convertir en kebab-case minuscule.
2. Utiliser le MCP Airtable deja installe pour lister `Messages` avec les fields ci-dessus, filtre project courant OU `caserne`, tri importance desc puis creation desc, `pageSize: 50`.
3. Filtrer cote client : `status.name === "Pending"` ou `status === "Pending"`.
4. Afficher par importance : `🔴 high`, `🟠 medium`, `🟢 low`.
5. Proposer de marquer Done uniquement apres affichage.

## Format

```text
=== Inbox (<N> messages Pending) ===

🔴 high
  ▸ <recXXXXXXX> · <project> · <age>
    <title>
    > <premiere ligne de content tronquee a 80 chars>
```

Vide :

```text
=== Inbox (0 messages Pending) ===

Rien en attente sur "<current_project>" ni "caserne".
```

## Marquer Done

Demander : `Marquer un ou plusieurs messages Done ? (id court / all / non)`.

Si l'utilisateur confirme, utiliser le MCP Airtable pour mettre `status` a `Done` sur les records choisis.

## Contraintes

- Read-only par defaut.
- Ecriture uniquement apres confirmation explicite.
- Ne jamais lister les messages `Done` par defaut.
