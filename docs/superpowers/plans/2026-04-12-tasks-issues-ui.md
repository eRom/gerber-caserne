# Tasks & Issues UI + Schema Update — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add kanban boards for tasks and issues in the project view (3 tabs), update status enums to match kanban columns, and simplify the messages UI.

**Architecture:** Backend-first: migration 0003 updates status enums, then tools/tests adapt. UI builds on top: shared kanban components (column + card), then boards (TasksBoard 7 cols, IssuesBoard 4 cols), detail Sheet panels, and finally the 3-tab project view + messages page cleanup.

**Tech Stack:** React 19, Tailwind 4, ShadCN (radix-nova), React Query 5, Lucide icons, TypeScript

---

## File Structure

### Backend — Modified
- `packages/shared/src/constants.ts` — Update TASK_STATUSES, ISSUE_STATUSES
- `packages/shared/src/db/schema.ts` — Update status enums
- `packages/mcp/src/db/migrations/0003_status_update.sql` — Migrate old → new statuses
- `packages/mcp/src/tools/tasks.ts` — Default 'inbox', update position query
- `packages/mcp/src/tools/issues.ts` — Default 'inbox'
- `packages/mcp/src/tools/index.ts` — Update enum values in tool registration
- `packages/mcp/src/tests/tools/tasks.test.ts` — Update expected defaults
- `packages/mcp/src/tests/tools/issues.test.ts` — Update expected defaults

### UI — Created
- `packages/ui/src/api/tools/tasks.ts` — MCP client wrappers (listTasks, createTask, getTask, updateTask, deleteTask, reorderTasks)
- `packages/ui/src/api/tools/issues.ts` — MCP client wrappers (listIssues, createIssue, getIssue, updateIssue, closeIssue)
- `packages/ui/src/api/hooks/use-tasks.ts` — React Query hooks (useTasks, useTask, useCreateTask, useUpdateTask, useDeleteTask)
- `packages/ui/src/api/hooks/use-issues.ts` — React Query hooks (useIssues, useIssue, useCreateIssue, useUpdateIssue, useCloseIssue)
- `packages/ui/src/components/kanban-column.tsx` — Generic column: header (dot + title + count) + cards slot + add button
- `packages/ui/src/components/kanban-card.tsx` — Generic card: title + badges row (priority, tags, severity, due date, assignee)
- `packages/ui/src/components/tasks-board.tsx` — 7-column kanban, filter bar, renders KanbanColumns with task cards
- `packages/ui/src/components/issues-board.tsx` — 4-column kanban, filter bar, renders KanbanColumns with issue cards
- `packages/ui/src/components/task-detail-sheet.tsx` — Sheet panel: edit title, description, status dropdown, priority, tags, assignee, due date, subtasks list
- `packages/ui/src/components/issue-detail-sheet.tsx` — Sheet panel: edit title, description, status dropdown, severity, priority, tags, assignee, relatedTaskId

### UI — Modified
- `packages/ui/src/pages/project-view.tsx` — 3 tabs: Taches | Issues | Memoire, route stays `/projects/:slug`
- `packages/ui/src/pages/messages.tsx` — Update filters: type = context|reminder, status = pending|done
- `packages/ui/src/components/message-type-badge.tsx` — context (blue) + reminder (amber), remove issue/task
- `packages/ui/src/components/message-status-badge.tsx` — pending (amber) + done (emerald), remove ack/dismissed
- `packages/ui/src/components/message-card.tsx` — Remove MessagePriorityBadge import and usage
- `packages/ui/src/components/message-detail.tsx` — Remove priority badge, simplify actions (Done only, remove Ack/Dismiss)
- `packages/ui/src/components/message-priority-badge.tsx` — DELETE this file (no longer needed)
- `packages/ui/src/api/tools/messages.ts` — Update TypeScript types for context/reminder, pending/done

---

### Task 1: Backend — Migration 0003 + status enum update

**Files:**
- Create: `packages/mcp/src/db/migrations/0003_status_update.sql`
- Modify: `packages/shared/src/constants.ts`
- Modify: `packages/shared/src/db/schema.ts`
- Modify: `packages/mcp/src/tools/tasks.ts`
- Modify: `packages/mcp/src/tools/issues.ts`
- Modify: `packages/mcp/src/tools/index.ts`
- Modify: `packages/mcp/src/tests/tools/tasks.test.ts`
- Modify: `packages/mcp/src/tests/tools/issues.test.ts`

