---
name: session-complete
description: "Cartographie de fin de session : persiste .cave/ et archive vers gerber."
user-invocable: true
---

# /session-complete — Cartographie de fin de session

## Role

Tu es un **archiviste de session**. Ton job : capturer l'etat de connaissance actuel du projet dans des fichiers memoire persistants, pour que la prochaine session demarre sans phase de redecouverte.

---

## Invocation

```
/gerber:session-complete
```

Aucun argument necessaire. Tu travailles avec le projet courant.

---

## Comportement

### 1. Analyse du contexte actuel

Utilise ta connaissance accumulee pendant la session en cours. Si necessaire, complete avec quelques lectures ciblees pour verifier des points flous. **Ne re-scanne pas tout le projet** — l'objectif est de persister ce que tu sais deja.

### 2. Genere ou met a jour 4 fichiers memoire

Les fichiers sont ecrits dans le dossier `.cave/` dans le projet courant.

Si le dossier n'existe pas, cree-le.

#### `architecture.md`
- Vue d'ensemble du projet (type, objectif, stack)
- Arborescence simplifiee des dossiers cles (pas un `tree` complet, juste les niveaux importants)
- Les couches/modules et comment ils communiquent
- Les flux de donnees principaux
- Les dependances externes critiques

#### `key-files.md`
- Liste des fichiers les plus importants du projet
- Pour chaque fichier : chemin, role, et ce qu'il contient en 1 ligne
- Regroupes par module/domaine
- Inclure les fichiers de config critiques (env, CI, etc.)

#### `patterns.md`
- Conventions de nommage (fichiers, variables, fonctions, classes)
- Patterns architecturaux utilises (repository, service, controller, etc.)
- Patterns de code recurrents (error handling, logging, auth, etc.)
- Style de tests (framework, organisation, conventions)
- Conventions de commit/branching si observees

#### `gotchas.md`
- Pieges decouverts pendant les sessions
- Bugs resolus et leur cause racine
- Configurations subtiles ou non-evidentes
- Points d'attention pour le futur
- Workarounds en place et pourquoi

### 3. Met a jour CLAUDE.md avec un pointeur lazy

Apres avoir ecrit les fichiers `.cave/`, ajoute ou met a jour un bloc dans `CLAUDE.md` pour indiquer aux prochaines sessions **ou** trouver le contexte, sans le charger d'office.

**Si `CLAUDE.md` n'existe pas** → cree-le avec uniquement ce bloc.
**Si `CLAUDE.md` existe** → ajoute ou remplace le bloc `## Contexte projet (.cave)` sans toucher au reste.

Le bloc a inserer :

```markdown
## Contexte projet (.cave)

Le dossier `.cave/` contient la cartographie persistante du projet :
- `architecture.md` — vue d'ensemble, stack, flux de donnees
- `key-files.md` — fichiers critiques et leur role
- `patterns.md` — conventions et patterns recurrents
- `gotchas.md` — pieges, bugs resolus, workarounds

**Ne lis PAS ces fichiers au demarrage.** Lis-les a la demande, uniquement quand la question de l'utilisateur touche au domaine concerne (ex: question archi → `architecture.md`, bug etrange → `gotchas.md`). Pour une question triviale ou sans rapport avec le projet lui-meme, ne les lis pas du tout.
```

### 4. Archive vers gerber (conditionnel)

Si le `CLAUDE.md` du projet courant contient une section `## Gerber` :
- Appelle la skill `/gerber:archive` en mode automatique (sans confirmation item par item).
- En mode automatique, la confirmation est groupee : les items "nouveau" sont crees directement, les "a confirmer" (score 0.75–0.92) sont crees en `status: 'draft'`.
- Si le serveur MCP `gerber` ne repond pas → log "gerber: MCP indisponible, archive skippee" et continue (ne bloque jamais session-complete).

Si la section `## Gerber` est absente → skip silencieux, aucun log.

### 5. Regles d'ecriture

- **Concis** : chaque fichier doit rester lisible en 30 secondes
- **Factuel** : pas de suppositions, uniquement ce qui a ete verifie
- **Maintenable** : mettre a jour les fichiers existants plutot que reecrire from scratch
- **Date** : ajouter la date de derniere mise a jour en haut de chaque fichier

### 6. Output

Apres ecriture, affiche un resume court de ce qui a ete cartographie :

```
Session cartographiee :
- .cave/architecture.md : [nb lignes] lignes — [resume 1 ligne]
- .cave/key-files.md : [nb lignes] lignes — [resume 1 ligne]
- .cave/patterns.md : [nb lignes] lignes — [resume 1 ligne]
- .cave/gotchas.md : [nb lignes] lignes — [resume 1 ligne]
- CLAUDE.md : pointeur lazy configure
- {slug} : {X} notes archivees, {Y} drafts (si etape 4 executee)
```

---

## Important

- Si des fichiers memoire existent deja, **mets-les a jour** (merge avec le contenu existant) plutot que de les ecraser
- Si tu n'as rien a mettre dans un fichier (ex: pas de gotchas decouverts), ecris juste un placeholder avec "Aucun element identifie pour le moment"
- Ne supprime JAMAIS d'information d'un fichier existant sauf si elle est devenue fausse
- Ne touche JAMAIS aux autres sections de CLAUDE.md (best practices stack, regles personnelles, etc.)
