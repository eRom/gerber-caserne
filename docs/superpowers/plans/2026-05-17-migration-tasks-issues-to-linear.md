# Migration tasks/issues : gerber → Linear

## Context

Aujourd'hui gerber-caserne héberge 5 entités via son MCP : Tasks, Issues, Messages, Handoffs, Runbooks (les Notes ont déjà été supprimées dans une session précédente, déléguées au vault Gemini RAG). Romain a un workspace Linear `eRom` connecté via MCP officiel et veut transférer la gestion **Tasks + Issues** vers Linear pour bénéficier d'un produit fini (UI native multi-device, cycles, projects, mobile app, automations) tout en gardant gerber comme MCP minimal pour ce que Linear ne sait pas faire (handoff cross-device, bus messages inter-sessions, runbook process management).

L'objectif : **gerber devient un MCP de coordination agent-à-agent**, Linear devient le **système de gestion des tâches**, le vault Gemini reste le **knowledge store**. Trois outils, trois métiers clairs.

---

## Partie 1 — Linear pour les 10 ans

### La poupée russe Linear

Imagine ton Linear comme une maison à étages. De l'extérieur vers l'intérieur :

```
Workspace (la maison)
└── Team (un étage)
    ├── Workflow (les états : Triage → Backlog → ... → Done)
    ├── Labels (les gommettes)
    ├── Templates (les modèles de tâche pré-remplis)
    ├── Cycles (les sprints, optionnels)
    ├── Views (les vues filtrées)
    └── Project (une pièce dans l'étage)
        └── Issues (les tâches/tickets dans la pièce)
```

### Workspace `eRom`

C'est **ta maison entière**. Tu n'en as qu'un seul (sauf à payer pour plusieurs). Ton URL : `linear.app/erom`. C'est le conteneur racine où vivent ton compte, ta facturation, tes intégrations.

**Tu ne touches presque jamais ça.** Une fois créé, c'est fait.

### Team `eRom-Agents` (déjà créée)

Une team = **un étage de la maison**, c'est-à-dire **un contexte de travail homogène**.

Dans Linear, une team a SON workflow, SES labels, SES cycles, SES templates. Deux teams ne partagent **pas** ces réglages. C'est important : si tu as 2 teams, tu as 2 fois le boulot de configuration.

**Pourquoi 1 seule team te suffit** :
- Tu bosses seul → pas de besoin de séparer "équipe back / équipe front"
- Ton workflow 7 colonnes (Triage → Brainstorming → Spec → Plan → Implementation → Test → Done) est le même pour tous tes projets
- Tu restes en Free (limite 2 teams = pas un problème) sans risque de plafond
- Tes labels (`bug`, `quick-win`, `client-stalwart`...) servent partout

**Quand tu voudrais 2 teams** :
- Le jour où un client a son propre flow et tu veux le séparer du tien
- Le jour où tu prends un collaborateur qui a accès uniquement à un sous-ensemble
- Bref : pas maintenant

**Verdict : `eRom-Agents` est la seule team dont tu as besoin.** On garde.

### Projects = ton slug gerber

Un Project Linear = **une pièce dans l'étage Team**. C'est ce qui correspond exactement à ton **slug gerber** (issu de `/onboarding`, présent dans `_gerber_/`).

| Slug gerber | Project Linear |
|---|---|
| `agent-brain` | Project `agent-brain` |
| `caserne` | Project `caserne` |
| `stalwart` | Project `stalwart` |
| `hermes` | Project `hermes` |
| `buck` | Project `buck` (déjà créé : "buck - First version") |
| `gerber-caserne` | Project `gerber-caserne` (déjà créé) |

**Bonus Linear** : un project a un **statut** (Planned / In Progress / Completed / Cancelled), une **date de début/fin**, un **lead**, un **target date**, des **milestones**, une **description Markdown riche**. Tu peux donc gérer tes projets comme des mini-roadmaps, pas juste des dossiers de tâches.

