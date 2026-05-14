---
name: docs-rag
description: "Recherche sémantique dans le vault Gemini (FileSearchStore) puis fetch GitHub des docs cités. Use when l'utilisateur invoque /docs-rag '<question>' pour interroger la mémoire technique cross-projets (specs, plans, .cave, docs/superpowers...)."
user-invocable: true
---

# docs-rag

Interroge le vault Gemini en deux temps :
1. **RAG** : Gemini fait la recherche vectorielle dans son FileSearchStore et retourne la liste des docs pertinents (sources only, mode agent).
2. **Ground truth** : on fetch le contenu intégral de chaque doc depuis GitHub via `gh api` (gère les repos privés via l'auth `gh` déjà en place).

Tu (l'agent appelant) reçois un Markdown structuré avec sources + contenu brut, et tu synthétises une réponse fidèle à la vérité-terrain.

## Workflow

### 1. Pré-vol

Vérifier la présence des deux variables d'environnement :
- `VAULT_EMBED_API_KEY` (clé Gemini API)
- `VAULT_CORPUS_NAME` (displayName du FileSearchStore)

Si l'une manque → erreur claire : « Configure VAULT_EMBED_API_KEY et VAULT_CORPUS_NAME dans ton shell avant d'utiliser /docs-rag ».

Vérifier aussi que `gh` est authentifié : `gh auth status`. Si non → demander à l'utilisateur de faire `gh auth login`.

### 2. Lancer le script

Exécuter via Bash :

```bash
bun run "${CLAUDE_PLUGIN_ROOT}/skills/docs-rag/scripts/query-rag.ts" "<question>"
```

Options :
- `--repo owner/name` : restreint la recherche et le fetch à un repo précis.

Si `${CLAUDE_PLUGIN_ROOT}` n'est pas défini, fallback : résoudre depuis le chemin du plugin gerber installé.

### 3. Lire la sortie

Le script imprime un Markdown structuré :

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

### 4. Synthétiser

À partir du contenu intégral récupéré :
- Construire une réponse précise et fidèle à la question de l'utilisateur.
- **Citer obligatoirement chaque source utilisée** sous la forme `[owner/repo:chemin]`.
- Ne JAMAIS inventer d'information absente des docs fetchés.
- Si aucune source n'a été trouvée, l'annoncer et proposer de reformuler la question ou de vérifier que la sync vault est à jour.

## Cas particuliers

- **Fetch failed sur un fichier** : le script remplace le contenu par `[Fetch failed: ...]`. Mentionner que ce doc n'a pas pu être lu et n'utiliser que les autres.
- **Repo privé sans accès** : `gh` retournera 404. Suggérer de vérifier les permissions du token.
- **Store introuvable** : la sync vault-bootstrap n'a jamais tourné. Lancer le workflow GitHub Actions `Vault Bootstrap` sur le repo concerné.

## Contraintes

- **Ne pas appeler le script sans question** (il refusera).
- **Ne pas chaîner plusieurs invocations** pour la même question — une seule passe.
- **Ne pas modifier le vault** depuis cette skill (read-only). Pour les écritures, c'est le workflow `sync.yml` qui s'en charge automatiquement sur push.