- [ ] **Step 1: Create migration SQL**

Create `packages/mcp/src/db/migrations/0003_status_update.sql`:

```sql
-- Tasks: map old statuses to new workflow statuses
UPDATE tasks SET status = 'inbox' WHERE status = 'active';
--> statement-breakpoint
UPDATE tasks SET status = 'inbox' WHERE status = 'waiting';
--> statement-breakpoint
UPDATE tasks SET status = 'inbox' WHERE status = 'someday';
--> statement-breakpoint
-- Issues: map old statuses to new workflow statuses
UPDATE issues SET status = 'inbox' WHERE status = 'open';
--> statement-breakpoint
UPDATE issues SET status = 'in_review' WHERE status = 'resolved';
```

- [ ] **Step 2: Update constants.ts**

In `packages/shared/src/constants.ts`, replace:

```typescript
// Old:
export const TASK_STATUSES = ['active', 'waiting', 'someday', 'done'] as const;
// New:
export const TASK_STATUSES = ['inbox', 'brainstorming', 'specification', 'plan', 'implementation', 'test', 'done'] as const;

// Old:
export const ISSUE_STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const;
// New:
export const ISSUE_STATUSES = ['inbox', 'in_progress', 'in_review', 'closed'] as const;
```

- [ ] **Step 3: Update schema.ts**

In `packages/shared/src/db/schema.ts`, update the `status` enum for tasks table:
```typescript
status: text('status', { enum: ['inbox', 'brainstorming', 'specification', 'plan', 'implementation', 'test', 'done'] }).notNull().default('inbox'),
```

And for issues table:
```typescript
status: text('status', { enum: ['inbox', 'in_progress', 'in_review', 'closed'] }).notNull().default('inbox'),
```

- [ ] **Step 4: Update tasks.ts tool handler**

In `packages/mcp/src/tools/tasks.ts`:
- Change `TaskCreateInput` default status from `.default('active')` to `.default('inbox')`
- The `taskCreate` INSERT already uses `input.status` so the SQL is fine

- [ ] **Step 5: Update issues.ts tool handler**

In `packages/mcp/src/tools/issues.ts`:
- Change `IssueCreateInput` default severity, keep as is
- Change the hardcoded `'open'` in the INSERT to `'inbox'`
- If there's no status field in IssueCreateInput, add it: `status: z.enum(ISSUE_STATUSES).optional().default('inbox')`

- [ ] **Step 6: Update index.ts tool registration**

In `packages/mcp/src/tools/index.ts`, update all enum arrays:
- `task_create` status: `['inbox', 'brainstorming', 'specification', 'plan', 'implementation', 'test', 'done']`
- `task_list` status filter: same
- `task_update` status: same
- `issue_create`: add `status` param with `['inbox', 'in_progress', 'in_review', 'closed']`
- `issue_list` status filter: same
- `issue_update` status: same

- [ ] **Step 7: Update task tests**

In `packages/mcp/src/tests/tools/tasks.test.ts`:
- Change all `expect(result.item.status).toBe('active')` to `expect(result.item.status).toBe('inbox')`
- Change test data using `status: 'done'` — keep as is (done still exists)
- Change any test using `status: 'active'` to `status: 'inbox'`
- Change any test using `status: 'waiting'` or `status: 'someday'` to valid new statuses like `'brainstorming'`, `'specification'`

- [ ] **Step 8: Update issue tests**

In `packages/mcp/src/tests/tools/issues.test.ts`:
- Change all `expect(result.item.status).toBe('open')` to `expect(result.item.status).toBe('inbox')`
- Change `status: 'in_progress'` — keep as is (still valid)
- Change `status: 'resolved'` to `status: 'in_review'`

- [ ] **Step 9: Run all tests**

Run: `cd /Users/recarnot/dev/agent-brain && pnpm --filter @agent-brain/mcp test`
Expected: ALL 184 tests pass

- [ ] **Step 10: Typecheck**

Run: `pnpm --filter @agent-brain/shared typecheck`
Expected: PASS