**Convention** : 1 slug `_gerber_/.gerber-slug` ⇔ 1 project Linear, même nom, lowercase-kebab-case. Le `/onboarding` skill devra créer le project Linear en plus du slug gerber (évolution future).

### Issues = tes tâches

Une Issue Linear = **une tâche** (ou un bug, une amélioration, une demande, peu importe — Linear ne fait pas la distinction tasks/issues comme gerber).

Chaque issue a :
- Un **identifier** auto-généré : `EAT-12` (E pour `eRom`, A-T pour `eRom-Agents`, 12 = compteur)
- Un **title** et une **description** Markdown
- UN **state** (Triage / Backlog / ... / Done) — exclusif, mutuellement exclusif
- N **labels** (orthogonaux, cumulables)
- Un **assignee** (toi, ou Claude/Linear Agent)
- Un **project** (le slug gerber)
- Une **priority** (None / Low / Medium / High / Urgent)
- Optionnel : due date, parent issue (sub-issues), cycle, estimate

**Différence importante avec gerber** : Linear ne sépare pas tasks et issues. Tu peux émuler la distinction avec un **label `bug`** sur les issues, ou juste arrêter de faire la distinction (philosophie Linear).

### Workflow (les colonnes du kanban)

C'est **ta liste d'états ordonnés**. Chaque issue est dans **exactement un** state à la fois. Linear te livre un workflow par défaut, tu peux le personnaliser.

**Workflow actuel team eRom-Agents** (par défaut, à étendre) :
```
Backlog → Todo → In Progress → In Review → Done
                                            ↓ Canceled
                                            ↓ Duplicate
```

**Workflow cible (ton flow Claude Code)** :
```
Triage → Backlog → Brainstorming → Specification → Plan → Todo → In Progress → Test → In Review → Done
                                                                                       ↓ Canceled
                                                                                       ↓ Duplicate
```

Chaque state a une **catégorie système** parmi 5 : `triage` / `backlog` / `unstarted` / `started` / `completed` / `canceled`. C'est cette catégorie qui détermine comment Linear traite l'issue (par ex. "Active issues" = unstarted + started, "Completed" = completed).

**Mapping états custom → catégories** :

| State | Catégorie | Justification |
|---|---|---|
| `Triage` | triage (natif) | Inbox non encore triée |
| `Backlog` | backlog | Idées vagues, pas prêtes |
| `Brainstorming` | backlog | En cours d'exploration |
| `Specification` | backlog | Spec en cours de rédaction |
| `Plan` | unstarted | Spec validée, plan défini, prête à démarrer |
| `Todo` | unstarted | Prête, pas commencée (alias de Plan ou redondant) |
| `In Progress` | started | Code en cours |
| `Test` | started | Code écrit, en validation |
| `In Review` | started | En review (PR) |
| `Done` | completed | Mergé, déployé |
| `Canceled` | canceled | Abandonné |

Note : `Todo` devient un peu redondant avec `Plan`. Décision laissée à Romain : garder les deux (Todo = pas planifiée mais à faire / Plan = planifiée) ou supprimer Todo.

### Labels (les gommettes)

Un label = **un attribut orthogonal** que tu colles sur une issue. Plusieurs labels par issue, choisis librement.

**Labels recommandés pour démarrer** (à créer dans `Settings > Team > Labels`) :

| Label | Quand l'utiliser |
|---|---|
| `bug` | Issue qui corrige un comportement incorrect (≠ feature) |
| `refactor` | Pas de feature nouvelle, juste du nettoyage |
| `quick-win` | < 30 min, à grappiller entre deux gros sujets |
| `blocked-external` | Dépend de quelqu'un d'autre |
| `client-stalwart` | Tâche facturable Stalwart (ton client Q2) |
| `infra` | Sysadmin, déploiement, CI |
| `doc` | Documentation pure |

Tu en ajoutes au fil de l'eau. Pas besoin de tout définir maintenant — labels = attributs au feeling.

### Templates (les modèles)

Un template = **une issue pré-remplie**. Tu cliques dessus, ça crée une nouvelle issue avec le title, la description, les labels, le project déjà setupés.

