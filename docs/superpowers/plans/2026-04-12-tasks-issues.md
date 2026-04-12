# Tasks & Issues Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplifier les messages (context + reminder), ajouter des tables `tasks` et `issues` rattachees aux projets avec CRUD MCP complet.

**Architecture:** Messages deviennent legers (context/reminder, 2 status). Tasks et issues sont des entites first-class avec leur propre table, schemas Zod, tools MCP et tests. Migration SQL additive (pas de drop de messages — ALTER + nouvelles tables).

**Tech Stack:** SQLite (better-sqlite3), Drizzle schema, Zod, MCP SDK, Vitest

---

## File Structure

### Modified
- `packages/shared/src/constants.ts` — Nouvelles constantes enums
- `packages/shared/src/db/schema.ts` — ALTER messages, CREATE tasks + issues
- `packages/shared/src/schemas.ts` — TaskSchema, IssueSchema, MessageSchema modifie
- `packages/shared/src/types.ts` — Export Task, Issue types
- `packages/shared/src/index.ts` — Re-exports
- `packages/mcp/src/tools/messages.ts` — Simplifier (context/reminder, 2 status, drop priority)
- `packages/mcp/src/tools/index.ts` — Enregistrer les nouveaux tools
- `packages/mcp/src/tools/contracts.ts` — Ajouter task/issue response shapes
- `packages/mcp/src/tests/tools/messages.test.ts` — Adapter aux nouveaux enums
- `packages/mcp/src/tests/tools/register.test.ts` — Mettre a jour le nombre de tools
- `README.md` — Documenter les nouveaux tools

### Created
- `packages/mcp/src/db/migrations/0002_tasks_issues.sql` — Migration SQL
- `packages/mcp/src/tools/tasks.ts` — CRUD tasks
- `packages/mcp/src/tools/issues.ts` — CRUD issues
- `packages/mcp/src/tests/tools/tasks.test.ts` — Tests tasks
- `packages/mcp/src/tests/tools/issues.test.ts` — Tests issues

---

### Task 1: Migration SQL et schema Drizzle

**Files:**
- Create: `packages/mcp/src/db/migrations/0002_tasks_issues.sql`
- Modify: `packages/shared/src/db/schema.ts`
- Modify: `packages/shared/src/constants.ts`

- [ ] **Step 1: Ecrire la migration SQL**

Create `packages/mcp/src/db/migrations/0002_tasks_issues.sql`:

```sql
-- Simplify messages: drop priority column, narrow type/status enums
-- SQLite can't DROP COLUMN on old versions, but since 3.35+ it can.
-- better-sqlite3 ships 3.45+, so this is safe.

-- Step 1: Create tasks table
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL REFERENCES `projects`(`id`),
	`title` text NOT NULL,
	`description` text NOT NULL DEFAULT '',
	`status` text NOT NULL DEFAULT 'active',
	`priority` text NOT NULL DEFAULT 'normal',
	`position` integer NOT NULL DEFAULT 0,
	`assignee` text,
	`tags` text NOT NULL DEFAULT '[]',
	`due_date` integer,
	`waiting_on` text,
	`completed_at` integer,
	`parent_id` text REFERENCES `tasks`(`id`),
	`metadata` text NOT NULL DEFAULT '{}',
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_tasks_project_status` ON `tasks` (`project_id`, `status`);
--> statement-breakpoint
CREATE INDEX `idx_tasks_parent` ON `tasks` (`parent_id`);
--> statement-breakpoint
CREATE INDEX `idx_tasks_status_position` ON `tasks` (`status`, `position`);
--> statement-breakpoint