- [ ] **Step 11: Commit**

```bash
git add packages/shared/src/constants.ts packages/shared/src/db/schema.ts packages/mcp/src/db/migrations/0003_status_update.sql packages/mcp/src/tools/tasks.ts packages/mcp/src/tools/issues.ts packages/mcp/src/tools/index.ts packages/mcp/src/tests/tools/tasks.test.ts packages/mcp/src/tests/tools/issues.test.ts
git commit -m "feat(schema): update task/issue statuses to match kanban columns, default inbox"
```

---

### Task 2: UI — API client wrappers + React Query hooks

**Files:**
- Create: `packages/ui/src/api/tools/tasks.ts`
- Create: `packages/ui/src/api/tools/issues.ts`
- Create: `packages/ui/src/api/hooks/use-tasks.ts`
- Create: `packages/ui/src/api/hooks/use-issues.ts`

- [ ] **Step 1: Create tasks API client**

Create `packages/ui/src/api/tools/tasks.ts`:

```typescript
import { mcpCall } from '../mcp-client.js';

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  position: number;
  assignee: string | null;
  tags: string[];
  dueDate: number | null;
  waitingOn: string | null;
  completedAt: number | null;
  parentId: string | null;
  metadata: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface TaskListResponse {
  items: Task[];
  total: number;
}

export interface TaskGetResponse {
  item: Task;
  subtasks: Task[];
}

export interface TaskMutationResponse {
  ok: true;
  id: string;
  item: Task;
}

export function listTasks(params: {
  projectSlug?: string;
  status?: string;
  priority?: string;
  tags_any?: string[];
  parentId?: string;
  sort?: string;
  limit?: number;
  offset?: number;
} = {}) {
  return mcpCall<TaskListResponse>('task_list', params);
}

export function getTask(params: { id: string }) {
  return mcpCall<TaskGetResponse>('task_get', params);
}

export function createTask(params: {
  projectSlug: string;
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  assignee?: string;
  tags?: string[];
  dueDate?: number;
  waitingOn?: string;
  parentId?: string;
}) {
  return mcpCall<TaskMutationResponse>('task_create', params);
}

export function updateTask(params: {
  id: string;
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  assignee?: string | null;
  tags?: string[];
  dueDate?: number | null;
  waitingOn?: string | null;
  metadata?: Record<string, unknown>;
}) {
  return mcpCall<TaskMutationResponse>('task_update', params);
}

export function deleteTask(params: { id: string }) {
  return mcpCall<{ ok: true; id: string; deletedCount: number }>('task_delete', params);
}
```

- [ ] **Step 2: Create issues API client**

Create `packages/ui/src/api/tools/issues.ts` — same pattern as tasks.ts:

```typescript
import { mcpCall } from '../mcp-client.js';

export interface Issue {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  severity: string;
  assignee: string | null;
  tags: string[];
  relatedTaskId: string | null;
  metadata: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface IssueListResponse {
  items: Issue[];
  total: number;
}

export interface IssueMutationResponse {
  ok: true;
  id: string;
  item: Issue;
}

export function listIssues(params: {
  projectSlug?: string;
  status?: string;
  severity?: string;
  priority?: string;
  tags_any?: string[];
  limit?: number;
  offset?: number;
} = {}) {
  return mcpCall<IssueListResponse>('issue_list', params);
}

export function getIssue(params: { id: string }) {
  return mcpCall<{ item: Issue }>('issue_get', params);
}

export function createIssue(params: {
  projectSlug: string;
  title: string;
  description?: string;
  status?: string;
  severity?: string;
  priority?: string;
  assignee?: string;
  tags?: string[];
}) {
  return mcpCall<IssueMutationResponse>('issue_create', params);
}

export function updateIssue(params: {
  id: string;
  title?: string;
  description?: string;
  status?: string;
  severity?: string;
  priority?: string;
  assignee?: string | null;
  tags?: string[];
  relatedTaskId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  return mcpCall<IssueMutationResponse>('issue_update', params);
}

export function closeIssue(params: { id: string }) {
  return mcpCall<IssueMutationResponse>('issue_close', params);
}
```

- [ ] **Step 3: Create tasks React Query hooks**