**Templates utiles à créer plus tard** (pas urgent) :
- `Bug report` : title vide, label `bug`, description avec sections "Reproduction / Expected / Actual"
- `Spec draft` : state `Specification`, description avec sections "Context / Goal / Approach / Open questions"
- `Quick fix` : label `quick-win`, state `Todo`, priority `Low`

À setup dans `Settings > Team > Templates`. Pas bloquant pour la migration.

### Cycles (optionnel, à ignorer pour démarrer)

Un cycle = **un sprint** (1 ou 2 semaines). Tu rattaches des issues à un cycle, Linear te montre la vélocité.

**Tu n'en as pas besoin** tant que tu bosses seul sans rituel hebdo. Si plus tard tu veux te discipliner sur des sprints, tu actives.

### Views (les vues filtrées)

Une view = **une recherche sauvegardée** affichée comme un onglet. Tu définis une vue avec des filtres (state, label, assignee, project, priority) et tu la retrouves en 1 clic.

**Views recommandées à créer** :

| Nom | Filtre | Usage |
|---|---|---|
| `Active` | state in (started) | Ce sur quoi je bosse maintenant |
| `Triage` | state = Triage | À trier ce matin |
| `Quick wins` | label = quick-win, state ≠ Done | Entre deux sujets |
| `Specs en cours` | state = Specification | Voir où en est la rédac |
| `Client Stalwart` | label = client-stalwart | Vue dédiée facturable |
| `Bugs ouverts` | label = bug, state ≠ Done/Canceled | Dette technique visible |

Setup en 30 secondes par view dans la sidebar Linear.

---

## Partie 2 — Différences depuis la session précédente

### Ce que l'autre session a déjà fait (git status témoigne)

**Skills supprimées** (`D` dans git status) :
- `gerber-claude-plugin/skills/archive/` (allait dans notes)
- `gerber-claude-plugin/skills/capture/` (idem)
- `gerber-claude-plugin/skills/import/` (one-shot migration)
- `gerber-claude-plugin/skills/recall/` (idem)

**Skills modifiées** (`M` dans git status) :
- `gerber-claude-plugin/skills/onboarding/SKILL.md`
- `gerber-claude-plugin/skills/session-complete/SKILL.md`

**Code/DB** :
- Migration `0006_drop_notes.sql` : tables `notes`, `chunks`, `embeddings`, `notes_fts`, `app_meta` supprimées
- Tools MCP `notes_*` supprimés (chercher liste exacte dans Phase 4)
- CLAUDE.md projet mis à jour (gotchas réduits 20→14, ajout entité `Handoffs` et `Runbooks` dans la doc Entités)
- Ajout du package `packages/admin/` (Rust launcher Ratatui)

**Auto-mémoire** : aucun fichier dans `/Users/recarnot/.claude/projects/-Users-recarnot-dev-gerber-caserne/memory/` (vide à ce jour). Rien à analyser ni à mettre à jour côté memory.

### Ce qui reste à faire dans CETTE session (migration tasks/issues)

### Skills gerber à SUPPRIMER

| Skill | Chemin | Raison |
|---|---|---|
| `/gerber:task` | `gerber-claude-plugin/skills/task/` | Tâches → Linear |
| `/gerber:issue` | `gerber-claude-plugin/skills/issue/` | Issues → Linear |
| `/gerber:review` | `gerber-claude-plugin/skills/review/` | Maintenance hebdo basée tasks/issues, sans utilité |

### Skills gerber à REFACTOR

| Skill | Chemin | Refactor |
|---|---|---|
| `/gerber:status` | `gerber-claude-plugin/skills/status/` | Le dashboard appelle `agent-status` qui compte tasks/issues — soit on retire les compteurs (handoffs + messages count seulement), soit le skill devient un simple alias `/linear:my-issues` (à trancher) |

### Skills gerber à GARDER tel quel

