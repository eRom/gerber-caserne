---
name: session-complete
description: "Cartographie de fin de session : met a jour _gerber_/ et le pointeur lazy dans AGENTS.md."
user-invocable: true
---

# session-complete

Capture l'etat de connaissance actuel du projet dans `_gerber_/` pour que la prochaine session demarre sans phase de redecouverte. Utiliser le contexte accumule pendant la session, sans re-scanner tout le projet.

## Fichiers

Si `_gerber_/` n'existe pas, le creer.

- `_gerber_/architecture.md` : type, objectif, stack, arborescence simplifiee, couches/modules, flux de donnees, dependances externes critiques.
- `_gerber_/key-files.md` : fichiers importants, chemin, role, contenu en une ligne, regroupes par module.
- `_gerber_/patterns.md` : conventions, patterns architecturaux, patterns de code, style de tests, conventions commit/branching observees.
- `_gerber_/gotchas.md` : pieges, bugs resolus, cause racine, configs subtiles, workarounds.

## Pointeur lazy dans AGENTS.md

Si `AGENTS.md` n'existe pas, le creer avec uniquement ce bloc. Sinon ajouter ou remplacer la section `## Contexte projet (_gerber_)` sans toucher au reste.

```markdown
## Contexte projet (_gerber_)

Le dossier `_gerber_/` contient la cartographie persistante du projet :
- `architecture.md` - vue d'ensemble, stack, flux de donnees
- `key-files.md` - fichiers critiques et leur role
- `patterns.md` - conventions et patterns recurrents
- `gotchas.md` - pieges, bugs resolus, workarounds

Ne lis pas ces fichiers au demarrage. Lis-les a la demande, uniquement quand la question touche au domaine concerne.
```

## Regles d'ecriture

- Concis : chaque fichier doit rester lisible en 30 secondes.
- Factuel : uniquement ce qui a ete verifie.
- Merge : mettre a jour plutot qu'ecraser. Ne jamais supprimer une info existante sauf si devenue fausse.
- Date : ajouter la date de derniere mise a jour en haut de chaque fichier.
- Placeholder si vide : `Aucun element identifie pour le moment`.
- Ne jamais toucher aux autres sections de `AGENTS.md`.

## Output

```text
Session cartographiee :
- _gerber_/architecture.md : [nb lignes] - [resume 1 ligne]
- _gerber_/key-files.md : [nb lignes] - [resume 1 ligne]
- _gerber_/patterns.md : [nb lignes] - [resume 1 ligne]
- _gerber_/gotchas.md : [nb lignes] - [resume 1 ligne]
- AGENTS.md : pointeur lazy configure
```