Create `packages/ui/src/api/hooks/use-tasks.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listTasks, getTask, createTask, updateTask, deleteTask } from '../tools/tasks.js';

export function useTasks(params: {
  projectSlug?: string;
  status?: string;
  priority?: string;
  tags_any?: string[];
  parentId?: string;
  sort?: string;
  limit?: number;
} = {}) {
  return useQuery({
    queryKey: ['tasks', params],
    queryFn: () => listTasks(params),
    refetchOnWindowFocus: true,
  });
}

export function useTask(id: string | null) {
  return useQuery({
    queryKey: ['tasks', 'detail', id],
    queryFn: () => getTask({ id: id! }),
    enabled: !!id,
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createTask,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateTask,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteTask,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}
```

- [ ] **Step 4: Create issues React Query hooks**

Create `packages/ui/src/api/hooks/use-issues.ts` — same pattern as use-tasks.ts with `useIssues`, `useIssue`, `useCreateIssue`, `useUpdateIssue`, `useCloseIssue`.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/api/tools/tasks.ts packages/ui/src/api/tools/issues.ts packages/ui/src/api/hooks/use-tasks.ts packages/ui/src/api/hooks/use-issues.ts
git commit -m "feat(ui): add tasks + issues API clients and React Query hooks"
```

---

### Task 3: UI — Shared kanban components

**Files:**
- Create: `packages/ui/src/components/kanban-column.tsx`
- Create: `packages/ui/src/components/kanban-card.tsx`

- [ ] **Step 1: Create KanbanColumn**

Create `packages/ui/src/components/kanban-column.tsx`:

A generic column component that receives:
- `title: string` — column header text (e.g. "Inbox", "Brainstorm")
- `color: string` — dot color as Tailwind class (e.g. `"bg-amber-500"`)
- `count: number` — item count
- `children: ReactNode` — card slots
- `onAdd?: () => void` — callback for the "+ Add" button at the bottom

Layout: vertical flex, sticky header with colored dot + title + count, scrollable cards area, dashed "+ Add" button at bottom.

Tailwind classes following erom-design patterns:
- Column: `flex flex-col gap-1.5 min-w-[180px] flex-1`
- Header: `flex items-center gap-2 px-1 pb-2`
- Dot: `size-2 rounded-full {color}`
- Title: `text-[11px] font-semibold uppercase tracking-wide text-muted-foreground`
- Count: `text-[10px] text-muted-foreground/40 ml-auto`
- Cards area: `flex-1 flex flex-col gap-1.5 overflow-y-auto`
- Add button: `flex items-center justify-center gap-1 py-1.5 border border-dashed border-border/60 rounded-md text-[11px] text-muted-foreground/40 hover:text-muted-foreground hover:border-border transition-colors cursor-pointer`

- [ ] **Step 2: Create KanbanCard**

Create `packages/ui/src/components/kanban-card.tsx`:

A generic card for both tasks and issues. Props:
- `title: string`
- `priority?: string` — renders colored badge (high = pink, critical = pink+glow, normal = hidden, low = hidden)
- `tags?: string[]` — renders cyan tag chips
- `severity?: string` — renders severity badge (bug = pink, regression = amber, warning = amber, enhancement = emerald)
- `assignee?: string | null`
- `dueDate?: number | null` — renders amber "due XX" or red if overdue
- `isDone?: boolean` — renders with opacity-40 + line-through title
- `onClick?: () => void`

Layout: compact card with title + single metadata row.

Tailwind:
- Card: `bg-card border border-border rounded-lg px-3 py-2 cursor-pointer transition-all hover:border-border/60 hover:shadow-sm`
- Done state: add `opacity-40` class, title gets `line-through`
- Title: `text-[13px] font-medium leading-tight`
- Meta row: `flex items-center gap-1.5 mt-1 flex-wrap`
- Priority badge: `text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-pink-500/10 text-pink-400` (for high/critical)
- Tag: `text-[9px] px-1.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400`
- Severity: same pattern with semantic colors
- Assignee: `text-[10px] text-muted-foreground`
- Due date: `text-[10px] text-amber-400` (or `text-destructive` if overdue)

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/components/kanban-column.tsx packages/ui/src/components/kanban-card.tsx
git commit -m "feat(ui): add shared KanbanColumn + KanbanCard components"
```

