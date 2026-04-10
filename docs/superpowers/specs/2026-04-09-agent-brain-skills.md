# agent-brain Skills — Spec

> Date : 2026-04-09
> Statut : draft
> Dépendance : `agent-brain` MCP backend opérationnel (Plan A)
> Spec parent : `2026-04-08-agent-brain-mvp-design.md`

## 0 — Vue d'ensemble

6 skills Claude Code qui interfacent avec le serveur MCP `agent-brain`. Objectif : un workflow fluide du setup projet → capture quotidienne → recherche → archivage → maintenance, **sans que l'utilisateur n'ait à connaître les outils MCP sous-jacents**.

### Tableau récapitulatif

| # | Skill | Model | Context | Trigger | Tools MCP | Rôle |
|---|---|---|---|---|---|---|
| 1 | `/agent-brain-onboarding` | haiku | fork | Manuel, 1x par projet | `project_create`, `project_list` | Init projet + config CLAUDE.md |
| 2 | `/agent-brain-recall` | sonnet | fork | Manuel ou appelé par d'autres skills | `search`, `note_get` | Recherche contextuelle dans le brain |
| 3 | `/agent-brain-capture` | haiku | fork | Manuel mid-session | `note_create` | Capture rapide d'un atome |
| 4 | `/agent-brain-archive` | sonnet | fork | Manuel OU appelé par `/session-end` | `note_create`, `note_list`, `search` | Extraction + archivage fin de session |
| 5 | `/agent-brain-review` | haiku | fork | Manuel (hebdo) | `get_stats`, `note_list`, `note_update` | Maintenance + nettoyage notes stale |
| 6 | `/agent-brain-import` | sonnet | fork | Manuel, 1x migration | `note_create`, `project_list` | Migration .memory/ et _internal/ |

### Conventions transversales

- **Variable `PROJECT_NAME`** : toutes les skills (sauf onboarding) déterminent le projet automatiquement via le `CLAUDE.md` du repo courant (section `agent-brain` ajoutée par onboarding). Si absent → erreur "Exécute `/agent-brain-onboarding` d'abord."
- **Détection MCP** : chaque skill vérifie que le serveur MCP `agent-brain` est configuré. Si absent → erreur avec instructions de config (`mcpServers` dans settings).
- **Source** : toutes les notes créées par les skills ont `source: 'ai'` (sauf import → `source: 'import'`).
- **Langue** : français par défaut, technique en anglais.
- **Idempotence** : capture et archive déduupliquent via `search(mode:'semantic')` avant de créer — si une note quasi-identique existe (score > 0.92), skip + log au lieu de créer un doublon.

---

## 1 — `/agent-brain-onboarding`

### Métadonnées

```yaml
name: agent-brain-onboarding
description: Initialise un projet dans agent-brain et configure le CLAUDE.md du repo courant.
model: haiku
context: fork
user-invocable: true
```

### Paramètres

```
/agent-brain-onboarding [slug]
```

- `slug` (optionnel) : si absent, déduit du nom du dossier courant (kebab-case, ex: `claude-desktop-multi-llm` → `cruchot` si mapping connu, sinon le slug brut).

### Workflow

1. **Check prérequis**
   - Vérifier que le serveur MCP `agent-brain` est configuré et répond (appel `get_stats` comme ping).
   - Si échec → afficher les instructions de config et STOP.

2. **Vérifier si le projet existe déjà**
   - `project_list()` → chercher le slug.
   - Si existe → afficher "Projet `{slug}` déjà initialisé." et passer à l'étape 4 (mise à jour CLAUDE.md si nécessaire).

3. **Créer le projet**
   - Demander confirmation : "Créer le projet `{slug}` dans agent-brain ?"
   - `project_create({ slug, name: <nom lisible>, repo_path: <cwd>, color: <auto-assign> })`.
   - Afficher le résultat.

4. **Configurer CLAUDE.md**
   - Lire le `CLAUDE.md` du repo courant.
   - Si section `## agent-brain` absente → l'ajouter.
   - Contenu de la section :

   ```markdown
   ## agent-brain

   Ce projet est indexé dans agent-brain sous le slug `{slug}`.

   Skills disponibles :
   - `/agent-brain-recall` — recherche contextuelle dans la mémoire cross-projets
   - `/agent-brain-capture` — capture rapide d'un atome de connaissance
   - `/agent-brain-archive` — extraction et archivage fin de session
   - `/agent-brain-review` — maintenance hebdomadaire
   - `/agent-brain-import` — migration one-shot depuis .memory/ et _internal/
   ```

