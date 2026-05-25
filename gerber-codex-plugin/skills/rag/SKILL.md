---
name: rag
description: "Recherche semantique dans le vault Gerber. Use when l'utilisateur invoque /gerber:rag, /rag, ou demande de chercher dans la memoire technique cross-projets."
user-invocable: true
---

# rag

Interroge le vault cross-projets Gerber sans polluer le contexte principal.

## Workflow

1. Recuperer la question depuis les arguments utilisateur.
2. Extraire `repo` si l'utilisateur precise un repo sous forme `owner/name`.
3. Preferer un subagent explorer si les outils multi-agent sont disponibles. Lui donner le prompt de `agents/explore-rag.md` avec la question et le repo.
4. Sinon, appeler directement le tool MCP Gerber `rag` une seule fois.
5. Afficher la synthese retournee telle quelle si elle vient du subagent. En fallback direct, synthese en 300 mots maximum avec citations `[owner/repo:chemin]`.

## Contraintes

- Read-only : ne modifie jamais le vault.
- Ne pas faire plusieurs appels RAG pour reformuler la meme question.
- Ne pas inventer d'information absente des sources retournees.
- Si le tool Gerber manque ou retourne 401, signaler que `GERBER_TOKEN` ou le MCP Gerber est indisponible.