---

### Task 4: UI — TasksBoard with detail Sheet

**Files:**
- Create: `packages/ui/src/components/tasks-board.tsx`
- Create: `packages/ui/src/components/task-detail-sheet.tsx`

- [ ] **Step 1: Create TasksBoard**

Create `packages/ui/src/components/tasks-board.tsx`:

Props: `projectSlug: string`

The component:
1. Fetches tasks via `useTasks({ projectSlug, limit: 200 })` — gets all tasks for the project
2. Groups tasks by status into 7 columns
3. Renders a filter bar at top (priority Select, tags dropdown — or just keep it simple V1 with no filters initially)
4. Renders 7 KanbanColumns with KanbanCards
5. Manages `selectedTaskId` state for the detail Sheet
6. Has a quick-add: clicking "+" on a column opens a small inline input, creates task with that column's status

Column definitions:
```typescript
const TASK_COLUMNS = [
  { status: 'inbox', title: 'Inbox', color: 'bg-amber-500' },
  { status: 'brainstorming', title: 'Brainstorm', color: 'bg-violet-500' },
  { status: 'specification', title: 'Spec', color: 'bg-blue-500' },
  { status: 'plan', title: 'Plan', color: 'bg-cyan-500' },
  { status: 'implementation', title: 'Implem', color: 'bg-emerald-500' },
  { status: 'test', title: 'Test', color: 'bg-pink-500' },
  { status: 'done', title: 'Done', color: 'bg-muted-foreground/20' },
] as const;
```

Layout:
- Container: `flex flex-col flex-1 overflow-hidden`
- Filter bar: `flex items-center gap-2 px-4 py-2 shrink-0`
- Kanban: `flex gap-2 px-4 pb-4 flex-1 overflow-x-auto min-h-0`

Quick-add behavior:
- State: `addingInColumn: string | null`
- When set, that column shows a text input at top of cards
- On Enter: call `createTask({ projectSlug, title: inputValue, status: column.status })`
- On Escape or blur: cancel

- [ ] **Step 2: Create TaskDetailSheet**

Create `packages/ui/src/components/task-detail-sheet.tsx`:

Props:
- `taskId: string | null` — when non-null, Sheet opens
- `projectSlug: string`
- `onClose: () => void`

Uses `useTask(taskId)` to fetch task + subtasks.
Uses `useUpdateTask()` for mutations.
Uses `useDeleteTask()` for delete.

Sheet content (using ShadCN `Sheet` component, side="right", w-[480px]):

```
Sheet header: task title (editable inline, blur = save)

Status selector: horizontal pill group showing all 7 statuses, current highlighted
  — clicking a pill calls updateTask({ id, status: newStatus })
  — board updates immediately via React Query invalidation

Fields (vertical layout):
  Priority: Select dropdown (low | normal | high)
  Assignee: Input text
  Due date: Input type="date" (convert to/from epoch)
  Tags: comma-separated input or tag chips with add/remove
  Description: Textarea with markdown (no preview needed V1)

Subtasks section:
  List of subtask titles with checkbox
  "+ Add subtask" input

Footer:
  Delete button (with confirmation)
  Created/Updated timestamps
```

Key behavior: every field change triggers `updateTask()` mutation → React Query invalidates `['tasks']` → board re-renders with card in new column if status changed.

Use debounced save for text fields (title, description, assignee) — 500ms delay.

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/components/tasks-board.tsx packages/ui/src/components/task-detail-sheet.tsx
git commit -m "feat(ui): add TasksBoard kanban + TaskDetailSheet"
```

---

### Task 5: UI — IssuesBoard with detail Sheet

**Files:**
- Create: `packages/ui/src/components/issues-board.tsx`
- Create: `packages/ui/src/components/issue-detail-sheet.tsx`

- [ ] **Step 1: Create IssuesBoard**

Create `packages/ui/src/components/issues-board.tsx`:

Same pattern as TasksBoard but with 4 columns:

```typescript
const ISSUE_COLUMNS = [
  { status: 'inbox', title: 'Inbox', color: 'bg-amber-500' },
  { status: 'in_progress', title: 'In Progress', color: 'bg-emerald-500' },
  { status: 'in_review', title: 'In Review', color: 'bg-violet-500' },
  { status: 'closed', title: 'Closed', color: 'bg-muted-foreground/20' },
] as const;
```

Props: `projectSlug: string`

Uses `useIssues({ projectSlug, limit: 200 })`.
Cards show severity badge + priority badge.
Quick-add creates issue with `status: column.status`.
Click opens IssueDetailSheet.

- [ ] **Step 2: Create IssueDetailSheet**

Create `packages/ui/src/components/issue-detail-sheet.tsx`:

Same pattern as TaskDetailSheet but with issue-specific fields:

```
Sheet header: issue title (editable inline)

