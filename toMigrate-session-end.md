# /session-end — Cartographie de fin de session

## Role

Tu es un **archiviste de session**. Ton job : capturer l'état de connaissance actuel du projet dans des fichiers mémoire persistants, pour que la prochaine session démarre sans phase de redécouverte.

---

## Invocation

```
/session-end
```

Aucun argument nécessaire. Tu travailles avec le projet courant.

---

## Comportement

### 1. Analyse du contexte actuel

Utilise ta connaissance accumulée pendant la session en cours. Si nécessaire, complète avec quelques lectures ciblées pour vérifier des points flous. **Ne re-scanne pas tout le projet** — l'objectif est de persister ce que tu sais déjà.

### 2. Génère ou met à jour 4 fichiers mémoire

Les fichiers sont écrits dans le dossier `.memory/` dans le projet courant.

Si le dossier n'existe pas, crée-le.

#### `architecture.md`
- Vue d'ensemble du projet (type, objectif, stack)
- Arborescence simplifiée des dossiers clés (pas un `tree` complet, juste les niveaux importants)
- Les couches/modules et comment ils communiquent
- Les flux de données principaux
- Les dépendances externes critiques

#### `key-files.md`
- Liste des fichiers les plus importants du projet
- Pour chaque fichier : chemin, rôle, et ce qu'il contient en 1 ligne
- Regroupés par module/domaine
- Inclure les fichiers de config critiques (env, CI, etc.)

#### `patterns.md`
- Conventions de nommage (fichiers, variables, fonctions, classes)
- Patterns architecturaux utilisés (repository, service, controller, etc.)
- Patterns de code récurrents (error handling, logging, auth, etc.)
- Style de tests (framework, organisation, conventions)
- Conventions de commit/branching si observées

#### `gotchas.md`
- Pièges découverts pendant les sessions
- Bugs résolus et leur cause racine
- Configurations subtiles ou non-évidentes
- Points d'attention pour le futur
- Workarounds en place et pourquoi

### 3. Met à jour CLAUDE.md avec un pointeur lazy

Après avoir écrit les fichiers `.memory/`, ajoute ou met à jour un bloc dans `CLAUDE.md` pour indiquer aux prochaines sessions **où** trouver le contexte, sans le charger d'office.

**Si `CLAUDE.md` n'existe pas** → crée-le avec uniquement ce bloc.
**Si `CLAUDE.md` existe** → ajoute ou remplace le bloc `## Contexte projet (.memory)` sans toucher au reste.

Le bloc à insérer :

```markdown
## Contexte projet (.memory)

Le dossier `.memory/` contient la cartographie persistante du projet :
- `architecture.md` — vue d'ensemble, stack, flux de données
- `key-files.md` — fichiers critiques et leur rôle
- `patterns.md` — conventions et patterns récurrents
- `gotchas.md` — pièges, bugs résolus, workarounds

**Ne lis PAS ces fichiers au démarrage.** Lis-les à la demande, uniquement quand la question de l'utilisateur touche au domaine concerné (ex: question archi → `architecture.md`, bug étrange → `gotchas.md`). Pour une question triviale ou sans rapport avec le projet lui-même, ne les lis pas du tout.
```

### 4. Archive vers gerber (conditionnel)

Si le `CLAUDE.md` du projet courant contient une section `## gerber` :
- Appelle la skill `/gerber-archive` en mode automatique (sans confirmation item par item).
- En mode automatique, la confirmation est groupée : les items "nouveau" sont créés directement, les "à confirmer" (score 0.75–0.92) sont créés en `status: 'draft'`.
- Si le serveur MCP `gerber` ne répond pas → log "gerber: MCP indisponible, archive skippée" et continue (ne bloque jamais session-end).

Si la section `## gerber` est absente → skip silencieux, aucun log.

### 5. Règles d'écriture

- **Concis** : chaque fichier doit rester lisible en 30 secondes
- **Factuel** : pas de suppositions, uniquement ce qui a été vérifié
- **Maintenable** : mettre à jour les fichiers existants plutôt que réécrire from scratch
- **Daté** : ajouter la date de dernière mise à jour en haut de chaque fichier

### 6. Output

Après écriture, affiche un résumé court de ce qui a été cartographié :

```
Session cartographiée :
- .memory/architecture.md : [nb lignes] lignes — [résumé 1 ligne]
- .memory/key-files.md : [nb lignes] lignes — [résumé 1 ligne]
- .memory/patterns.md : [nb lignes] lignes — [résumé 1 ligne]
- .memory/gotchas.md : [nb lignes] lignes — [résumé 1 ligne]
- CLAUDE.md : auto-load configuré
- agent-brain : {X} notes archivées, {Y} drafts (si étape 4 exécutée)
```

---

## Important

- Si des fichiers mémoire existent déjà, **mets-les à jour** (merge avec le contenu existant) plutôt que de les écraser
- Si tu n'as rien à mettre dans un fichier (ex: pas de gotchas découverts), écris juste un placeholder avec "Aucun élément identifié pour le moment"
- Ne supprime JAMAIS d'information d'un fichier existant sauf si elle est devenue fausse
- Ne touche JAMAIS aux autres sections de CLAUDE.md (best practices stack, règles personnelles, etc.)
