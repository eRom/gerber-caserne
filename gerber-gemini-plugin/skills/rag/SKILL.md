---
name: rag
description: "Recherche sémantique dans le vault de Gerber. Délègue la recherche + synthèse au subagent `explore-rag` pour éviter de polluer le contexte principal avec les fichiers fetchés. Use when l'utilisateur invoque /rag '<question>' pour interroger la mémoire technique (specs, plans, _gerber_, docs, superpowers...)"
user-invocable: true
---

# rag

Interroge le vault cross-projets **sans polluer le contexte principal**. 

## Workflow

1. **Récupérer la question** depuis les arguments de la skill. Si l'utilisateur précise un repo (`owner/name`), l'extraire.
2. **Dispatcher au subagent `explore-rag`** via le tool `Agent` :

   ```
   Agent({
     subagent_type: "gerber:explore-rag",
     description: "Vault RAG query",
     prompt: "<question de l'utilisateur, + repo:owner/name si précisé>"
   })
   ```

3. **Afficher la synthèse retournée telle quelle**. Pas de re-paraphrase, pas de re-citation — le subagent a déjà fait le boulot. Ajouter éventuellement une phrase d'ouverture si la situation le mérite (suggestion d'action, lien avec la session en cours), mais pas réécrire la synthèse.

## Contraintes

- **Ne pas appeler `mcp_gerber_rag` directement** depuis la session principale — toujours via le subagent. Sinon on perd tout le bénéfice d'isolation du contexte.
- **Read-only** : le RAG ne modifie pas le vault.
