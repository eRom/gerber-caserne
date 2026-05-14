---
name: docs-rag
description: "Recherche sémantique dans le vault Gemini (FileSearchStore) puis fetch GitHub des docs cités. Use when l'utilisateur invoque /docs-rag '<question>' pour interroger la mémoire technique cross-projets (specs, plans, .cave, docs/superpowers...)."
user-invocable: true
---

# docs-rag

Interroge le vault Gemini en deux temps :
1. **RAG** : Gemini fait la recherche vectorielle dans son FileSearchStore et retourne la liste des docs pertinents.
2. **Ground truth** : on fetch le contenu intégral de chaque doc depuis GitHub (gère les repos privés via PAT).

Tu (l'agent appelant) reçois un Markdown structuré avec sources + contenu brut, et tu synthétises une réponse fidèle à la vérité-terrain.

## Workflow

### 1. Choisir le mode d'exécution

Deux chemins possibles, **préférer le MCP** :

**A. Mode MCP (recommandé, marche partout)** — appel direct à l'outil `mcp__gerber__docs_rag` :
```
mcp__gerber__docs_rag({ question: "<question>", repo?: "owner/name" })
```
Marche sur Claude.ai, Claude Desktop, Claude Code dès que le MCP gerber est configuré. Les secrets (`VAULT_EMBED_API_KEY`, `VAULT_GERBER_PAT`) sont gérés côté serveur, rien à faire localement.

**B. Mode script local (fallback)** — uniquement si le MCP gerber n'est pas dispo :
```bash
bun run "${CLAUDE_PLUGIN_ROOT}/skills/docs-rag/scripts/query-rag.ts" "<question>"
```
Requiert `VAULT_EMBED_API_KEY` et `VAULT_CORPUS_NAME` dans l'env local + `gh` authentifié (`gh auth status`).

### 2. Lire la sortie

Dans les deux modes, la sortie est du Markdown structuré :

```markdown
# Vault RAG — résultat
**Question** : ...
**Sources trouvées** : N

## Sources
- `owner/repo` → `chemin/du/fichier.md`
- ...

## Contenu intégral
### `owner/repo/chemin/du/fichier.md`
<contenu complet du fichier en bloc de code>
```

### 3. Synthétiser

À partir du contenu intégral récupéré :
- Construire une réponse précise et fidèle à la question de l'utilisateur.
- **Citer obligatoirement chaque source utilisée** sous la forme `[owner/repo:chemin]`.
- Ne JAMAIS inventer d'information absente des docs fetchés.
- Si aucune source n'a été trouvée, l'annoncer et proposer de reformuler la question ou de vérifier que la sync vault est à jour.

## Cas particuliers

- **Fetch failed sur un fichier** : la sortie remplace le contenu par `[Fetch failed: ...]`. Mentionner que ce doc n'a pas pu être lu et n'utiliser que les autres.
- **Repo privé sans accès** : 404 ou 401. Côté MCP, vérifier que le `VAULT_GERBER_PAT` du serveur a le repo dans sa liste autorisée + `Contents: read`. Côté script local, faire `gh auth refresh -s repo`.
- **Store introuvable** : la sync vault-bootstrap n'a jamais tourné. Lancer le workflow GitHub Actions `Vault Bootstrap` sur le repo concerné.
- **`mcp__gerber__docs_rag` indisponible** : tomber sur le mode B (script local) et signaler à l'utilisateur que le MCP gerber n'est pas connecté.

## Contraintes

- **Ne pas appeler le tool/script sans question** (les deux refusent).
- **Ne pas chaîner plusieurs invocations** pour la même question — une seule passe.
- **Ne pas modifier le vault** depuis cette skill (read-only). Pour les écritures, c'est le workflow `sync.yml` qui s'en charge automatiquement sur push.
