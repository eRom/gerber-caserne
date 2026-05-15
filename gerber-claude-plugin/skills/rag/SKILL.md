---
name: rag
description: "Recherche sémantique dans le vault Gemini (FileSearchStore) puis fetch GitHub des docs cités. Use when l'utilisateur invoque /rag '<question>' pour interroger la mémoire technique cross-projets (specs, plans, .cave, docs/superpowers...)."
user-invocable: true
---

# rag

Interroge le vault Gemini en deux temps :
1. **RAG** : Gemini fait la recherche vectorielle dans son FileSearchStore et retourne la liste des docs pertinents.
2. **Ground truth** : le tool fetch le contenu intégral de chaque doc depuis GitHub (gère les repos privés via PAT côté serveur).

Tu (l'agent appelant) reçois un Markdown structuré avec sources + contenu brut, et tu synthétises une réponse fidèle à la vérité-terrain.

## Workflow

### 1. Appeler le tool MCP

```
mcp__gerber__rag({ question: "<question>", repo?: "owner/name" })
```

Marche sur Claude.ai, Claude Desktop, Claude Code, mobile dès que le MCP gerber est configuré. Tous les secrets (`VAULT_EMBED_API_KEY`, `VAULT_GERBER_PAT`) sont gérés côté serveur — rien à configurer en local.

Le paramètre `repo` est optionnel : précise-le pour filtrer la recherche sur un seul satellite (ex: `repo: "eRom/gerber-caserne"`).

### 2. Lire la sortie

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
- **Repo privé sans accès** : 404 ou 401 dans le bloc concerné. Vérifier que le `VAULT_GERBER_PAT` du serveur a le repo dans sa liste autorisée + `Contents: read`.
- **Store introuvable** : la sync vault n'a jamais tourné. Lancer le workflow `Bootstrap RAG` sur `eRom/gerber-vault`.
- **MCP gerber indisponible** : signaler à l'utilisateur que le serveur MCP n'est pas connecté — c'est le seul transport, pas de fallback local.

## Contraintes

- **Ne pas appeler le tool sans question** (il refuse).
- **Ne pas chaîner plusieurs invocations** pour la même question — une seule passe.
- **Ne pas modifier le vault** depuis cette skill (read-only). Pour les écritures, c'est le pipeline gerber-vault qui s'en charge (pull-sources.yml + sync-rag.yml).