-- Step 2: Create issues table
CREATE TABLE `issues` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL REFERENCES `projects`(`id`),
	`title` text NOT NULL,
	`description` text NOT NULL DEFAULT '',
	`status` text NOT NULL DEFAULT 'open',
	`priority` text NOT NULL DEFAULT 'normal',
	`severity` text NOT NULL DEFAULT 'bug',
	`assignee` text,
	`tags` text NOT NULL DEFAULT '[]',
	`related_task_id` text REFERENCES `tasks`(`id`),
	`metadata` text NOT NULL DEFAULT '{}',
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_issues_project_status` ON `issues` (`project_id`, `status`);
--> statement-breakpoint
CREATE INDEX `idx_issues_severity` ON `issues` (`severity`);
--> statement-breakpoint

-- Step 3: Migrate existing task/issue messages to new tables
INSERT INTO tasks (id, project_id, title, description, status, priority, metadata, created_at, updated_at)
  SELECT id, project_id, title, content, 'active',
    CASE WHEN priority IS NOT NULL THEN priority ELSE 'normal' END,
    metadata, created_at, updated_at
  FROM messages WHERE type = 'task';
--> statement-breakpoint
INSERT INTO issues (id, project_id, title, description, status, priority, severity, metadata, created_at, updated_at)
  SELECT id, project_id, title, content,
    'open',
    CASE WHEN priority IS NOT NULL THEN priority ELSE 'normal' END,
    COALESCE(json_extract(metadata, '$.severity'), 'bug'),
    metadata, created_at, updated_at
  FROM messages WHERE type = 'issue';
--> statement-breakpoint

-- Step 4: Delete migrated rows from messages, then simplify
DELETE FROM messages WHERE type IN ('task', 'issue');
--> statement-breakpoint
-- Drop priority column (SQLite 3.35+)
ALTER TABLE messages DROP COLUMN priority;
```

- [ ] **Step 2: Mettre a jour les constantes**

Modify `packages/shared/src/constants.ts`:

```typescript
export const MESSAGE_TYPES = ['context', 'reminder'] as const;
export const MESSAGE_STATUSES = ['pending', 'done'] as const;
// Remove MESSAGE_PRIORITIES — no longer needed on messages

export const TASK_STATUSES = ['active', 'waiting', 'someday', 'done'] as const;
export const TASK_PRIORITIES = ['low', 'normal', 'high'] as const;

export const ISSUE_STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const;
export const ISSUE_PRIORITIES = ['low', 'normal', 'high', 'critical'] as const;
export const ISSUE_SEVERITIES = ['bug', 'regression', 'warning', 'enhancement'] as const;
```

- [ ] **Step 3: Mettre a jour le schema Drizzle**

Modify `packages/shared/src/db/schema.ts` — Simplifier `messages`, ajouter `tasks` et `issues`:

```typescript
// Simplified messages
export const messages = sqliteTable(
  'messages',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id),
    type: text('type', { enum: ['context', 'reminder'] }).notNull(),
    status: text('status', { enum: ['pending', 'done'] }).notNull().default('pending'),
    title: text('title').notNull(),
    content: text('content').notNull(),
    metadata: text('metadata').notNull().default('{}'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => ({
    projectStatusIdx: index('idx_messages_project_status').on(t.projectId, t.status),
    typeStatusIdx: index('idx_messages_type_status').on(t.type, t.status),
    createdAtIdx: index('idx_messages_created_at').on(t.createdAt),
  }),
);

// Tasks — project-scoped, ordered, subtask-capable
export const tasks = sqliteTable(
  'tasks',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    status: text('status', { enum: ['active', 'waiting', 'someday', 'done'] }).notNull().default('active'),
    priority: text('priority', { enum: ['low', 'normal', 'high'] }).notNull().default('normal'),
    position: integer('position').notNull().default(0),
    assignee: text('assignee'),
    tags: text('tags').notNull().default('[]'),
    dueDate: integer('due_date'),
    waitingOn: text('waiting_on'),
    completedAt: integer('completed_at'),
    parentId: text('parent_id').references(() => tasks.id),
    metadata: text('metadata').notNull().default('{}'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => ({
    projectStatusIdx: index('idx_tasks_project_status').on(t.projectId, t.status),
    parentIdx: index('idx_tasks_parent').on(t.parentId),
    statusPositionIdx: index('idx_tasks_status_position').on(t.status, t.position),
  }),
);

// Issues — project-scoped, severity-aware
export const issues = sqliteTable(
  'issues',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    status: text('status', { enum: ['open', 'in_progress', 'resolved', 'closed'] }).notNull().default('open'),
    priority: text('priority', { enum: ['low', 'normal', 'high', 'critical'] }).notNull().default('normal'),
    severity: text('severity', { enum: ['bug', 'regression', 'warning', 'enhancement'] }).notNull().default('bug'),
    assignee: text('assignee'),
    tags: text('tags').notNull().default('[]'),
    relatedTaskId: text('related_task_id').references(() => tasks.id),
    metadata: text('metadata').notNull().default('{}'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => ({
    projectStatusIdx: index('idx_issues_project_status').on(t.projectId, t.status),
    severityIdx: index('idx_issues_severity').on(t.severity),
  }),
);
```