5. **Output**

   ```
   ✓ Projet "{name}" ({slug}) initialisé dans agent-brain.
   ✓ CLAUDE.md mis à jour avec la section agent-brain.

   Prochaine étape : /agent-brain-import pour migrer le contenu existant.
   ```

### Ce que la skill NE fait PAS

- Ne crée aucune note.
- Ne modifie aucun fichier autre que `CLAUDE.md`.
- Ne migre pas le contenu existant (c'est le job de `/agent-brain-import`).

---

## 2 — `/agent-brain-recall`

### Métadonnées

```yaml
name: agent-brain-recall
description: Recherche dans agent-brain du contexte pertinent pour la question ou tâche en cours.
model: sonnet
context: fork
user-invocable: true
```

### Paramètres

```
/agent-brain-recall <query>
```

- `query` : la question ou le sujet à rechercher. Si absent, la skill demande "Que cherches-tu ?".

### Workflow

1. **Résoudre le projet courant** via `CLAUDE.md` section `agent-brain` → `PROJECT_NAME`.

2. **Recherche agent-brain**
   - `search({ query, mode: 'hybrid', project_id: <current_project>, limit: 8 })` — notes du projet courant.
   - `search({ query, mode: 'hybrid', project_id: <global_project_id>, limit: 5 })` — notes cross-projets.
   - Fusionner les résultats, dédupliquer par `owner_id`, trier par score décroissant, garder top 10.

3. **Recherche sessions** (optionnel)
   - Si la skill `/search-sessions` est disponible : `search-sessions --project <PROJECT_NAME> --query <query> --limit 5`.
   - Ajouter les résultats dans une section séparée "Contexte sessions passées".

4. **Hydratation**
   - Pour chaque hit atom : afficher titre + snippet + tags.
   - Pour chaque hit chunk : afficher `parent.title` > `chunk.heading_path` + snippet + neighbors (context ±1).
   - Si un hit est très pertinent (score > 0.85) : `note_get(id)` pour récupérer le contenu complet.

5. **Output structuré**

   ```markdown
   ## Résultats agent-brain pour "{query}"

   ### Notes du projet ({PROJECT_NAME})
   1. **[atom] Express 5 wildcard syntax** (score: 0.91) #gotcha #express
      > Pour une route wildcard en Express 5, utiliser `app.get('/{*path}', ...)`...

   2. **[doc] ADN Barda > § 9 — Pièges** (score: 0.87) #reference
      > Express 5 wildcard crash avec `PathError: Missing parameter name`...
      > [voisin §8] ... [voisin §10] ...

   ### Notes globales
   3. **[atom] Pattern Express middleware** (score: 0.72) #pattern
      > ...

   ### Sessions passées (si disponible)
   - Session S71 (2026-04-07) : "Fix Express 5 route..."

   ---
   *{N} résultats trouvés. Utilise `/agent-brain-capture` pour sauvegarder un nouvel apprentissage.*
   ```

6. **Mode silencieux** (quand appelé par une autre skill) : retourne les hits en JSON brut sans formatage markdown, pour injection dans un prompt.

### Ce que la skill NE fait PAS

- Ne crée ni modifie aucune note.
- Ne pollue pas le contexte de la conversation principale (context: fork).
- N'injecte pas automatiquement les résultats dans le prompt — c'est au caller de décider.

---

## 3 — `/agent-brain-capture`

### Métadonnées

```yaml
name: agent-brain-capture
description: Capture rapide d'un atome de connaissance (gotcha, pattern, décision) pendant une session.
model: haiku
context: fork
user-invocable: true
```

### Paramètres

```
/agent-brain-capture [description libre]
```

- `description libre` (optionnel) : si fourni, la skill l'utilise comme base pour le contenu. Si absent, elle extrait du contexte de la conversation.

### Workflow

1. **Résoudre le projet** via `CLAUDE.md`.

2. **Extraire le contenu**
   - Si `description libre` fourni → l'utiliser comme base.
   - Sinon → analyser les 10 derniers messages de la conversation, identifier le fait/gotcha/pattern/décision le plus saillant, proposer un draft.

3. **Structurer la note**
   - Générer : `title` (1 ligne, max 200 chars), `content` (markdown, 5-50 lignes), `tags[]` (auto-suggérés).
   - Format content pour un gotcha :
     ```markdown
     **Problème** : ...
     **Cause** : ...
     **Fix** : ...
     **Fichier(s)** : ...
     ```
   - Format content pour un pattern :
     ```markdown
     **Contexte** : ...
     **Pattern** : ...
     **Exemple** : ...
     ```
   - Format content pour une décision :
     ```markdown
     **Décision** : ...
     **Alternatives considérées** : ...
     **Raison** : ...
     ```

4. **Déduplication**
   - `search({ query: title, mode: 'semantic', project_id, limit: 3 })`.
   - Si un hit a `score > 0.92` → afficher "Note similaire existante :" + le hit, demander "Créer quand même ? (o/n)".

5. **Confirmation + Création**
   - Afficher le draft complet (title, content, tags, kind='atom').
   - Demander confirmation.
   - `note_create({ project_id, kind: 'atom', title, content, tags, status: 'active', source: 'ai' })`.

6. **Output**

   ```
   ✓ Note capturée : "{title}"
     Tags : #gotcha #express #routing
     ID : abc123-...
   ```

### Ce que la skill NE fait PAS

- Ne crée jamais de `kind: 'document'` (c'est le job d'archive ou import).
- Ne modifie pas de note existante (si doublon, l'utilisateur décide).
- Ne capture pas automatiquement sans confirmation (l'humain valide toujours).

---

## 4 — `/agent-brain-archive`

### Métadonnées

```yaml
name: agent-brain-archive
description: Extraction et archivage des apprentissages de la session courante vers agent-brain.
model: sonnet
context: fork
user-invocable: true
```

### Paramètres

```
/agent-brain-archive
```

Aucun argument. Travaille sur la session en cours.

### Workflow

1. **Résoudre le projet** via `CLAUDE.md`.

2. **Analyser la conversation**
   - Scanner tous les messages de la session.
   - Extraire les catégories suivantes :
     - **Gotchas** découverts (bugs, pièges, workarounds)
     - **Patterns** établis (conventions, architectures validées)
     - **Décisions** prises (choix techniques, trade-offs tranchés)
     - **Specs/plans produits** (brainstorms, designs, plans qui méritent archivage en document)
   - Pour chaque item, générer un draft (title, content, tags, kind).

3. **Déduplication batch**
   - Pour chaque draft, `search({ query: draft.title, mode: 'semantic', project_id, limit: 3 })`.
   - Si score > 0.92 → marquer comme "skip (existant)" avec lien vers la note existante.
   - Si score entre 0.75 et 0.92 → marquer comme "possible doublon — à confirmer".
   - Si score < 0.75 → marquer comme "nouveau".

4. **Présentation et confirmation**

   ```markdown
   ## Archive de session — {N} apprentissages extraits

   ### Nouveaux (à créer)
   1. [atom] **WAL checkpoint avant restore** #gotcha #sqlite
   2. [atom] **RRF k=60 pour hybrid search** #pattern #search
   3. [doc]  **Brainstorm agent-brain du 2026-04-08** #brainstorm #agent-brain

   ### Doublons (skip)
   4. [skip] Express 5 wildcard → existant (note abc123)

   ### À confirmer
   5. [?] Drizzle schema dans shared → similaire à "Gotcha 3 camelCase" (score 0.88)

   Créer les items 1-3 ? Les items "à confirmer" seront demandés un par un. (o/n)
   ```

5. **Création batch**
   - Créer chaque note confirmée via `note_create`.
   - Pour les documents (brainstorm/spec) : `kind: 'document'` — le MCP chunke automatiquement.
   - Afficher le résumé final.

6. **Output**

   ```
   ✓ Session archivée dans agent-brain ({PROJECT_NAME}) :
     - 2 atomes créés
     - 1 document créé (12 chunks)
     - 1 doublon ignoré
     - 1 confirmé manuellement
   ```

### Intégration `/session-end`

Quand `/session-end` appelle `/agent-brain-archive` :
- L'archive se fait **après** la mise à jour `.memory/` (étapes 1-2 de session-end).
- La condition d'appel : la section `## agent-brain` existe dans `CLAUDE.md` du projet courant. Sinon → skip silencieux.
- En mode appelé par session-end, la confirmation est **groupée** (pas item par item) pour ne pas bloquer le flow. Les "à confirmer" sont créés en `status: 'draft'` pour review ultérieure via `/agent-brain-review`.

### Ce que la skill NE fait PAS

- Ne modifie pas de notes existantes (pas de merge/update — crée ou skip).
- Ne supprime rien.
- Ne touche pas à `.memory/` (c'est le job de `/session-end`).

---

## 5 — `/agent-brain-review`

### Métadonnées

```yaml
name: agent-brain-review
description: Maintenance hebdomadaire — stats, notes stale, drafts en attente, nettoyage.
model: haiku
context: fork
user-invocable: true
```

### Paramètres

```
/agent-brain-review [project_slug]
```

- `project_slug` (optionnel) : si absent, review le projet courant + global. Si `--all`, review tous les projets.

### Workflow

1. **Stats globales**
   - `get_stats()` → afficher un résumé compact.

   ```
   agent-brain : 3 projets • 127 notes (89 atoms, 38 docs) • 412 chunks • 4.2 MB
   Top tags : #gotcha (34) #pattern (21) #electron (18) #sqlite (15) #express (12)
   ```

2. **Drafts en attente**
   - `note_list({ status: 'draft', sort: 'created_desc', limit: 20 })`.
   - Si non-vide → afficher la liste, proposer pour chacun : "Activer / Archiver / Supprimer ?".

3. **Notes stale**
   - `note_list({ status: 'active', sort: 'updated_desc', limit: 50 })`.
   - Identifier les notes non-touchées depuis > 30 jours.
   - Proposer : "Archiver les {N} notes non-touchées depuis 30+ jours ? (o/n/détail)".

4. **Doublons potentiels** (optionnel, si le corpus > 50 notes)
   - Pour les 10 notes les plus récentes, `search({ query: note.title, mode: 'semantic', limit: 3 })`.
   - Si un hit ≠ self a score > 0.90 → signaler comme doublon potentiel.

5. **Actions**
   - Chaque action confirmée → `note_update({ id, patch: { status } })`.
   - Les suppressions → `note_delete({ id })` après double confirmation.

6. **Output final**

   ```
   ✓ Review terminée :
     - 3 drafts activés
     - 7 notes archivées (stale > 30j)
     - 1 doublon fusionné
     - Prochaine review suggérée : semaine prochaine
   ```

### Ce que la skill NE fait PAS

- Ne crée pas de notes.
- Ne modifie pas le contenu des notes (seulement le `status`).
- Ne touche pas aux backups (c'est un tool MCP direct si besoin).

---

## 6 — `/agent-brain-import`

### Métadonnées

```yaml
name: agent-brain-import
description: Migration one-shot du contenu .memory/ et _internal/ d'un repo vers agent-brain.
model: sonnet
context: fork
user-invocable: true
```

### Paramètres

```
/agent-brain-import [path]
```

- `path` (optionnel) : chemin vers le dossier à importer. Défaut : `.memory/` + `_internal/` + `audit/` du repo courant.

### Workflow

1. **Résoudre le projet** via `CLAUDE.md`.

2. **Scanner les sources**
   - Lister tous les `.md` dans les dossiers source.
   - Pour chaque fichier, détecter le type via heuristique :

   | Pattern | Kind | Tags auto |
   |---|---|---|
   | `gotchas.md` ou contient "Problème/Cause/Fix" | atom (1 par gotcha) | `#gotcha` + tags déduits |
   | `patterns.md` ou contient "Convention/Pattern" | atom (1 par pattern) | `#pattern` + tags déduits |
   | `architecture.md`, `key-files.md` | document | `#architecture` ou `#reference` |
   | `_internal/specs/*.md` | document | `#spec` + `#archived` |
   | `_internal/plans/*.md` | document | `#plan` + `#archived` |
   | `_internal/brainstorms/*.md` | document | `#brainstorm` + `#archived` |
   | `audit/*.md` | document | `#audit` + `#archived` |
   | Autres `.md` | document | tags déduits du contenu |

3. **Cas spécial : fichiers multi-entités**
   - `gotchas.md` et `patterns.md` contiennent typiquement **plusieurs** items séparés par des headers H2/H3.
   - La skill split chaque section en un atom individuel plutôt que d'importer le fichier entier comme 1 document.
   - Exemple : `gotchas.md` avec 15 sections H2 → 15 atoms kind='atom' avec `tags: ['gotcha', ...]`.

4. **Preview**

   ```markdown
   ## Import preview — {PROJECT_NAME}

   Sources scannées :
   - .memory/ : 4 fichiers
   - _internal/specs/ : 8 fichiers
   - _internal/brainstorms/ : 3 fichiers
   - audit/ : 2 fichiers

   Plan d'import :
   | # | Source | → Kind | Title | Tags |
   |---|---|---|---|---|
   | 1 | .memory/gotchas.md §1 | atom | Express 5 wildcard | #gotcha #express |
   | 2 | .memory/gotchas.md §2 | atom | Sigma.js type réservé | #gotcha #sigma |
   | ... | | | | |
   | 17 | _internal/specs/2026-04-06-test-strategy.md | doc | Test Strategy Design | #spec #archived |
   | ... | | | | |

   Total : {X} atoms + {Y} documents = {Z} notes à créer.
   Continuer ? (o/n)
   ```

5. **Import**
   - Création séquentielle via `note_create` (pas de bulk — feedback par item).
   - `source: 'import'` systématique.
   - Les specs/plans/brainstorms importés → `status: 'archived'` (ce sont des documents historiques).
   - Progress : `[{i}/{total}] ✓ {title}` par ligne.

6. **Output**

   ```
   ✓ Import terminé : {X} atoms + {Y} documents créés dans "{PROJECT_NAME}".
     Temps : ~{T}s
     Doublons skippés : {N}

   Tu peux maintenant supprimer .memory/ et _internal/ si tu le souhaites (après vérification dans l'UI agent-brain).
   ```

### Ce que la skill NE fait PAS

- Ne supprime PAS les fichiers source (l'utilisateur le fait manuellement après vérification).
- Ne modifie aucune note existante dans agent-brain.
- Ne touche pas au `CLAUDE.md` (l'onboarding a déjà fait le setup).

---

## 7 — Modification de `/session-end`

### Changement requis

Ajouter une étape 3 dans le workflow existant de `/session-end` :

```markdown
### 3. Archive vers agent-brain (conditionnel)

Si le `CLAUDE.md` du projet courant contient une section `## agent-brain` :
- Appeler la skill `/agent-brain-archive` en mode automatique.
- En mode automatique, la confirmation est groupée (pas item par item).
- Les notes "à confirmer" (score 0.75-0.92) sont créées en `status: 'draft'`.
- Si le serveur MCP `agent-brain` ne répond pas → log warning et continuer (ne pas bloquer session-end).

Si la section `## agent-brain` est absente → skip silencieux, aucun log.
```

### Impact sur le workflow existant

Le workflow `/session-end` devient :

```
1. Analyse du contexte actuel (inchangé)
2. Génère/met à jour les 4 fichiers .memory/ (inchangé)
3. Met à jour CLAUDE.md avec pointeur lazy (inchangé, modifié en S73)
4. [NOUVEAU] Archive vers agent-brain (conditionnel)
5. Output (ajout ligne "agent-brain : X notes archivées" si étape 4 exécutée)
```

---

## 8 — Prochaines étapes

1. **Attendre Plan A complet** — les skills dépendent du serveur MCP fonctionnel.
2. **Implémenter les skills** dans `~/.claude/commands/` (6 fichiers `.md`).
3. **Modifier `/session-end`** pour ajouter l'étape 3.
4. **Test manuel** sur le repo Cruchot :
   - `/agent-brain-onboarding cruchot`
   - `/agent-brain-import` (migration `.memory/` + `_internal/`)
   - `/agent-brain-recall "seatbelt sandbox"` (vérifie que les gotchas importés sont cherchables)
   - `/agent-brain-capture` mid-session
   - `/session-end` (vérifie que l'archive est déclenchée)
   - `/agent-brain-review` (vérifie que les stats sont cohérentes)
5. **Écrire Plan B (UI)** une fois le flow skills validé end-to-end.
