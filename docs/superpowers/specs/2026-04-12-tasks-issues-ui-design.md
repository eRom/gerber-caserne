# Tasks & Issues UI + Schema Update — Design Spec

## Goal

Ajouter une UI kanban pour les taches et issues dans la vue projet, avec 3 onglets (Taches | Issues | Memoire). Mettre a jour le modele de donnees pour que les colonnes kanban = status.

## Schema Changes

### Task statuses (migration 0003)

Ancien: `active | waiting | someday | done`
Nouveau: `inbox | brainstorming | specification | plan | implementation | test | done`

Default a la creation: `inbox`

### Issue statuses (migration 0003)

Ancien: `open | in_progress | resolved | closed`
Nouveau: `inbox | in_progress | in_review | closed`

Default a la creation: `inbox`

### Migration strategy

```sql
-- Tasks: map old → new
UPDATE tasks SET status = 'inbox' WHERE status = 'active';
UPDATE tasks SET status = 'inbox' WHERE status = 'waiting';
UPDATE tasks SET status = 'inbox' WHERE status = 'someday';
-- 'done' stays 'done'

-- Issues: map old → new
UPDATE issues SET status = 'inbox' WHERE status = 'open';
-- 'in_progress' stays 'in_progress'
UPDATE issues SET status = 'in_review' WHERE status = 'resolved';
-- 'closed' stays 'closed'
```

### Files impacted (backend)

- `packages/shared/src/constants.ts` — Update TASK_STATUSES, ISSUE_STATUSES
- `packages/shared/src/db/schema.ts` — Update enums
- `packages/shared/src/schemas.ts` — Schemas auto-derive from Drizzle, no change needed
- `packages/mcp/src/db/migrations/0003_status_update.sql` — Migration
- `packages/mcp/src/tools/tasks.ts` — Default 'inbox' instead of 'active'
- `packages/mcp/src/tools/issues.ts` — Default 'inbox' instead of 'open'
- `packages/mcp/src/tools/index.ts` — Update enum values in tool registration
- `packages/mcp/src/tests/tools/tasks.test.ts` — Update expected defaults
- `packages/mcp/src/tests/tools/issues.test.ts` — Update expected defaults

## UI Architecture

### Project view — 3 onglets

Route: `/projects/:slug`

```
ProjectView
├── ProjectHeader (name, description, + Nouveau button)
├── TabsBar
│   ├── "Taches" (count badge primary)
│   ├── "Issues" (count badge muted)
│   └── "Memoire" (existing notes view)
└── TabContent
    ├── TasksBoard (kanban 7 colonnes)
    ├── IssuesBoard (kanban 4 colonnes)
    └── MemoryView (existing notes/filters — no change)
```

### TasksBoard component

7 colonnes, chacune = un status:

| Colonne | Status | Couleur dot |
|---------|--------|-------------|
| Inbox | `inbox` | amber (primary) |
| Brainstorm | `brainstorming` | violet |
| Spec | `specification` | bleu |
| Plan | `plan` | cyan |
| Implem | `implementation` | vert (emerald) |
| Test | `test` | rose |
| Done | `done` | gris 20% |

Features:
- Filter bar: Priorite, Tags, Assignee (dropdowns)
- Cards: titre, priority badge, tags, due date, assignee
- Colonne Done: cards en opacite 0.4 + titre barre
- Bouton "+ Ajouter" en bas de chaque colonne (cree une task avec status = colonne)
- Drag-and-drop entre colonnes = update status (future, pas V1)

### IssuesBoard component

4 colonnes:

| Colonne | Status | Couleur dot |
|---------|--------|-------------|
| Inbox | `inbox` | amber |
| In Progress | `in_progress` | vert |
| In Review | `in_review` | violet |
| Closed | `closed` | gris 20% |

Features:
- Filter bar: Severite, Priorite, Tags
- Cards: titre, severity badge, priority badge, assignee
- Colonne Closed: cards en opacite 0.4 + titre barre

### Messages page update

Route: `/messages`

- Type filter: `context | reminder` (etait issue | context | task)
- Status filter: `pending | done` (etait pending | ack | done | dismissed)
- Remove priority badge
- Update type badge colors: context = bleu, reminder = amber
- Remove old issue/task type badges

### New files (UI)

- `packages/ui/src/components/tasks-board.tsx` — Kanban 7 colonnes
- `packages/ui/src/components/issues-board.tsx` — Kanban 4 colonnes
- `packages/ui/src/components/kanban-card.tsx` — Card component shared
- `packages/ui/src/components/kanban-column.tsx` — Column component shared
- `packages/ui/src/api/tools/tasks.ts` — MCP client wrappers
- `packages/ui/src/api/tools/issues.ts` — MCP client wrappers
- `packages/ui/src/api/hooks/use-tasks.ts` — React Query hooks
- `packages/ui/src/api/hooks/use-issues.ts` — React Query hooks

### Modified files (UI)

- `packages/ui/src/pages/project-view.tsx` — Add tabs, integrate TasksBoard + IssuesBoard
- `packages/ui/src/pages/messages.tsx` — Update filters/badges for context/reminder
- `packages/ui/src/components/message-type-badge.tsx` — context (bleu) + reminder (amber)
- `packages/ui/src/components/message-status-badge.tsx` — pending + done only
- `packages/ui/src/components/message-card.tsx` — Remove priority display
- `packages/ui/src/components/message-detail.tsx` — Simplify action buttons (Done only)
- `packages/ui/src/api/tools/messages.ts` — Update types
- `packages/ui/src/components/sidebar.tsx` — No change needed (messages badge stays)

### Design tokens (erom-design)

- Dark mode par defaut, gris chauds hue 90 pour sidebar
- Cards: `bg-card border border-border rounded-lg` avec hover
- Badges: `rounded-full bg-{color}-500/10 text-{color}-400 text-[10px]`
- Column dots: couleur semantique par status
- Done cards: `opacity-40` + `line-through`
- Tabs: active = primary color + border-bottom
- Filtres: ghost buttons avec border

### Kanban card anatomy

```
┌─────────────────────────┐
│ Titre de la tache       │  ← text-xs font-medium
│ [high] [tag] [due 15avr]│  ← badges row: priority, tags, due/assignee
└─────────────────────────┘
```

Compact: pas de description affichee, juste titre + metadata line.

## Not in scope (V1)

- Drag-and-drop entre colonnes (future: use @dnd-kit)
- Detail panel / modal au clic sur une card
- Inline creation (quick-add sans modal)
- Subtasks display
- Board/List view toggle
- Task/Issue search

## Test plan

- Backend: update existing tests for new status values, pnpm test must pass
- UI: manual verification — tabs switch, cards render, filters work
- Migration: verify on existing DB that old statuses are correctly mapped