- [ ] **Step 4: Verifier que le build compile**

Run: `cd /Users/recarnot/dev/agent-brain && pnpm typecheck`
Expected: PASS (shared package compiles)

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/constants.ts packages/shared/src/db/schema.ts packages/mcp/src/db/migrations/0002_tasks_issues.sql
git commit -m "feat(schema): add tasks + issues tables, simplify messages to context/reminder"
```

---

### Task 2: Schemas Zod et types

**Files:**
- Modify: `packages/shared/src/schemas.ts`
- Modify: `packages/shared/src/types.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Ajouter TaskSchema et IssueSchema dans schemas.ts**

Add after `MessageSchema` in `packages/shared/src/schemas.ts`:

```typescript
import { tasks, issues } from './db/schema.js';
import { TASK_STATUSES, TASK_PRIORITIES, ISSUE_STATUSES, ISSUE_PRIORITIES, ISSUE_SEVERITIES } from './constants.js';

// Simplify MessageMetadataSchema — remove severity/assignee (moved to issues/tasks)
export const MessageMetadataSchema = z.object({
  source: z.string().optional(),
  sourceProject: z.string().optional(),
}).passthrough();

export const TaskMetadataSchema = z.object({
  source: z.string().optional(),
  relatedNoteIds: z.array(z.string().uuid()).optional(),
}).passthrough();

export const TaskSchema = createSelectSchema(tasks).extend({
  tags: z.array(z.string().min(1).max(40)).max(20),
  metadata: TaskMetadataSchema,
});

export const IssueMetadataSchema = z.object({
  source: z.string().optional(),
  reporter: z.string().optional(),
  relatedNoteIds: z.array(z.string().uuid()).optional(),
}).passthrough();

export const IssueSchema = createSelectSchema(issues).extend({
  tags: z.array(z.string().min(1).max(40)).max(20),
  metadata: IssueMetadataSchema,
});
```

- [ ] **Step 2: Exporter les nouveaux types dans types.ts**

Add in `packages/shared/src/types.ts`:

```typescript
import { TaskSchema, IssueSchema, TaskMetadataSchema, IssueMetadataSchema } from './schemas.js';

export type Task = z.infer<typeof TaskSchema>;
export type Issue = z.infer<typeof IssueSchema>;
export type TaskMetadata = z.infer<typeof TaskMetadataSchema>;
export type IssueMetadata = z.infer<typeof IssueMetadataSchema>;
export type TaskStatus = Task['status'];
export type TaskPriority = Task['priority'];
export type IssueStatus = Issue['status'];
export type IssuePriority = Issue['priority'];
export type IssueSeverity = Issue['severity'];
```

- [ ] **Step 3: Re-exporter depuis index.ts**

Verify `packages/shared/src/index.ts` re-exports the new schemas, types, and constants. Add any missing exports:

```typescript
export { TaskSchema, IssueSchema, TaskMetadataSchema, IssueMetadataSchema } from './schemas.js';
export { TASK_STATUSES, TASK_PRIORITIES, ISSUE_STATUSES, ISSUE_PRIORITIES, ISSUE_SEVERITIES } from './constants.js';
```

- [ ] **Step 4: Typecheck**

Run: `cd /Users/recarnot/dev/agent-brain && pnpm typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/schemas.ts packages/shared/src/types.ts packages/shared/src/index.ts
git commit -m "feat(shared): add TaskSchema + IssueSchema, simplify MessageMetadataSchema"
```

---

### Task 3: Simplifier les tools messages

**Files:**
- Modify: `packages/mcp/src/tools/messages.ts`
- Modify: `packages/mcp/src/tools/contracts.ts`
- Test: `packages/mcp/src/tests/tools/messages.test.ts`

- [ ] **Step 1: Ecrire les tests mis a jour**