- `/gerber:handoff` (`skills/handoff/`)
- `/gerber:inbox` (`skills/inbox/`)
- `/gerber:send` (`skills/send/`)
- `/gerber:rag` (`skills/rag/`)
- `/gerber:runbook` (`skills/runbook/`)
- `/gerber:session-complete` (`skills/session-complete/`)
- `/gerber:onboarding` (`skills/onboarding/`)
- `/gerber:code-setup` (`skills/code-setup/`)

### Agent à REFACTOR

- `gerber-claude-plugin/agents/agent-status.md` : actuellement dashboard tasks+issues. À simplifier en dashboard handoffs + messages + projects, ou retirer si plus rien à afficher.

### Hook à REFACTOR

- `gerber-claude-plugin/hooks/gerber-poll.sh` : poll tasks/issues actuellement. Soit retirer le hook complètement (plus rien à poll côté gerber), soit le réorienter vers `mcp__plugin_linear_linear__list_issues` filtré sur `assignee=me, state=Triage` pour alerter sur le triage Linear.

### MCP tools gerber à SUPPRIMER

| Tool | Fichier source |
|---|---|
| `task_create`, `task_get`, `task_list`, `task_update`, `task_delete`, `task_reorder` | `packages/mcp/src/tools/tasks.ts` |
| `issue_create`, `issue_get`, `issue_list`, `issue_update`, `issue_close` | `packages/mcp/src/tools/issues.ts` |

Registrations à retirer de `packages/mcp/src/tools/index.ts` :
- Imports (lignes ~15-16) : `import { ... } from './tasks.js'` et `from './issues.js'`
- Registrations (lignes ~243-423) : les 11 `server.tool('task_*', ...)` et `server.tool('issue_*', ...)`

### MCP tools gerber à GARDER

- `handoff_create`, `handoff_get`, `handoff_list`, `handoff_close` (`tools/handoffs.ts`)
- `message_create`, `message_list`, `message_update` (`tools/messages.ts`)
- `project_create`, `project_get_runbook`, `project_list`, `project_run`, `project_set_runbook`, `project_stop`, `project_tail_logs`, `project_update`, `project_delete` (`tools/projects.ts` + `tools/runbook.ts`)
- `rag`, `rag_onboard` (`tools/rag.ts`)
- `backup_brain`, `get_stats` (`tools/maintenance.ts`) — `get_stats` à adapter (retirer compteurs tasks/issues)

### Schemas et contracts à ADAPTER

- `packages/shared/src/schemas.ts` : supprimer `TaskSchema`, `IssueSchema`, leurs enums (kanban states), et types dérivés
- `packages/shared/src/db/schema.ts` (lignes ~40-92) : supprimer `tasks` et `issues` tables Drizzle, garder `projects`, `messages`, `handoffs`, `runningProcesses`
- `packages/mcp/src/tools/contracts.ts` : supprimer les RESPONSE_SHAPES pour `task_*` et `issue_*`

### Migration SQL à CRÉER

- `packages/mcp/src/db/migrations/0007_drop_tasks_issues.sql` :
  ```sql
  DROP TABLE IF EXISTS tasks;
  DROP TABLE IF EXISTS issues;
  -- vérifier s'il y a des tables enfants (task_tags, issue_labels...) à drop aussi
  ```

### _gerber_ à METTRE À JOUR

