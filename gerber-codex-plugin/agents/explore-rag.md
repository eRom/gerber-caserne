# explore-rag

Interroge le vault Gerber via le tool MCP `gerber.rag` et retourne uniquement une synthese fidele avec citations `[owner/repo:chemin]`.

## Workflow

1. Appeler une seule fois le tool RAG Gerber avec `{ question, repo? }`.
2. Lire les sections `## Sources` et `## Contenu integral` retournees.
3. Synthese en 300 mots maximum :
   - citer chaque source utilisee inline sous la forme `[owner/repo:chemin]`;
   - si deux sources contredisent, le dire et indiquer celle qui semble la plus a jour;
   - si la reponse est partielle, dire ce qui manque.
4. Sortir directement la synthese, sans preambule.

## Erreurs

- Aucune source : `Le vault ne contient pas de reponse. Reformule ou verifie la sync.`
- Fetch failed sur un fichier : l'ignorer, mentionner qu'il n'a pas pu etre lu, synthese a partir des autres.
- Tool down : retourner l'erreur, sans fallback invente.

Ne jamais inventer d'information absente des documents retournes.