Status selector: 4-pill group (inbox | in_progress | in_review | closed)

Fields:
  Severity: Select (bug | regression | warning | enhancement)
  Priority: Select (low | normal | high | critical)
  Assignee: Input text
  Tags: tag chips
  Related Task: Select dropdown (list of project tasks) or text input for task ID
  Description: Textarea

Footer:
  Close Issue button (shorthand for status=closed)
  Delete button
  Created/Updated timestamps
```

Uses `useIssue(issueId)`, `useUpdateIssue()`, `useCloseIssue()`.

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/components/issues-board.tsx packages/ui/src/components/issue-detail-sheet.tsx
git commit -m "feat(ui): add IssuesBoard kanban + IssueDetailSheet"
```

---

### Task 6: UI — Project view with 3 tabs

**Files:**
- Modify: `packages/ui/src/pages/project-view.tsx`

- [ ] **Step 1: Rewrite project-view.tsx with 3 tabs**

Replace the entire content of `packages/ui/src/pages/project-view.tsx`:

The new structure:

```typescript
import { useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router';
import { useProjects } from '@/api/hooks/use-projects';
import { useNotes } from '@/api/hooks/use-notes';
import { useTasks } from '@/api/hooks/use-tasks';
import { useIssues } from '@/api/hooks/use-issues';
import { TasksBoard } from '@/components/tasks-board';
import { IssuesBoard } from '@/components/issues-board';
import { NoteCard } from '@/components/note-card';
import { ImportZone } from '@/components/import-zone';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, FileText, Upload } from 'lucide-react';
import { GLOBAL_PROJECT_ID } from '@agent-brain/shared';
```

Layout:
```
<div className="flex flex-col h-full">
  {/* Header */}
  <div className="px-6 pt-6">
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold">{project?.name}</h1>
        {project?.description && <p className="mt-1 text-sm text-muted-foreground">...</p>}
      </div>
      <Button>+ Nouveau</Button>
    </div>
  </div>

  {/* Tabs */}
  <Tabs defaultValue="tasks" className="flex flex-col flex-1 min-h-0">
    <div className="px-6 border-b border-border">
      <TabsList className="bg-transparent gap-0 h-auto p-0">
        <TabsTrigger value="tasks" className="...">
          Tâches <Badge>{taskCount}</Badge>
        </TabsTrigger>
        <TabsTrigger value="issues" className="...">
          Issues <Badge>{issueCount}</Badge>
        </TabsTrigger>
        <TabsTrigger value="memory" className="...">
          Mémoire
        </TabsTrigger>
      </TabsList>
    </div>

    <TabsContent value="tasks" className="flex-1 overflow-hidden mt-0">
      <TasksBoard projectSlug={slug!} />
    </TabsContent>

    <TabsContent value="issues" className="flex-1 overflow-hidden mt-0">
      <IssuesBoard projectSlug={slug!} />
    </TabsContent>

    <TabsContent value="memory" className="flex-1 overflow-y-auto mt-0">
      {/* Existing notes view with kind/status filters */}
    </TabsContent>
  </Tabs>
</div>
```

The "Memoire" tab contains the existing note list + filters (kind tabs, status tabs, import toggle) — moved from the old project-view body.

TabsTrigger styling: use custom classes for the underline-style tabs (not the default rounded pill style):
```
data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary
rounded-none border-b-2 border-transparent pb-2 pt-2 px-4 text-[13px] font-medium text-muted-foreground
```

- [ ] **Step 2: Verify the dev server compiles**