- `_gerber_/architecture.md` : lignes 5-6 (vue d'ensemble mentionne tasks/issues) + lignes ~59-60 (table Tasks & Issues à supprimer)
- `_gerber_/key-files.md` : lignes 16-17 (mentions `tools/tasks.ts` et `tools/issues.ts`)
- `_gerber_/patterns.md`, `_gerber_/gotchas.md` : pas modifiés par cette migration (vérifier juste qu'aucune mention task/issue ne traîne)

### CLAUDE.md projet à METTRE À JOUR

- Section `## Gerber > Entités` : retirer les bullets `Tasks` et `Issues`, garder `Messages`, `Handoffs`, `Runbooks`
- Section `## Gerber > Skills disponibles` : retirer `/gerber:task`, `/gerber:issue`, `/gerber:review`, et `/gerber:status` (selon décision refactor/retrait)
- Ajouter une note : « Tasks et issues sont gérées via Linear (team `eRom-Agents`, workspace `eRom`). MCP officiel `plugin:linear` actif. »

### CLAUDE.md global (`~/.claude/CLAUDE.md`) à ENRICHIR

Ajouter une section référence :

```markdown
## Linear (gestion des tâches)

Toutes les tasks et issues sont gérées dans Linear, workspace `eRom`, team `eRom-Agents`.

- 1 project Linear = 1 slug gerber (mapping 1:1)
- Workflow custom : Triage → Backlog → Brainstorming → Specification → Plan → Todo → In Progress → Test → In Review → Done
- MCP officiel : `mcp__plugin_linear_linear__*`
- Skill MCP préférée pour créer/lister : utiliser les tools Linear directs (pas de skill custom dédiée)

Pour le contexte de coordination (handoff cross-device, bus messages inter-sessions), gerber MCP reste le canal.
```

---

## Partie 3 — Plan d'exécution (à finaliser post-Explore)

### Étape 1 — Configuration Linear (Romain, 10 min)
Dans `Settings > Team > eRom-Agents` :
1. Activer Triage
2. Créer les 4 states custom : `Brainstorming` (backlog), `Specification` (backlog), `Plan` (unstarted), `Test` (started)
3. Décision : garder `Todo` ou supprimer (redondant avec `Plan`)
4. Créer les 7 labels recommandés
5. Créer les 6 views recommandées

### Étape 2 — Migration des données (Claude via MCP, 5 min)
1. Lister les 20 tâches gerber via `mcp__gerber__task_list` pour chaque projet
2. Pour chaque task : `mcp__plugin_linear_linear__save_issue` avec mapping state gerber → state Linear, project = slug gerber
3. Idem pour les issues gerber
4. Livrer un récap des URLs Linear créées

### Étape 3 — Validation (Romain, 5 min)
Vérifier dans Linear que tout est arrivé correctement. Go/no-go.

### Étape 4 — Cleanup gerber (Claude, ~30 min)
1. Migration SQL `0007_drop_tasks_issues.sql` (suppression tables tasks/issues + dépendantes)
2. Suppression des handlers MCP `tools/tasks.ts` et `tools/issues.ts`
3. Retrait des références dans `tools/index.ts` (registry)
4. Suppression des skills `gerber-claude-plugin/skills/task/`, `issue/`, `status/`
5. Mise à jour des skills à réorienter (`review`, `capture`, `archive`, `recall`)
6. Mise à jour `CLAUDE.md` projet et `~/.claude/CLAUDE.md` global (convention "tâches → Linear")
7. `pnpm test` + `pnpm typecheck` + `pnpm build` doivent passer
8. Commit groupé

### Étape 5 — Documentation (Claude, 10 min)
Doc dans `~/.claude/CLAUDE.md` : section "Tâches" pointant vers Linear MCP, convention slug ↔ project, mapping workflow.

---

## Verification

- [ ] `pnpm test` passe (tests gerber sans tasks/issues)
- [ ] `pnpm typecheck` passe
- [ ] `pnpm build` produit un bundle MCP fonctionnel
- [ ] `pnpm mcp:restore` sur une DB pré-migration fonctionne (migration 0007 applique le drop)
- [ ] Le MCP gerber démarre sans erreur (`packages/admin` Rust launcher)
- [ ] Les tools Linear sont accessibles : `mcp__plugin_linear_linear__list_issues` renvoie les issues migrées
- [ ] Les tools gerber survivants fonctionnent : `mcp__gerber__handoff_list`, `mcp__gerber__message_list`, `mcp__gerber__project_list`
- [ ] Skills supprimées : invocation `/gerber:task` retourne "skill not found"
- [ ] Skills réorientées : `/gerber:review` retourne un dashboard cohérent (sans tasks/issues)

---

## Critical files (post-Explore enrichment pending)

À compléter avec les chemins exacts des handlers MCP, schemas Drizzle, et skills une fois l'inventaire reçu.
