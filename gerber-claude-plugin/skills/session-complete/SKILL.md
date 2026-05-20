---
name: session-complete
description: "Cartographie de fin de session : persiste _gerber_/."
user-invocable: true
---

# session-complete

Capture l'état de connaissance actuel du projet dans `_gerber_/` pour que la prochaine session démarre sans phase de redécouverte. Utiliser le contexte accumulé pendant la session — **ne pas re-scanner tout le projet**.

## Fichiers à générer/mettre à jour

Si `_gerber_/` n'existe pas, le créer.

**`_gerber_/architecture.md`** : type, objectif, stack, arborescence simplifiée des dossiers clés, couches/modules et communication, flux de données principaux, dépendances externes critiques.

**`_gerber_/key-files.md`** : fichiers les plus importants. Pour chacun : chemin, rôle, contenu en 1 ligne. Regroupés par module/domaine. Inclure configs critiques (env, CI).

**`_gerber_/patterns.md`** : conventions de nommage, patterns architecturaux (repository, service, controller…), patterns de code récurrents (error handling, logging, auth), style de tests, conventions commit/branching si observées.

**`_gerber_/gotchas.md`** : pièges, bugs résolus + cause racine, configs subtiles, points d'attention, workarounds + pourquoi.

## Pointeur lazy dans CLAUDE.md

Si `CLAUDE.md` n'existe pas → le créer avec uniquement ce bloc.
Sinon → ajouter/remplacer la section `## Contexte projet (_gerber_)` sans toucher au reste.

```markdown
## Contexte projet (_gerber_)

Le dossier `_gerber_/` contient la cartographie persistante du projet :
- `architecture.md` — vue d'ensemble, stack, flux de données
- `key-files.md` — fichiers critiques et leur rôle
- `patterns.md` — conventions et patterns récurrents
- `gotchas.md` — pièges, bugs résolus, workarounds

**Ne lis PAS ces fichiers au démarrage.** Lis-les à la demande, uniquement quand la question de l'utilisateur touche au domaine concerné.
```

## Règles d'écriture

- **Concis** : chaque fichier lisible en 30 secondes.
- **Factuel** : pas de suppositions, uniquement ce qui a été vérifié.
- **Merge** : si les fichiers existent, mettre à jour plutôt qu'écraser. Ne JAMAIS supprimer d'info existante sauf si devenue fausse.
- **Date** : ajouter la date de dernière mise à jour en haut de chaque fichier.
- Si tu n'as rien à mettre dans un fichier, placeholder : `Aucun élément identifié pour le moment`.
- Ne JAMAIS toucher aux autres sections de CLAUDE.md.

## Output

```
Session cartographiée :
- _gerber_/architecture.md : [nb lignes] — [résumé 1 ligne]
- _gerber_/key-files.md : [nb lignes] — [résumé 1 ligne]
- _gerber_/patterns.md : [nb lignes] — [résumé 1 ligne]
- _gerber_/gotchas.md : [nb lignes] — [résumé 1 ligne]
- CLAUDE.md : pointeur lazy configuré
```
