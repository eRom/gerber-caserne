---
name: gerber-send
description: "Envoie un message (context ou reminder) à un autre projet via le bus inter-sessions gerber."
user-invocable: true
---

# /send — Envoi de message inter-sessions agent-brain

## Étape 1 — Parse des arguments

### Mode direct

```
/send <projectSlug> <type> "<title>"
```

Extraire `projectSlug`, `type`, `title` depuis les arguments.

Types valides : `context`, `reminder`

### Mode interactif (pas d'arguments)

1. Appeler `mcp__gerber__project_list` pour lister les projets disponibles.
2. Afficher la liste et demander à l'utilisateur de choisir le projet cible.
3. Demander le type (`context` / `reminder`).
4. Demander le titre.

## Étape 2 — Contenu (corps du message)

Demander le corps du message en markdown.

Pour les `context`, suggérer le format :

```markdown
## Contexte

## Impact
```

Pour les `reminder`, un titre suffit souvent — le corps est optionnel.

## Étape 3 — Résolution du projet source

Déterminer le projet source :
1. Lire le `CLAUDE.md` du repo courant pour trouver un slug explicite.
2. Sinon, lire `.gerber-slug`, puis `basename` du répertoire courant.

## Étape 4 — Création du message

Appeler `mcp__gerber__message_create` avec :
- `projectSlug` : le projet cible
- `type` : le type choisi (`context` ou `reminder`)
- `title` : le titre
- `content` : le corps markdown
- `metadata` :
  - `sourceProject` : le slug source

## Étape 5 — Confirmation

Afficher :

```
Message envoyé à {target} : [{type}] {title}
  ID : {id}
```

## Note sur tasks et issues

Les tasks et issues ne passent plus par les messages. Elles sont gérées directement via les MCP tools `task_create` et `issue_create`, rattachées à un projet spécifique. Pour créer une task ou issue sur un autre projet, utiliser directement ces outils avec le `projectSlug` cible.

## Contraintes strictes

- Ne PAS lire les messages existants
- Ne PAS modifier ou lister les messages
- Types valides : `context` | `reminder` uniquement (plus de issue/task)
- Pas de champ `priority` sur les messages
- Utiliser exclusivement les outils MCP `mcp__gerber__*` — jamais curl
