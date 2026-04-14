---
name: gerber-capture
description: "Capture rapide d'un atome de connaissance (gotcha, pattern, décision) pendant une session."
user-invocable: true
---

# gerber-capture

Capture un atome de connaissance (gotcha, pattern, décision architecturale) dans agent-brain pendant une session active.

## Workflow

### 1. Résoudre le projet

Lire le `CLAUDE.md` du repo courant et chercher une section `## Gerber` contenant un slug.
Fallback : lire `.gerber-slug`, puis `basename` du répertoire courant.
Si aucun slug trouvable, afficher une erreur et s'arrêter.

### 2. Extraire le contenu

- Si un argument a été passé à `/gerber-capture <description>`, l'utiliser comme point de départ.
- Sinon, analyser les ~10 derniers messages de la conversation pour extraire le fait/gotcha/pattern/décision le plus saillant.

### 3. Structurer la note

Générer :
- **title** : max 200 caractères, descriptif et concis
- **content** : 5 à 50 lignes markdown selon le type :
  - **Gotcha** : `**Problème** / **Cause** / **Fix** / **Fichier(s)**`
  - **Pattern** : `**Contexte** / **Pattern** / **Exemple**`
  - **Décision** : `**Décision** / **Alternatives considérées** / **Raison**`
- **tags** : tableau de strings pertinents (technologie, domaine, type)

### 4. Dedup — recherche sémantique

Avant de créer, effectuer une recherche sémantique avec le titre via `mcp__gerber__search` :
- `query` : le titre généré
- `mode` : `"semantic"`
- `limit` : 3

Si un résultat a un score > 0.92, afficher la note existante et demander :
```
Une note similaire existe déjà (score: X.XX) :
  ID: <id>
  Titre: <title>

Créer quand même ? (o/n)
```
Si l'utilisateur répond `n`, s'arrêter.

### 5. Confirmer + Créer

Afficher le draft complet (titre, tags, contenu) et demander confirmation :
```
--- Draft ---
Titre : <title>
Tags  : [<tag1>, <tag2>]

<content>
-------------
Capturer cette note ? (o/n)
```

Si confirmé, appeler `mcp__gerber__note_create` avec :
- `title` : le titre
- `kind` : `"atom"`
- `content` : le contenu markdown
- `tags` : les tags
- `source` : `"ai"`
- `projectSlug` : le slug résolu

### 6. Output

En cas de succès, afficher :
```
Note capturée : "<title>"
  Tags : [<tags>]
  ID   : <id>
```

## Contraintes absolues

- Ne JAMAIS créer de note avec `kind: 'document'` — uniquement `kind: 'atom'`
- Ne JAMAIS modifier une note existante
- Toujours demander confirmation avant de créer
- Utiliser exclusivement les outils MCP `mcp__gerber__*` — jamais curl
