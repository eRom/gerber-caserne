---
name: gerber-send
description: "Envoie un message (context ou reminder) sur le bus central erom via gerber MCP."
user-invocable: true
---

# /send — Envoi de message inter-sessions

## Étape 1 — Parse des arguments

### Mode direct

```
/send <type> "<title>"
```

Extraire `type` et `title` depuis les arguments.

Types valides : `context`, `reminder`

### Mode interactif (pas d'arguments)

1. Demander le type (`context` / `reminder`).
2. Demander le titre.

## Étape 2 — Contenu (corps du message)

Demander le corps du message en markdown.

Pour les `context`, suggérer le format :

```markdown
## Contexte

## Impact
```

Pour les `reminder`, un titre suffit souvent — le corps est optionnel.

## Étape 3 — Résolution du projet source

Déterminer le projet source (l'émetteur) :
1. Lire le `CLAUDE.md` du repo courant pour trouver un slug explicite.
2. Sinon, lire `.gerber-slug`, puis `basename` du répertoire courant.

## Étape 4 — Création du message

Appeler `mcp__gerber__message_create` avec :
- `projectSlug` : `"erom"` (toujours — bus central)
- `type` : le type choisi (`context` ou `reminder`)
- `title` : le titre
- `content` : le corps markdown
- `metadata` :
  - `sourceProject` : le slug source (résolu à l'étape 3)

## Étape 5 — Confirmation

Afficher :

```
Message posté sur erom : [{type}] {title}
  from: {sourceProject} | ID : {id}
```

## Note sur tasks et issues

Les tasks et issues ne passent plus par les messages. Elles sont gérées directement via les MCP tools `task_create` et `issue_create`, rattachées à un projet spécifique.

## Contraintes strictes

- Ne PAS lire les messages existants
- Ne PAS modifier ou lister les messages
- Types valides : `context` | `reminder` uniquement
- Pas de champ `priority` sur les messages
- Le projet cible est TOUJOURS `"erom"` — jamais un autre
- Utiliser exclusivement les outils MCP `mcp__gerber__*` — jamais curl