Run: `cd /Users/recarnot/dev/agent-brain && pnpm dev` (check for compilation errors)
Verify in browser: tabs switch, TasksBoard renders, IssuesBoard renders, Memory tab shows existing notes.

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/pages/project-view.tsx
git commit -m "feat(ui): add 3-tab project view (Tâches | Issues | Mémoire)"
```

---

### Task 7: UI — Messages page update

**Files:**
- Modify: `packages/ui/src/pages/messages.tsx`
- Modify: `packages/ui/src/components/message-type-badge.tsx`
- Modify: `packages/ui/src/components/message-status-badge.tsx`
- Modify: `packages/ui/src/components/message-card.tsx`
- Modify: `packages/ui/src/components/message-detail.tsx`
- Modify: `packages/ui/src/api/tools/messages.ts`
- Delete: `packages/ui/src/components/message-priority-badge.tsx`

- [ ] **Step 1: Update message-type-badge.tsx**

Replace TYPE_CONFIG:
```typescript
const TYPE_CONFIG = {
  context: { label: 'Context', icon: Info, style: 'bg-blue-500/10 text-blue-400' },
  reminder: { label: 'Reminder', icon: Bell, style: 'bg-amber-500/10 text-amber-400' },
} as const;
```

Import `Bell` from lucide-react instead of `ArrowRight`.

- [ ] **Step 2: Update message-status-badge.tsx**

Replace STATUS_CONFIG — only 2 statuses:
```typescript
const STATUS_CONFIG = {
  pending: { label: 'Pending', style: 'bg-amber-500/10 text-amber-400' },
  done: { label: 'Done', style: 'bg-emerald-500/10 text-emerald-400' },
} as const;
```

- [ ] **Step 3: Update message-card.tsx**

Remove `MessagePriorityBadge` import and its usage from the card. The card should only show type badge + status badge + time.

- [ ] **Step 4: Update message-detail.tsx**

- Remove `MessagePriorityBadge` import and usage
- Remove severity/assignee from metadata card (they no longer exist on messages)
- Simplify actions: only show "Done" button when status is 'pending'. Remove Ack and Dismiss buttons.
- Change `setStatus` to only accept `'done'`

- [ ] **Step 5: Update messages.tsx page filters**

In the type Select:
```typescript
<SelectItem value="all">All types</SelectItem>
<SelectItem value="context">Context</SelectItem>
<SelectItem value="reminder">Reminder</SelectItem>
```

In the status Select:
```typescript
<SelectItem value="all">All statuses</SelectItem>
<SelectItem value="pending">Pending</SelectItem>
<SelectItem value="done">Done</SelectItem>
```

- [ ] **Step 6: Update api/tools/messages.ts types**

Update the TypeScript types:
- `createMessage` type param: `'context' | 'reminder'`
- `updateMessage` status param: `'pending' | 'done'`
- Remove `priority` from `createMessage` params

- [ ] **Step 7: Delete message-priority-badge.tsx**

Run: `trash packages/ui/src/components/message-priority-badge.tsx`

- [ ] **Step 8: Verify no broken imports**

Run: `cd /Users/recarnot/dev/agent-brain && pnpm --filter @agent-brain/ui build` (or dev server check)

- [ ] **Step 9: Commit**

```bash
git add packages/ui/src/pages/messages.tsx packages/ui/src/components/message-type-badge.tsx packages/ui/src/components/message-status-badge.tsx packages/ui/src/components/message-card.tsx packages/ui/src/components/message-detail.tsx packages/ui/src/api/tools/messages.ts
git commit -m "refactor(ui): simplify messages to context/reminder with pending/done"
```

---

### Summary

| # | Task | New files | Modified | Tests |
|---|------|-----------|----------|-------|
| 1 | Backend: migration 0003 + status update | 1 | 7 | pnpm test (184) |
| 2 | UI: API clients + hooks | 4 | 0 | compile check |
| 3 | UI: KanbanColumn + KanbanCard | 2 | 0 | visual |
| 4 | UI: TasksBoard + TaskDetailSheet | 2 | 0 | visual |
| 5 | UI: IssuesBoard + IssueDetailSheet | 2 | 0 | visual |
| 6 | UI: Project view 3 tabs | 0 | 1 | visual |
| 7 | UI: Messages page update | 0 | 6 + 1 delete | compile check |

**Total: 11 new files, 14 modified, 1 deleted**