Update `packages/mcp/src/tests/tools/messages.test.ts`:
- Change all `type: 'issue'` → `type: 'context'` or `type: 'reminder'`
- Change all `type: 'task'` → `type: 'reminder'`
- Remove all `priority` assertions
- Change `status: 'ack'` → `status: 'done'`
- Remove `severity` from metadata tests
- Update contract test to use simplified MessageSchema

Key test changes:
```typescript
// creates a context message
messageCreate(db, {
  projectSlug: 'agent-brain',
  type: 'context',
  title: 'Session context',
  content: '## Context\nWorking on tasks feature',
});
// result.item.status === 'pending' (no priority field)

// creates a reminder
messageCreate(db, {
  projectSlug: 'agent-brain',
  type: 'reminder',
  title: 'Push branch',
  content: 'Push inter-session bus to main',
});

// update status only has pending/done
messageUpdate(db, { id, status: 'done' });

// rejects old types
expect(() =>
  messageCreate(db, { projectSlug: 'agent-brain', type: 'issue', title: 'X', content: 'X' }),
).toThrow();

expect(() =>
  messageCreate(db, { projectSlug: 'agent-brain', type: 'task', title: 'X', content: 'X' }),
).toThrow();
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/recarnot/dev/agent-brain && pnpm --filter @agent-brain/mcp test -- --run tests/tools/messages.test.ts`
Expected: FAIL (old enums still in place)

- [ ] **Step 3: Simplifier messages.ts**

In `packages/mcp/src/tools/messages.ts`:
- `MessageCreateInput`: Remove `priority`, change `type` to `z.enum(MESSAGE_TYPES)` (now context/reminder), remove `severity`/`assignee` from metadata
- `MessageUpdateInput`: Change `status` to `z.enum(MESSAGE_STATUSES)` (now pending/done), remove `severity`/`assignee` from metadata
- `messageCreate`: Remove `input.priority` from INSERT
- `RawMessageRow`: Remove `priority` field
- `toMessage`: Remove `priority` from return

- [ ] **Step 4: Update contracts.ts**

In `packages/mcp/src/tools/contracts.ts`, the `message_*` shapes already reference `MessageSchema` — they'll auto-adapt since MessageSchema is rebuilt from the Drizzle schema. No code change needed if `MessageSchema` in shared is updated correctly. Verify.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /Users/recarnot/dev/agent-brain && pnpm --filter @agent-brain/mcp test -- --run tests/tools/messages.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/mcp/src/tools/messages.ts packages/mcp/src/tools/contracts.ts packages/mcp/src/tests/tools/messages.test.ts
git commit -m "refactor(messages): simplify to context/reminder with pending/done status"
```

---

### Task 4: Tool handlers tasks

**Files:**
- Create: `packages/mcp/src/tools/tasks.ts`
- Test: `packages/mcp/src/tests/tools/tasks.test.ts`

- [ ] **Step 1: Ecrire les tests tasks**

Create `packages/mcp/src/tests/tools/tasks.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Database } from 'better-sqlite3';
import { freshDb } from '../_helpers/fresh-db.js';
import { projectCreate } from '../../tools/projects.js';
import { taskCreate, taskList, taskGet, taskUpdate, taskDelete, taskReorder } from '../../tools/tasks.js';

