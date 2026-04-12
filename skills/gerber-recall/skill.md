---
name: gerber-recall
description: "Recherche dans gerber du contexte pertinent pour la question ou tâche en cours."
user-invocable: true
---

# gerber-recall

Recherche du contexte pertinent dans agent-brain pour la requête fournie.

## Workflow

### 1. Résoudre le projet

Lire le CLAUDE.md du projet courant pour trouver le `projectSlug` dans la section `## agent-brain`.
Fallback : lire `.gerber-slug` à la racine du repo, puis `basename "$PWD"`.
Si aucune correspondance trouvée → erreur : "Exécute /gerber-onboarding d'abord."

### 2. Recherche dans le projet

Appeler `mcp__gerber__search` avec :
- `query` : la requête utilisateur
- `mode` : `"hybrid"`
- `projectId` ou laisser vide et filtrer côté résultats
- `limit` : 8

Note : le param `projectSlug` n'existe pas sur `search` — utiliser le `projectId` résolu via `mcp__gerber__project_list` si besoin de filtrer par projet. Sinon, faire une recherche globale et séparer les résultats par projet en post-traitement.

### 3. Recherche globale

Appeler `mcp__gerber__search` avec :
- `query` : même requête
- `mode` : `"hybrid"`
- `limit` : 5

### 4. Merge & déduplication

- Combiner les résultats des deux recherches
- Dédupliquer par `ownerId`
- Trier par score décroissant
- Conserver les 10 premiers

### 5. Hydratation des résultats

Pour chaque résultat :

- **Atom** : afficher `title` + `snippet` + `tags`
- **Chunk** : afficher `parent.title > chunk.headingPath` + `snippet`
- **Si score > 0.85** : appeler `mcp__gerber__note_get` avec l'`id` de la note pour récupérer le contenu complet

### 6. Output

Produire un markdown structuré avec deux sections :

```markdown
## Notes du projet

<!-- résultats du projet courant -->

## Notes globales

<!-- résultats autres projets, non déjà listés ci-dessus -->
```

## Contraintes

- Ce skill ne crée ni ne modifie aucune note.
- Utiliser exclusivement les outils MCP `mcp__gerber__*` — jamais curl.