describe('task tools', () => {
  let db: Database;
  let close: () => void;

  beforeEach(() => {
    ({ db, close } = freshDb());
    projectCreate(db, { slug: 'agent-brain', name: 'Agent Brain' });
  });
  afterEach(() => close());

  describe('task_create', () => {
    it('creates a task with defaults', () => {
      const result = taskCreate(db, {
        projectSlug: 'agent-brain',
        title: 'Implement search',
      });
      expect(result.ok).toBe(true);
      expect(result.item.title).toBe('Implement search');
      expect(result.item.status).toBe('active');
      expect(result.item.priority).toBe('normal');
      expect(result.item.position).toBe(0);
      expect(result.item.tags).toEqual([]);
    });

    it('creates a task with all fields', () => {
      const result = taskCreate(db, {
        projectSlug: 'agent-brain',
        title: 'Fix bug',
        description: 'Details here',
        status: 'waiting',
        priority: 'high',
        assignee: 'romain',
        tags: ['urgent'],
        dueDate: 1712880000000,
        waitingOn: 'API team',
      });
      expect(result.item.status).toBe('waiting');
      expect(result.item.priority).toBe('high');
      expect(result.item.waitingOn).toBe('API team');
      expect(result.item.tags).toEqual(['urgent']);
    });

    it('creates a subtask', () => {
      const parent = taskCreate(db, { projectSlug: 'agent-brain', title: 'Parent' });
      const child = taskCreate(db, {
        projectSlug: 'agent-brain',
        title: 'Subtask',
        parentId: parent.id,
      });
      expect(child.item.parentId).toBe(parent.id);
    });

    it('throws on unknown project slug', () => {
      expect(() => taskCreate(db, { projectSlug: 'nope', title: 'X' })).toThrow(/project.*not found/i);
    });
  });

  describe('task_list', () => {
    it('lists tasks filtered by project', () => {
      taskCreate(db, { projectSlug: 'agent-brain', title: 'T1' });
      taskCreate(db, { projectSlug: 'agent-brain', title: 'T2' });
      const result = taskList(db, { projectSlug: 'agent-brain' });
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('filters by status', () => {
      taskCreate(db, { projectSlug: 'agent-brain', title: 'Active' });
      taskCreate(db, { projectSlug: 'agent-brain', title: 'Done', status: 'done' });
      const result = taskList(db, { projectSlug: 'agent-brain', status: 'active' });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].title).toBe('Active');
    });

    it('excludes subtasks by default', () => {
      const parent = taskCreate(db, { projectSlug: 'agent-brain', title: 'Parent' });
      taskCreate(db, { projectSlug: 'agent-brain', title: 'Child', parentId: parent.id });
      const result = taskList(db, { projectSlug: 'agent-brain' });
      expect(result.items).toHaveLength(1);
    });

    it('includes subtasks when parentId is given', () => {
      const parent = taskCreate(db, { projectSlug: 'agent-brain', title: 'Parent' });
      taskCreate(db, { projectSlug: 'agent-brain', title: 'Child', parentId: parent.id });
      const result = taskList(db, { projectSlug: 'agent-brain', parentId: parent.id });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].title).toBe('Child');
    });
  });

  describe('task_get', () => {
    it('returns task with subtasks', () => {
      const parent = taskCreate(db, { projectSlug: 'agent-brain', title: 'Parent' });
      taskCreate(db, { projectSlug: 'agent-brain', title: 'Sub1', parentId: parent.id });
      taskCreate(db, { projectSlug: 'agent-brain', title: 'Sub2', parentId: parent.id });
      const result = taskGet(db, { id: parent.id });
      expect(result.item.title).toBe('Parent');
      expect(result.subtasks).toHaveLength(2);
    });

    it('throws on not found', () => {
      expect(() => taskGet(db, { id: '00000000-0000-0000-0000-000000000099' })).toThrow(/not found/i);
    });
  });

  describe('task_update', () => {
    it('updates status and sets completedAt on done', () => {
      const { id } = taskCreate(db, { projectSlug: 'agent-brain', title: 'T' });
      const result = taskUpdate(db, { id, status: 'done' });
      expect(result.item.status).toBe('done');
      expect(result.item.completedAt).toBeGreaterThan(0);
    });

    it('clears completedAt when moving out of done', () => {
      const { id } = taskCreate(db, { projectSlug: 'agent-brain', title: 'T', status: 'done' });
      const result = taskUpdate(db, { id, status: 'active' });
      expect(result.item.completedAt).toBeNull();
    });
  });

  describe('task_delete', () => {
    it('deletes task and its subtasks', () => {
      const parent = taskCreate(db, { projectSlug: 'agent-brain', title: 'Parent' });
      taskCreate(db, { projectSlug: 'agent-brain', title: 'Child', parentId: parent.id });
      const result = taskDelete(db, { id: parent.id });
      expect(result.ok).toBe(true);
      expect(result.deletedCount).toBe(2);
    });
  });

  describe('task_reorder', () => {
    it('sets positions within a status group', () => {
      const t1 = taskCreate(db, { projectSlug: 'agent-brain', title: 'T1' });
      const t2 = taskCreate(db, { projectSlug: 'agent-brain', title: 'T2' });
      const t3 = taskCreate(db, { projectSlug: 'agent-brain', title: 'T3' });
      taskReorder(db, { ids: [t3.id, t1.id, t2.id] });
      const list = taskList(db, { projectSlug: 'agent-brain' });
      expect(list.items.map(t => t.title)).toEqual(['T3', 'T1', 'T2']);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/recarnot/dev/agent-brain && pnpm --filter @agent-brain/mcp test -- --run tests/tools/tasks.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implementer tasks.ts**

Create `packages/mcp/src/tools/tasks.ts` with:
- `resolveProjectSlug` (reuse from messages or extract to shared helper)
- `toTask(row)` — snake_case → camelCase mapper, JSON.parse tags + metadata
- `taskCreate(db, raw)` — INSERT avec auto-position (SELECT MAX(position) + 1)
- `taskList(db, raw)` — WHERE clauses pour projectSlug, status, priority, tags, parentId; ORDER BY position ASC
- `taskGet(db, raw)` — SELECT task + subtasks
- `taskUpdate(db, raw)` — Dynamic SET; auto-set `completedAt` on status='done', clear on other
- `taskDelete(db, raw)` — DELETE task + subtasks (WHERE id = ? OR parent_id = ?)
- `taskReorder(db, raw)` — UPDATE position for each id in array

Pattern: identical to `messages.ts` — Zod input schema, raw SQL via `db.prepare`, toTask mapper.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/recarnot/dev/agent-brain && pnpm --filter @agent-brain/mcp test -- --run tests/tools/tasks.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/mcp/src/tools/tasks.ts packages/mcp/src/tests/tools/tasks.test.ts
git commit -m "feat(tasks): add task CRUD + reorder tools with tests"
```

---

### Task 5: Tool handlers issues

**Files:**
- Create: `packages/mcp/src/tools/issues.ts`
- Test: `packages/mcp/src/tests/tools/issues.test.ts`

- [ ] **Step 1: Ecrire les tests issues**

Create `packages/mcp/src/tests/tools/issues.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Database } from 'better-sqlite3';
import { freshDb } from '../_helpers/fresh-db.js';
import { projectCreate } from '../../tools/projects.js';
import { taskCreate } from '../../tools/tasks.js';
import { issueCreate, issueList, issueGet, issueUpdate, issueClose } from '../../tools/issues.js';

describe('issue tools', () => {
  let db: Database;
  let close: () => void;

  beforeEach(() => {
    ({ db, close } = freshDb());
    projectCreate(db, { slug: 'agent-brain', name: 'Agent Brain' });
  });
  afterEach(() => close());

  describe('issue_create', () => {
    it('creates an issue with defaults', () => {
      const result = issueCreate(db, {
        projectSlug: 'agent-brain',
        title: 'FTS5 returns 0 results',
        description: 'Repro steps...',
      });
      expect(result.ok).toBe(true);
      expect(result.item.status).toBe('open');
      expect(result.item.priority).toBe('normal');
      expect(result.item.severity).toBe('bug');
    });

    it('accepts severity and priority', () => {
      const result = issueCreate(db, {
        projectSlug: 'agent-brain',
        title: 'Regression',
        description: 'x',
        severity: 'regression',
        priority: 'critical',
      });
      expect(result.item.severity).toBe('regression');
      expect(result.item.priority).toBe('critical');
    });
  });

  describe('issue_list', () => {
    it('filters by severity', () => {
      issueCreate(db, { projectSlug: 'agent-brain', title: 'Bug', description: 'x', severity: 'bug' });
      issueCreate(db, { projectSlug: 'agent-brain', title: 'Enhancement', description: 'x', severity: 'enhancement' });
      const result = issueList(db, { projectSlug: 'agent-brain', severity: 'bug' });
      expect(result.items).toHaveLength(1);
    });
  });

  describe('issue_get', () => {
    it('returns the issue', () => {
      const { id } = issueCreate(db, { projectSlug: 'agent-brain', title: 'Bug', description: 'x' });
      const result = issueGet(db, { id });
      expect(result.item.title).toBe('Bug');
    });
  });

  describe('issue_update', () => {
    it('updates status', () => {
      const { id } = issueCreate(db, { projectSlug: 'agent-brain', title: 'Bug', description: 'x' });
      const result = issueUpdate(db, { id, status: 'in_progress' });
      expect(result.item.status).toBe('in_progress');
    });

    it('links to a task', () => {
      const task = taskCreate(db, { projectSlug: 'agent-brain', title: 'Fix it' });
      const { id } = issueCreate(db, { projectSlug: 'agent-brain', title: 'Bug', description: 'x' });
      const result = issueUpdate(db, { id, relatedTaskId: task.id });
      expect(result.item.relatedTaskId).toBe(task.id);
    });
  });

  describe('issue_close', () => {
    it('sets status to closed', () => {
      const { id } = issueCreate(db, { projectSlug: 'agent-brain', title: 'Bug', description: 'x' });
      const result = issueClose(db, { id });
      expect(result.item.status).toBe('closed');
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/recarnot/dev/agent-brain && pnpm --filter @agent-brain/mcp test -- --run tests/tools/issues.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implementer issues.ts**

Create `packages/mcp/src/tools/issues.ts` with:
- `toIssue(row)` — snake_case → camelCase mapper
- `issueCreate(db, raw)` — INSERT with defaults
- `issueList(db, raw)` — WHERE projectSlug, status, severity, priority, tags; ORDER BY created_at DESC
- `issueGet(db, raw)` — SELECT by id
- `issueUpdate(db, raw)` — Dynamic SET (status, priority, severity, description, assignee, tags, relatedTaskId, metadata)
- `issueClose(db, raw)` — Shorthand: UPDATE status = 'closed'

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/recarnot/dev/agent-brain && pnpm --filter @agent-brain/mcp test -- --run tests/tools/issues.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/mcp/src/tools/issues.ts packages/mcp/src/tests/tools/issues.test.ts
git commit -m "feat(issues): add issue CRUD + close tools with tests"
```

---

### Task 6: Registration, contracts et integration

**Files:**
- Modify: `packages/mcp/src/tools/index.ts`
- Modify: `packages/mcp/src/tools/contracts.ts`
- Modify: `packages/mcp/src/tests/tools/register.test.ts`

- [ ] **Step 1: Mettre a jour register.test.ts**

In `packages/mcp/src/tests/tools/register.test.ts`:

```typescript
const EXPECTED_TOOLS = [
  'project_create', 'project_list', 'project_update', 'project_delete',
  'note_create', 'note_get', 'note_update', 'note_delete', 'note_list',
  'search',
  'backup_brain', 'get_stats',
  'message_create', 'message_list', 'message_update',
  'task_create', 'task_list', 'task_get', 'task_update', 'task_delete', 'task_reorder',
  'issue_create', 'issue_list', 'issue_get', 'issue_update', 'issue_close',
];

// Update count: 15 → 25
expect(toolNames).toHaveLength(25);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/recarnot/dev/agent-brain && pnpm --filter @agent-brain/mcp test -- --run tests/tools/register.test.ts`
Expected: FAIL (still 15 tools)

- [ ] **Step 3: Mettre a jour contracts.ts**

Add to `packages/mcp/src/tools/contracts.ts`:

```typescript
import { TaskSchema, IssueSchema } from '@agent-brain/shared';

// Add to RESPONSE_SHAPES:
task_create: MutationResponseSchema(TaskSchema),
task_list: z.object({
  items: z.array(TaskSchema),
  total: z.number().int().nonnegative(),
}),
task_get: z.object({
  item: TaskSchema,
  subtasks: z.array(TaskSchema),
}),
task_update: MutationResponseSchema(TaskSchema),
task_delete: z.object({
  ok: z.literal(true),
  id: z.string().uuid(),
  deletedCount: z.number().int(),
}),
task_reorder: z.object({ ok: z.literal(true) }),

issue_create: MutationResponseSchema(IssueSchema),
issue_list: z.object({
  items: z.array(IssueSchema),
  total: z.number().int().nonnegative(),
}),
issue_get: z.object({ item: IssueSchema }),
issue_update: MutationResponseSchema(IssueSchema),
issue_close: MutationResponseSchema(IssueSchema),
```

- [ ] **Step 4: Enregistrer les tools dans index.ts**

In `packages/mcp/src/tools/index.ts`, add imports and register:
- `task_create`, `task_list`, `task_get`, `task_update`, `task_delete`, `task_reorder`
- `issue_create`, `issue_list`, `issue_get`, `issue_update`, `issue_close`
- Update `message_create` enum from `['issue', 'context', 'task']` to `['context', 'reminder']`
- Update `message_list` type enum
- Update `message_update` status enum to `['pending', 'done']`
- Remove `priority` from `message_create`
- Remove `severity`/`assignee` from message metadata

- [ ] **Step 5: Run all tests**

Run: `cd /Users/recarnot/dev/agent-brain && pnpm test`
Expected: ALL PASS

- [ ] **Step 6: Typecheck**

Run: `cd /Users/recarnot/dev/agent-brain && pnpm typecheck`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/mcp/src/tools/index.ts packages/mcp/src/tools/contracts.ts packages/mcp/src/tests/tools/register.test.ts
git commit -m "feat(mcp): register task + issue tools, update message enums"
```

---

### Task 7: Mettre a jour le README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Mettre a jour la section MCP Tools**

Replace the Messages section and add Tasks + Issues sections in `README.md`:

```markdown
### Messages (Inter-session bus)

| Tool | Description | Parametres |
|------|-------------|------------|
| `message_create` | Creer un message inter-session | `projectSlug` (string), `type` (context\|reminder), `title` (string), `content` (string), `metadata?` |
| `message_list` | Lister les messages | `projectSlug?`, `type?` (context\|reminder), `status?` (pending\|done), `since?` (timestamp), `limit?` |
| `message_update` | Mettre a jour un message | `id` (string), `status?` (pending\|done), `content?`, `metadata?` |

### Tasks

| Tool | Description | Parametres |
|------|-------------|------------|
| `task_create` | Creer une tache | `projectSlug` (string), `title` (string), `description?`, `status?` (active\|waiting\|someday\|done), `priority?` (low\|normal\|high), `assignee?`, `tags?` (string[]), `dueDate?` (timestamp), `waitingOn?`, `parentId?` (UUID subtask) |
| `task_list` | Lister les taches | `projectSlug?`, `status?`, `priority?`, `tags_any?` (string[]), `parentId?` (UUID, filtre subtasks), `sort?`, `limit?`, `offset?` |
| `task_get` | Recuperer une tache + ses subtasks | `id` (string) |
| `task_update` | Mettre a jour une tache | `id` (string), `title?`, `description?`, `status?`, `priority?`, `assignee?`, `tags?`, `dueDate?`, `waitingOn?`, `metadata?` |
| `task_delete` | Supprimer une tache et ses subtasks | `id` (string) |
| `task_reorder` | Reordonner les taches | `ids` (string[]) — nouvelle ordre de position |

### Issues

| Tool | Description | Parametres |
|------|-------------|------------|
| `issue_create` | Creer une issue | `projectSlug` (string), `title` (string), `description?`, `severity?` (bug\|regression\|warning\|enhancement), `priority?` (low\|normal\|high\|critical), `assignee?`, `tags?` (string[]), `metadata?` |
| `issue_list` | Lister les issues | `projectSlug?`, `status?` (open\|in_progress\|resolved\|closed), `severity?`, `priority?`, `tags_any?` (string[]), `limit?`, `offset?` |
| `issue_get` | Recuperer une issue | `id` (string) |
| `issue_update` | Mettre a jour une issue | `id` (string), `title?`, `description?`, `status?`, `severity?`, `priority?`, `assignee?`, `tags?`, `relatedTaskId?`, `metadata?` |
| `issue_close` | Fermer une issue | `id` (string) |
```

- [ ] **Step 2: Build final**

Run: `cd /Users/recarnot/dev/agent-brain && pnpm build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: update MCP tools reference with tasks + issues"
```

---

### Summary

| # | Task | Tools added | Tests |
|---|------|------------|-------|
| 1 | Migration SQL + Drizzle schema | — | typecheck |
| 2 | Zod schemas + types | — | typecheck |
| 3 | Simplifier messages | 0 (modif) | messages.test.ts |
| 4 | Task handlers | 6 | tasks.test.ts |
| 5 | Issue handlers | 5 | issues.test.ts |
| 6 | Registration + contracts | — | register.test.ts + all |
| 7 | README | — | build |

**Total: 15 → 25 MCP tools** (10 nouveaux: 6 tasks + 5 issues, -1 priority sur messages)
