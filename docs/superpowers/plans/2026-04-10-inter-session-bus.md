# Inter-Session Bus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `messages` table and 3 MCP tools (`message_create`, `message_list`, `message_update`) that act as an async communication bus between Claude Code sessions, with a UI view for managing messages.

**Architecture:** Messages are a new entity routed by project (via `projectSlug` → `projectId`). No embeddings, no chunking, no FTS — pure CRUD. The spec explicitly excludes search, threading, TTL, and push notifications. Discovery is by polling (Claude Code startup hook).

**Tech Stack:** Drizzle ORM (schema), better-sqlite3 (queries), Zod (validation), Vitest (tests), React + TanStack Query (UI), Express 5 JSON-RPC (HTTP).

---

## Scope Check

The spec defines 3 plans (A: backend, B: hooks, C: UI). Plans A and C live in this repo. Plan B (hooks) lives in consumer projects — out of scope for this plan. This plan covers **Plan A + Plan C** only.

---

## File Structure

### Backend (packages/shared + packages/mcp)

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `packages/shared/src/db/schema.ts` | Add `messages` table definition |
| Modify | `packages/shared/src/constants.ts` | Add `MESSAGE_TYPES`, `MESSAGE_STATUSES`, `MESSAGE_PRIORITIES` |
| Modify | `packages/shared/src/schemas.ts` | Add `MessageSchema`, `MessageMetadataSchema` |
| Modify | `packages/shared/src/types.ts` | Export `Message`, `MessageMetadata` types |
| Modify | `packages/shared/src/index.ts` | Already barrel-exports everything, no change needed |
| Create | `packages/mcp/src/db/migrations/0001_inter_session_bus.sql` | CREATE TABLE + indexes |
| Create | `packages/mcp/src/tools/messages.ts` | `messageCreate`, `messageList`, `messageUpdate` handlers |
| Modify | `packages/mcp/src/tools/contracts.ts` | Add `message_*` RESPONSE_SHAPES |
| Modify | `packages/mcp/src/tools/index.ts` | Register 3 message tools |
| Create | `packages/mcp/src/tests/tools/messages.test.ts` | Test suite for all 3 tools |

### UI (packages/ui)

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `packages/ui/src/api/tools/messages.ts` | MCP client wrappers for message_* |
| Create | `packages/ui/src/api/hooks/use-messages.ts` | React Query hooks |
| Create | `packages/ui/src/pages/messages.tsx` | Main messages page (list + detail) |
| Create | `packages/ui/src/components/message-card.tsx` | Message list item |
| Create | `packages/ui/src/components/message-detail.tsx` | Message detail panel |
| Create | `packages/ui/src/components/message-type-badge.tsx` | Type badge (issue/context/task) |
| Create | `packages/ui/src/components/message-priority-badge.tsx` | Priority badge (low/normal/high) |
| Create | `packages/ui/src/components/message-status-badge.tsx` | Status badge (pending/ack/done/dismissed) |
| Modify | `packages/ui/src/app.tsx` | Add `/messages` route |
| Modify | `packages/ui/src/components/sidebar.tsx` | Add Messages nav link with pending badge |

---

## Task 1: Shared Schema & Constants

**Files:**
- Modify: `packages/shared/src/constants.ts`
- Modify: `packages/shared/src/db/schema.ts`
- Modify: `packages/shared/src/schemas.ts`
- Modify: `packages/shared/src/types.ts`

- [ ] **Step 1: Add message constants to `constants.ts`**

Add at the end of `packages/shared/src/constants.ts`:

```typescript
export const MESSAGE_TYPES = ['issue', 'context', 'task'] as const;
export const MESSAGE_STATUSES = ['pending', 'ack', 'done', 'dismissed'] as const;
export const MESSAGE_PRIORITIES = ['low', 'normal', 'high'] as const;
```

- [ ] **Step 2: Add `messages` table to `schema.ts`**

Add at the end of `packages/shared/src/db/schema.ts`, before the closing of the file:

```typescript
export const messages = sqliteTable(
  'messages',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id),
    type: text('type', { enum: ['issue', 'context', 'task'] }).notNull(),
    status: text('status', { enum: ['pending', 'ack', 'done', 'dismissed'] }).notNull().default('pending'),
    priority: text('priority', { enum: ['low', 'normal', 'high'] }).notNull().default('normal'),
    title: text('title').notNull(),
    content: text('content').notNull(),
    metadata: text('metadata').notNull().default('{}'), // JSON string
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => ({
    projectStatusIdx: index('idx_messages_project_status').on(t.projectId, t.status),
    typeStatusIdx: index('idx_messages_type_status').on(t.type, t.status),
    createdAtIdx: index('idx_messages_created_at').on(t.createdAt),
  }),
);
```

- [ ] **Step 3: Add `MessageSchema` and `MessageMetadataSchema` to `schemas.ts`**

Add import of `messages` from the schema, and add the `MESSAGE_TYPES`, `MESSAGE_STATUSES`, `MESSAGE_PRIORITIES` constants import. Then add the schemas:

At top of `packages/shared/src/schemas.ts`, update imports:

```typescript
import { projects, notes, chunks, messages } from './db/schema.js';
import { KINDS, STATUSES, SOURCES, SEARCH_MODES, MESSAGE_TYPES, MESSAGE_STATUSES, MESSAGE_PRIORITIES } from './constants.js';
```

Then add after `ChunkSchema`:

```typescript
export const MessageMetadataSchema = z.object({
  severity: z.enum(['bug', 'regression', 'warning']).optional(),
  assignee: z.string().optional(),
  source: z.string().optional(),
  sourceProject: z.string().optional(),
  relatedNoteIds: z.array(z.string().uuid()).optional(),
}).passthrough();

export const MessageSchema = createSelectSchema(messages).extend({
  metadata: MessageMetadataSchema,
});
```

- [ ] **Step 4: Export `Message` and `MessageMetadata` types in `types.ts`**

Add to `packages/shared/src/types.ts`:

```typescript
import { ProjectSchema, NoteSchema, ChunkSchema, SearchHitSchema, StatsSchema, MessageSchema, MessageMetadataSchema } from './schemas.js';
```

And add:

```typescript
export type Message = z.infer<typeof MessageSchema>;
export type MessageMetadata = z.infer<typeof MessageMetadataSchema>;
export type MessageType = Message['type'];
export type MessageStatus = Message['status'];
export type MessagePriority = Message['priority'];
```

- [ ] **Step 5: Verify typecheck passes**

Run: `pnpm --filter @agent-brain/shared typecheck`
Expected: PASS (0 errors)

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/constants.ts packages/shared/src/db/schema.ts packages/shared/src/schemas.ts packages/shared/src/types.ts
git commit -m "feat(shared): add messages table schema, types, and constants for inter-session bus"
```

---

## Task 2: Migration SQL

**Files:**
- Create: `packages/mcp/src/db/migrations/0001_inter_session_bus.sql`

- [ ] **Step 1: Generate the migration file**

Run Drizzle to generate the migration:

```bash
cd /Users/recarnot/dev/agent-brain && pnpm --filter @agent-brain/mcp drizzle-kit generate
```

This should produce a new `.sql` file in `packages/mcp/src/db/migrations/`. Verify it contains the `CREATE TABLE messages` and the 3 indexes.

If `drizzle-kit generate` is not configured, create the file manually as `packages/mcp/src/db/migrations/0001_inter_session_bus.sql`:

```sql
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL REFERENCES `projects`(`id`),
	`type` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`priority` text DEFAULT 'normal' NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`metadata` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_messages_project_status` ON `messages` (`project_id`,`status`);
--> statement-breakpoint
CREATE INDEX `idx_messages_type_status` ON `messages` (`type`,`status`);
--> statement-breakpoint
CREATE INDEX `idx_messages_created_at` ON `messages` (`created_at`);
```

Note: The `migrate.ts` file splits on `--> statement-breakpoint` and runs each statement individually.

- [ ] **Step 2: Verify migration applies**

Run tests (which use `freshDb()` → `applyMigrations()`):

```bash
pnpm --filter @agent-brain/mcp test -- --run src/tests/tools/projects.test.ts
```

Expected: PASS (existing tests still work, migration applied without errors)

- [ ] **Step 3: Commit**

```bash
git add packages/mcp/src/db/migrations/0001_inter_session_bus.sql
git commit -m "feat(mcp): add migration for messages table"
```

---

## Task 3: Message Tool Handlers — `messageCreate`

**Files:**
- Create: `packages/mcp/src/tools/messages.ts`

- [ ] **Step 1: Write the failing test for `messageCreate`**

Create `packages/mcp/src/tests/tools/messages.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Database } from 'better-sqlite3';
import { freshDb } from '../_helpers/fresh-db.js';
import { projectCreate } from '../../tools/projects.js';
import { messageCreate } from '../../tools/messages.js';

describe('message tools', () => {
  let db: Database;
  let close: () => void;
  let projectId: string;

  beforeEach(() => {
    ({ db, close } = freshDb());
    // Create a target project
    const proj = projectCreate(db, { slug: 'agent-brain', name: 'Agent Brain' });
    projectId = proj.id;
  });
  afterEach(() => close());

  describe('message_create', () => {
    it('creates a message and returns it', () => {
      const result = messageCreate(db, {
        projectSlug: 'agent-brain',
        type: 'issue',
        title: 'FTS5 fulltext retourne 0 résultats',
        content: '## Repro\n1. search → 0 hits',
      });

      expect(result.ok).toBe(true);
      expect(result.id).toBeDefined();
      expect(result.item.type).toBe('issue');
      expect(result.item.status).toBe('pending');
      expect(result.item.priority).toBe('normal');
      expect(result.item.title).toBe('FTS5 fulltext retourne 0 résultats');
      expect(result.item.projectId).toBe(projectId);
    });

    it('accepts optional priority and metadata', () => {
      const result = messageCreate(db, {
        projectSlug: 'agent-brain',
        type: 'issue',
        title: 'High prio bug',
        content: 'details',
        priority: 'high',
        metadata: { severity: 'bug', sourceProject: 'cruchot' },
      });

      expect(result.item.priority).toBe('high');
      expect(result.item.metadata.severity).toBe('bug');
      expect(result.item.metadata.sourceProject).toBe('cruchot');
    });

    it('throws on unknown project slug', () => {
      expect(() =>
        messageCreate(db, {
          projectSlug: 'nonexistent',
          type: 'issue',
          title: 'Test',
          content: 'Test',
        }),
      ).toThrow(/project.*not found/i);
    });

    it('rejects invalid type', () => {
      expect(() =>
        messageCreate(db, {
          projectSlug: 'agent-brain',
          type: 'invalid' as any,
          title: 'Test',
          content: 'Test',
        }),
      ).toThrow();
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @agent-brain/mcp test -- --run src/tests/tools/messages.test.ts`
Expected: FAIL — `Cannot find module '../../tools/messages.js'`

- [ ] **Step 3: Write `messageCreate` implementation**

Create `packages/mcp/src/tools/messages.ts`:

```typescript
import type { Database } from 'better-sqlite3';
import { z } from 'zod';
import { MESSAGE_TYPES, MESSAGE_STATUSES, MESSAGE_PRIORITIES } from '@agent-brain/shared';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const MessageCreateInput = z.object({
  projectSlug: z.string().min(1).max(64),
  type: z.enum(MESSAGE_TYPES),
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(1_000_000),
  priority: z.enum(MESSAGE_PRIORITIES).optional().default('normal'),
  metadata: z
    .object({
      severity: z.enum(['bug', 'regression', 'warning']).optional(),
      assignee: z.string().optional(),
      source: z.string().optional(),
      sourceProject: z.string().optional(),
      relatedNoteIds: z.array(z.string().uuid()).optional(),
    })
    .passthrough()
    .optional()
    .default({}),
});

// ---------------------------------------------------------------------------
// Helpers — map raw SQLite rows to camelCase (gotcha 3)
// ---------------------------------------------------------------------------

interface RawMessageRow {
  id: string;
  project_id: string;
  type: string;
  status: string;
  priority: string;
  title: string;
  content: string;
  metadata: string;
  created_at: number;
  updated_at: number;
}

function toMessage(row: RawMessageRow) {
  return {
    id: row.id,
    projectId: row.project_id,
    type: row.type,
    status: row.status,
    priority: row.priority,
    title: row.title,
    content: row.content,
    metadata: JSON.parse(row.metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function resolveProjectSlug(db: Database, slug: string): string {
  const row = db
    .prepare('SELECT id FROM projects WHERE slug = ?')
    .get(slug) as { id: string } | undefined;
  if (!row) {
    throw new Error(`Project not found: slug="${slug}"`);
  }
  return row.id;
}

// ---------------------------------------------------------------------------
// messageCreate
// ---------------------------------------------------------------------------

export function messageCreate(db: Database, raw: unknown) {
  const input = MessageCreateInput.parse(raw);
  const projectId = resolveProjectSlug(db, input.projectSlug);
  const id = crypto.randomUUID();
  const now = Date.now();

  db.prepare(
    `INSERT INTO messages (id, project_id, type, status, priority, title, content, metadata, created_at, updated_at)
     VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    projectId,
    input.type,
    input.priority,
    input.title,
    input.content,
    JSON.stringify(input.metadata),
    now,
    now,
  );

  const row = db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as RawMessageRow;
  return { ok: true as const, id, item: toMessage(row) };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @agent-brain/mcp test -- --run src/tests/tools/messages.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/mcp/src/tools/messages.ts packages/mcp/src/tests/tools/messages.test.ts
git commit -m "feat(mcp): add messageCreate tool with tests"
```

---

## Task 4: Message Tool Handlers — `messageList`

**Files:**
- Modify: `packages/mcp/src/tools/messages.ts`
- Modify: `packages/mcp/src/tests/tools/messages.test.ts`

- [ ] **Step 1: Write the failing tests for `messageList`**

Add to `packages/mcp/src/tests/tools/messages.test.ts`, inside the outer `describe` block:

```typescript
import { messageCreate, messageList } from '../../tools/messages.js';
```

(Update the existing import to include `messageList`.)

Then add:

```typescript
  describe('message_list', () => {
    it('returns all messages when no filters', () => {
      messageCreate(db, {
        projectSlug: 'agent-brain',
        type: 'issue',
        title: 'Bug 1',
        content: 'details',
      });
      messageCreate(db, {
        projectSlug: 'agent-brain',
        type: 'task',
        title: 'Task 1',
        content: 'details',
      });

      const result = messageList(db, {});
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.pendingCount).toBe(2);
    });

    it('filters by projectSlug', () => {
      projectCreate(db, { slug: 'cruchot', name: 'Cruchot' });
      messageCreate(db, {
        projectSlug: 'agent-brain',
        type: 'issue',
        title: 'AB issue',
        content: 'x',
      });
      messageCreate(db, {
        projectSlug: 'cruchot',
        type: 'task',
        title: 'Cruchot task',
        content: 'x',
      });

      const result = messageList(db, { projectSlug: 'agent-brain' });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].title).toBe('AB issue');
      // pendingCount scoped to project
      expect(result.pendingCount).toBe(1);
    });

    it('filters by type and status', () => {
      messageCreate(db, {
        projectSlug: 'agent-brain',
        type: 'issue',
        title: 'Issue',
        content: 'x',
      });
      messageCreate(db, {
        projectSlug: 'agent-brain',
        type: 'task',
        title: 'Task',
        content: 'x',
      });

      const result = messageList(db, { type: 'issue' });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].type).toBe('issue');
    });

    it('filters by since timestamp', () => {
      const before = Date.now();
      messageCreate(db, {
        projectSlug: 'agent-brain',
        type: 'issue',
        title: 'Old',
        content: 'x',
      });
      const after = Date.now() + 1;
      // Messages created before `after` — since=after should return 0
      const result = messageList(db, { since: after });
      expect(result.items).toHaveLength(0);
    });

    it('respects limit', () => {
      for (let i = 0; i < 5; i++) {
        messageCreate(db, {
          projectSlug: 'agent-brain',
          type: 'issue',
          title: `Bug ${i}`,
          content: 'x',
        });
      }

      const result = messageList(db, { limit: 2 });
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(5);
    });

    it('returns items sorted by createdAt DESC', () => {
      messageCreate(db, {
        projectSlug: 'agent-brain',
        type: 'issue',
        title: 'First',
        content: 'x',
      });
      messageCreate(db, {
        projectSlug: 'agent-brain',
        type: 'issue',
        title: 'Second',
        content: 'x',
      });

      const result = messageList(db, {});
      expect(result.items[0].title).toBe('Second');
      expect(result.items[1].title).toBe('First');
    });
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @agent-brain/mcp test -- --run src/tests/tools/messages.test.ts`
Expected: FAIL — `messageList is not a function`

- [ ] **Step 3: Implement `messageList`**

Add to `packages/mcp/src/tools/messages.ts`:

```typescript
const MessageListInput = z.object({
  projectSlug: z.string().min(1).max(64).optional(),
  type: z.enum(MESSAGE_TYPES).optional(),
  status: z.enum(MESSAGE_STATUSES).optional(),
  since: z.number().int().nonnegative().optional(),
  limit: z.number().int().min(1).max(200).optional().default(50),
});

export function messageList(db: Database, raw: unknown) {
  const input = MessageListInput.parse(raw);

  // Resolve projectSlug to projectId if provided
  let projectId: string | undefined;
  if (input.projectSlug) {
    projectId = resolveProjectSlug(db, input.projectSlug);
  }

  // Build WHERE clauses
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (projectId) {
    clauses.push('project_id = ?');
    params.push(projectId);
  }
  if (input.type) {
    clauses.push('type = ?');
    params.push(input.type);
  }
  if (input.status) {
    clauses.push('status = ?');
    params.push(input.status);
  }
  if (input.since !== undefined) {
    clauses.push('created_at > ?');
    params.push(input.since);
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';

  // Fetch items
  const rows = db
    .prepare(`SELECT * FROM messages ${where} ORDER BY created_at DESC LIMIT ?`)
    .all(...params, input.limit) as RawMessageRow[];

  // Total count (with same filters)
  const total = (
    db.prepare(`SELECT COUNT(*) as c FROM messages ${where}`).get(...params) as { c: number }
  ).c;

  // Pending count — scoped to projectId if provided, otherwise global
  let pendingWhere = "status = 'pending'";
  const pendingParams: unknown[] = [];
  if (projectId) {
    pendingWhere += ' AND project_id = ?';
    pendingParams.push(projectId);
  }
  const pendingCount = (
    db.prepare(`SELECT COUNT(*) as c FROM messages WHERE ${pendingWhere}`).get(...pendingParams) as { c: number }
  ).c;

  return {
    items: rows.map(toMessage),
    total,
    pendingCount,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @agent-brain/mcp test -- --run src/tests/tools/messages.test.ts`
Expected: PASS (all tests)

- [ ] **Step 5: Commit**

```bash
git add packages/mcp/src/tools/messages.ts packages/mcp/src/tests/tools/messages.test.ts
git commit -m "feat(mcp): add messageList tool with filters and pendingCount"
```

---

## Task 5: Message Tool Handlers — `messageUpdate`

**Files:**
- Modify: `packages/mcp/src/tools/messages.ts`
- Modify: `packages/mcp/src/tests/tools/messages.test.ts`

- [ ] **Step 1: Write the failing tests for `messageUpdate`**

Update the import in `packages/mcp/src/tests/tools/messages.test.ts`:

```typescript
import { messageCreate, messageList, messageUpdate } from '../../tools/messages.js';
```

Add inside the outer `describe`:

```typescript
  describe('message_update', () => {
    it('updates status', () => {
      const { id } = messageCreate(db, {
        projectSlug: 'agent-brain',
        type: 'issue',
        title: 'Bug',
        content: 'x',
      });

      const result = messageUpdate(db, { id, status: 'ack' });
      expect(result.ok).toBe(true);
      expect(result.item.status).toBe('ack');
      expect(result.item.updatedAt).toBeGreaterThanOrEqual(result.item.createdAt);
    });

    it('updates content', () => {
      const { id } = messageCreate(db, {
        projectSlug: 'agent-brain',
        type: 'issue',
        title: 'Bug',
        content: 'original',
      });

      const result = messageUpdate(db, { id, content: 'replaced content' });
      expect(result.item.content).toBe('replaced content');
    });

    it('merges metadata without overwriting existing keys', () => {
      const { id } = messageCreate(db, {
        projectSlug: 'agent-brain',
        type: 'issue',
        title: 'Bug',
        content: 'x',
        metadata: { severity: 'bug', sourceProject: 'cruchot' },
      });

      const result = messageUpdate(db, {
        id,
        metadata: { assignee: 'agent-brain' },
      });

      expect(result.item.metadata.severity).toBe('bug');
      expect(result.item.metadata.sourceProject).toBe('cruchot');
      expect(result.item.metadata.assignee).toBe('agent-brain');
    });

    it('throws on nonexistent message id', () => {
      expect(() =>
        messageUpdate(db, {
          id: '00000000-0000-0000-0000-000000000001',
          status: 'done',
        }),
      ).toThrow(/not found/i);
    });

    it('rejects invalid status', () => {
      const { id } = messageCreate(db, {
        projectSlug: 'agent-brain',
        type: 'issue',
        title: 'Bug',
        content: 'x',
      });

      expect(() =>
        messageUpdate(db, { id, status: 'invalid' as any }),
      ).toThrow();
    });
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @agent-brain/mcp test -- --run src/tests/tools/messages.test.ts`
Expected: FAIL — `messageUpdate is not a function`

- [ ] **Step 3: Implement `messageUpdate`**

Add to `packages/mcp/src/tools/messages.ts`:

```typescript
const MessageUpdateInput = z.object({
  id: z.string().uuid(),
  status: z.enum(MESSAGE_STATUSES).optional(),
  content: z.string().min(1).max(1_000_000).optional(),
  metadata: z
    .object({
      severity: z.enum(['bug', 'regression', 'warning']).optional(),
      assignee: z.string().optional(),
      source: z.string().optional(),
      sourceProject: z.string().optional(),
      relatedNoteIds: z.array(z.string().uuid()).optional(),
    })
    .passthrough()
    .optional(),
});

export function messageUpdate(db: Database, raw: unknown) {
  const input = MessageUpdateInput.parse(raw);
  const { id } = input;

  // Verify message exists
  const existing = db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as RawMessageRow | undefined;
  if (!existing) {
    throw new Error(`Message not found: id="${id}"`);
  }

  const setClauses: string[] = [];
  const values: unknown[] = [];

  if (input.status !== undefined) {
    setClauses.push('status = ?');
    values.push(input.status);
  }
  if (input.content !== undefined) {
    setClauses.push('content = ?');
    values.push(input.content);
  }
  if (input.metadata !== undefined) {
    // Merge: existing keys preserved, new keys added/overwritten
    const existingMeta = JSON.parse(existing.metadata);
    const merged = { ...existingMeta, ...input.metadata };
    setClauses.push('metadata = ?');
    values.push(JSON.stringify(merged));
  }

  if (setClauses.length > 0) {
    const now = Date.now();
    setClauses.push('updated_at = ?');
    values.push(now);
    values.push(id);

    db.prepare(
      `UPDATE messages SET ${setClauses.join(', ')} WHERE id = ?`,
    ).run(...values);
  }

  const row = db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as RawMessageRow;
  return { ok: true as const, id, item: toMessage(row) };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @agent-brain/mcp test -- --run src/tests/tools/messages.test.ts`
Expected: PASS (all tests)

- [ ] **Step 5: Commit**

```bash
git add packages/mcp/src/tools/messages.ts packages/mcp/src/tests/tools/messages.test.ts
git commit -m "feat(mcp): add messageUpdate tool with metadata merge"
```

---

## Task 6: Tool Registration & Contracts

**Files:**
- Modify: `packages/mcp/src/tools/index.ts`
- Modify: `packages/mcp/src/tools/contracts.ts`

- [ ] **Step 1: Write the failing contract test**

Add to the test file `packages/mcp/src/tests/tools/messages.test.ts` at the end of the outer `describe`:

```typescript
  describe('contracts', () => {
    it('messageCreate return shape matches MutationResponseSchema', () => {
      const { MutationResponseSchema, MessageSchema } = await import('@agent-brain/shared');
      const schema = MutationResponseSchema(MessageSchema);

      const result = messageCreate(db, {
        projectSlug: 'agent-brain',
        type: 'issue',
        title: 'Test',
        content: 'x',
      });

      expect(() => schema.parse(result)).not.toThrow();
    });
  });
```

Wait — the test file uses synchronous imports. Let's make the contract test simpler by importing at the top:

Actually, add this import at the top of the test file:

```typescript
import { MutationResponseSchema, MessageSchema } from '@agent-brain/shared';
```

And add the contract test:

```typescript
  describe('contracts', () => {
    it('messageCreate return matches MutationResponseSchema(MessageSchema)', () => {
      const schema = MutationResponseSchema(MessageSchema);

      const result = messageCreate(db, {
        projectSlug: 'agent-brain',
        type: 'issue',
        title: 'Contract test',
        content: 'x',
      });

      expect(() => schema.parse(result)).not.toThrow();
    });
  });
```

- [ ] **Step 2: Run to verify it passes (schema already defined)**

Run: `pnpm --filter @agent-brain/mcp test -- --run src/tests/tools/messages.test.ts`
Expected: PASS

- [ ] **Step 3: Add RESPONSE_SHAPES entries to `contracts.ts`**

Update `packages/mcp/src/tools/contracts.ts`:

Add to the imports:

```typescript
import {
  ProjectSchema,
  ListResponseSchema,
  MutationResponseSchema,
  MessageSchema,
} from '@agent-brain/shared';
```

Note: `ListResponseSchema` for messages has a different shape (no `limit`/`offset`, has `pendingCount`). We'll define a custom schema for it. Actually, the spec says the list response is `{ items, total, pendingCount }` — not the standard `ListResponseSchema`. So add a custom one:

```typescript
import { z } from 'zod';
```

Add to `RESPONSE_SHAPES`:

```typescript
  message_create: MutationResponseSchema(MessageSchema),
  message_list: z.object({
    items: z.array(MessageSchema),
    total: z.number().int().nonnegative(),
    pendingCount: z.number().int().nonnegative(),
  }),
  message_update: MutationResponseSchema(MessageSchema),
```

- [ ] **Step 4: Register 3 message tools in `index.ts`**

Update `packages/mcp/src/tools/index.ts`:

Add import:

```typescript
import { messageCreate, messageList, messageUpdate } from './messages.js';
```

Add inside `registerAllTools`, after the maintenance tools:

```typescript
  // Message tools (inter-session bus)
  server.tool(
    'message_create',
    'Create an inter-session message (issue, context, or task) targeting a project',
    {
      projectSlug: z.string(),
      type: z.enum(['issue', 'context', 'task']),
      title: z.string(),
      content: z.string(),
      priority: z.enum(['low', 'normal', 'high']).optional(),
      metadata: z
        .object({
          severity: z.enum(['bug', 'regression', 'warning']).optional(),
          assignee: z.string().optional(),
          source: z.string().optional(),
          sourceProject: z.string().optional(),
          relatedNoteIds: z.array(z.string()).optional(),
        })
        .passthrough()
        .optional(),
    },
    async (params) => {
      const result = messageCreate(db, params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  server.tool(
    'message_list',
    'List inter-session messages with optional filters',
    {
      projectSlug: z.string().optional(),
      type: z.enum(['issue', 'context', 'task']).optional(),
      status: z.enum(['pending', 'ack', 'done', 'dismissed']).optional(),
      since: z.number().optional(),
      limit: z.number().optional(),
    },
    async (params) => {
      const result = messageList(db, params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  server.tool(
    'message_update',
    'Update an inter-session message (status, content, or metadata)',
    {
      id: z.string(),
      status: z.enum(['pending', 'ack', 'done', 'dismissed']).optional(),
      content: z.string().optional(),
      metadata: z
        .object({
          severity: z.enum(['bug', 'regression', 'warning']).optional(),
          assignee: z.string().optional(),
          source: z.string().optional(),
          sourceProject: z.string().optional(),
          relatedNoteIds: z.array(z.string()).optional(),
        })
        .passthrough()
        .optional(),
    },
    async (params) => {
      const result = messageUpdate(db, params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );
```

- [ ] **Step 5: Run full test suite**

Run: `pnpm test`
Expected: ALL PASS

- [ ] **Step 6: Run typecheck**

Run: `pnpm typecheck`
Expected: 0 errors

- [ ] **Step 7: Commit**

```bash
git add packages/mcp/src/tools/index.ts packages/mcp/src/tools/contracts.ts packages/mcp/src/tests/tools/messages.test.ts
git commit -m "feat(mcp): register message_create, message_list, message_update tools"
```

---

## Task 7: UI — API Layer (tools + hooks)

**Files:**
- Create: `packages/ui/src/api/tools/messages.ts`
- Create: `packages/ui/src/api/hooks/use-messages.ts`

- [ ] **Step 1: Create API tools wrapper**

Create `packages/ui/src/api/tools/messages.ts`:

```typescript
import { mcpCall } from '../mcp-client.js';
import type { Message, MessageMetadata } from '@agent-brain/shared';

export interface MessageListResponse {
  items: Message[];
  total: number;
  pendingCount: number;
}

export interface MessageMutationResponse {
  ok: true;
  id: string;
  item: Message;
}

export function listMessages(params: {
  projectSlug?: string;
  type?: string;
  status?: string;
  since?: number;
  limit?: number;
} = {}) {
  return mcpCall<MessageListResponse>('message_list', params);
}

export function createMessage(params: {
  projectSlug: string;
  type: 'issue' | 'context' | 'task';
  title: string;
  content: string;
  priority?: 'low' | 'normal' | 'high';
  metadata?: Partial<MessageMetadata>;
}) {
  return mcpCall<MessageMutationResponse>('message_create', params);
}

export function updateMessage(params: {
  id: string;
  status?: 'pending' | 'ack' | 'done' | 'dismissed';
  content?: string;
  metadata?: Partial<MessageMetadata>;
}) {
  return mcpCall<MessageMutationResponse>('message_update', params);
}
```

- [ ] **Step 2: Create React Query hooks**

Create `packages/ui/src/api/hooks/use-messages.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listMessages, createMessage, updateMessage } from '../tools/messages.js';

export function useMessages(params: {
  projectSlug?: string;
  type?: string;
  status?: string;
  since?: number;
  limit?: number;
} = {}) {
  return useQuery({
    queryKey: ['messages', params],
    queryFn: () => listMessages(params),
    refetchOnWindowFocus: true,
  });
}

export function usePendingCount(projectSlug?: string) {
  return useQuery({
    queryKey: ['messages', 'pending-count', projectSlug],
    queryFn: () => listMessages({ projectSlug, status: 'pending', limit: 1 }),
    select: (data) => data.pendingCount,
    refetchInterval: 30_000, // Poll every 30s for badge updates
  });
}

export function useCreateMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createMessage,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['messages'] }),
  });
}

export function useUpdateMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateMessage,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['messages'] }),
  });
}
```

- [ ] **Step 3: Verify typecheck**

Run: `pnpm typecheck`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/api/tools/messages.ts packages/ui/src/api/hooks/use-messages.ts
git commit -m "feat(ui): add message API tools and React Query hooks"
```

---

## Task 8: UI — Badge Components

**Files:**
- Create: `packages/ui/src/components/message-type-badge.tsx`
- Create: `packages/ui/src/components/message-priority-badge.tsx`
- Create: `packages/ui/src/components/message-status-badge.tsx`

- [ ] **Step 1: Create message-type-badge.tsx**

Create `packages/ui/src/components/message-type-badge.tsx`:

```tsx
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Info, ArrowRight } from 'lucide-react';

const TYPE_CONFIG = {
  issue: { label: 'Issue', icon: AlertCircle, variant: 'destructive' as const },
  context: { label: 'Context', icon: Info, variant: 'secondary' as const },
  task: { label: 'Task', icon: ArrowRight, variant: 'outline' as const },
} as const;

export function MessageTypeBadge({ type }: { type: string }) {
  const config = TYPE_CONFIG[type as keyof typeof TYPE_CONFIG];
  if (!config) return null;
  const Icon = config.icon;
  return (
    <Badge variant={config.variant} className="gap-1">
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}
```

- [ ] **Step 2: Create message-priority-badge.tsx**

Create `packages/ui/src/components/message-priority-badge.tsx`:

```tsx
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const PRIORITY_STYLES = {
  high: 'bg-red-500/15 text-red-400 border-red-500/30',
  normal: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
  low: 'bg-zinc-700/15 text-zinc-500 border-zinc-700/30',
} as const;

export function MessagePriorityBadge({ priority }: { priority: string }) {
  const style = PRIORITY_STYLES[priority as keyof typeof PRIORITY_STYLES];
  if (!style) return null;
  if (priority === 'normal') return null; // Don't show badge for default
  return (
    <Badge variant="outline" className={cn('text-xs', style)}>
      {priority}
    </Badge>
  );
}
```

- [ ] **Step 3: Create message-status-badge.tsx**

Create `packages/ui/src/components/message-status-badge.tsx`:

```tsx
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const STATUS_STYLES = {
  pending: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  ack: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  done: 'bg-green-500/15 text-green-400 border-green-500/30',
  dismissed: 'bg-zinc-700/15 text-zinc-500 border-zinc-700/30',
} as const;

export function MessageStatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status as keyof typeof STATUS_STYLES];
  if (!style) return null;
  return (
    <Badge variant="outline" className={cn('text-xs', style)}>
      {status}
    </Badge>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/components/message-type-badge.tsx packages/ui/src/components/message-priority-badge.tsx packages/ui/src/components/message-status-badge.tsx
git commit -m "feat(ui): add message badge components (type, priority, status)"
```

---

## Task 9: UI — MessageCard Component

**Files:**
- Create: `packages/ui/src/components/message-card.tsx`

- [ ] **Step 1: Create message-card.tsx**

Create `packages/ui/src/components/message-card.tsx`:

```tsx
import type { Message } from '@agent-brain/shared';
import { MessageTypeBadge } from './message-type-badge';
import { MessagePriorityBadge } from './message-priority-badge';
import { MessageStatusBadge } from './message-status-badge';
import { cn } from '@/lib/utils';

function timeAgo(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface MessageCardProps {
  message: Message;
  selected?: boolean;
  onClick?: () => void;
}

export function MessageCard({ message, selected, onClick }: MessageCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-lg border border-border p-3 transition-colors hover:bg-muted/50',
        selected && 'bg-muted border-accent',
        message.status === 'dismissed' && 'opacity-50',
      )}
    >
      <div className="flex items-center gap-2 mb-1">
        <MessageTypeBadge type={message.type} />
        <MessagePriorityBadge priority={message.priority} />
        <MessageStatusBadge status={message.status} />
        <span className="ml-auto text-xs text-muted-foreground">{timeAgo(message.createdAt)}</span>
      </div>
      <p className="text-sm font-medium truncate">{message.title}</p>
      {message.metadata?.sourceProject && (
        <p className="text-xs text-muted-foreground mt-1">
          from {message.metadata.sourceProject}
        </p>
      )}
    </button>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/ui/src/components/message-card.tsx
git commit -m "feat(ui): add MessageCard component"
```

---

## Task 10: UI — MessageDetail Component

**Files:**
- Create: `packages/ui/src/components/message-detail.tsx`

- [ ] **Step 1: Create message-detail.tsx**

Create `packages/ui/src/components/message-detail.tsx`:

```tsx
import type { Message } from '@agent-brain/shared';
import { MessageTypeBadge } from './message-type-badge';
import { MessagePriorityBadge } from './message-priority-badge';
import { MessageStatusBadge } from './message-status-badge';
import { MarkdownView } from './markdown-view';
import { Button } from '@/components/ui/button';
import { useUpdateMessage } from '@/api/hooks/use-messages';
import { Check, Eye, X } from 'lucide-react';

interface MessageDetailProps {
  message: Message;
}

export function MessageDetail({ message }: MessageDetailProps) {
  const updateMutation = useUpdateMessage();

  const setStatus = (status: 'ack' | 'done' | 'dismissed') => {
    updateMutation.mutate({ id: message.id, status });
  };

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold mb-2">{message.title}</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <MessageTypeBadge type={message.type} />
          <MessagePriorityBadge priority={message.priority} />
          <MessageStatusBadge status={message.status} />
        </div>
      </div>

      {/* Metadata */}
      <div className="text-xs text-muted-foreground space-y-1">
        {message.metadata?.sourceProject && (
          <p>Source: <span className="text-foreground">{message.metadata.sourceProject}</span></p>
        )}
        {message.metadata?.severity && (
          <p>Severity: <span className="text-foreground">{message.metadata.severity}</span></p>
        )}
        {message.metadata?.assignee && (
          <p>Assignee: <span className="text-foreground">{message.metadata.assignee}</span></p>
        )}
        <p>Created: <span className="text-foreground">{new Date(message.createdAt).toLocaleString()}</span></p>
        <p>Updated: <span className="text-foreground">{new Date(message.updatedAt).toLocaleString()}</span></p>
      </div>

      {/* Content */}
      <div className="border-t border-border pt-4">
        <MarkdownView content={message.content} />
      </div>

      {/* Actions */}
      {message.status === 'pending' && (
        <div className="flex gap-2 border-t border-border pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setStatus('ack')}
            disabled={updateMutation.isPending}
          >
            <Eye className="h-4 w-4 mr-1" />
            Ack
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setStatus('done')}
            disabled={updateMutation.isPending}
          >
            <Check className="h-4 w-4 mr-1" />
            Done
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setStatus('dismissed')}
            disabled={updateMutation.isPending}
          >
            <X className="h-4 w-4 mr-1" />
            Dismiss
          </Button>
        </div>
      )}
      {message.status === 'ack' && (
        <div className="flex gap-2 border-t border-border pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setStatus('done')}
            disabled={updateMutation.isPending}
          >
            <Check className="h-4 w-4 mr-1" />
            Done
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setStatus('dismissed')}
            disabled={updateMutation.isPending}
          >
            <X className="h-4 w-4 mr-1" />
            Dismiss
          </Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/ui/src/components/message-detail.tsx
git commit -m "feat(ui): add MessageDetail component with action buttons"
```

---

## Task 11: UI — Messages Page

**Files:**
- Create: `packages/ui/src/pages/messages.tsx`

- [ ] **Step 1: Create messages.tsx page**

Create `packages/ui/src/pages/messages.tsx`:

```tsx
import { useState } from 'react';
import { useMessages } from '@/api/hooks/use-messages';
import { useProjects } from '@/api/hooks/use-projects';
import { MessageCard } from '@/components/message-card';
import { MessageDetail } from '@/components/message-detail';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Inbox } from 'lucide-react';
import type { Message } from '@agent-brain/shared';

export function Messages() {
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [selected, setSelected] = useState<Message | null>(null);

  const { data: projectsData } = useProjects();
  const projects = projectsData?.items ?? [];

  const { data, isLoading } = useMessages({
    type: typeFilter !== 'all' ? typeFilter : undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    projectSlug: projectFilter !== 'all' ? projectFilter : undefined,
  });

  const messages = data?.items ?? [];
  const pendingCount = data?.pendingCount ?? 0;

  return (
    <div className="flex h-full">
      {/* Left panel — list */}
      <div className="w-[400px] border-r border-border flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2 mb-3">
            <Inbox className="h-5 w-5" />
            <h1 className="text-lg font-semibold">Messages</h1>
            {pendingCount > 0 && (
              <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-xs font-medium text-black">
                {pendingCount}
              </span>
            )}
          </div>

          {/* Filters */}
          <div className="flex gap-2">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-8 text-xs flex-1">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="issue">Issue</SelectItem>
                <SelectItem value="context">Context</SelectItem>
                <SelectItem value="task">Task</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 text-xs flex-1">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="ack">Ack</SelectItem>
                <SelectItem value="done">Done</SelectItem>
                <SelectItem value="dismissed">Dismissed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="h-8 text-xs flex-1">
                <SelectValue placeholder="Project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All projects</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.slug}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {isLoading && (
            <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>
          )}
          {!isLoading && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Inbox className="h-8 w-8 mb-2" />
              <p className="text-sm">No messages</p>
            </div>
          )}
          {messages.map((msg) => (
            <MessageCard
              key={msg.id}
              message={msg}
              selected={selected?.id === msg.id}
              onClick={() => setSelected(msg)}
            />
          ))}
        </div>
      </div>

      {/* Right panel — detail */}
      <div className="flex-1 overflow-y-auto">
        {selected ? (
          <MessageDetail message={selected} />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p className="text-sm">Select a message to view details</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/ui/src/pages/messages.tsx
git commit -m "feat(ui): add Messages page with filters and detail panel"
```

---

## Task 12: UI — Routing & Sidebar Integration

**Files:**
- Modify: `packages/ui/src/app.tsx`
- Modify: `packages/ui/src/components/sidebar.tsx`

- [ ] **Step 1: Add `/messages` route to `app.tsx`**

In `packages/ui/src/app.tsx`, add the import:

```typescript
import { Messages } from '@/pages/messages';
```

Add the route inside `<Routes>`, after the `/search` route:

```tsx
<Route path="/messages" element={<Messages />} />
```

- [ ] **Step 2: Add Messages link with pending badge to sidebar**

In `packages/ui/src/components/sidebar.tsx`, add imports:

```typescript
import { Inbox } from 'lucide-react';
import { usePendingCount } from '@/api/hooks/use-messages';
```

Inside the `Sidebar` component, add the hook call after the existing hooks:

```typescript
const pendingCount = usePendingCount();
```

Add the Messages nav link. Insert it after the search button `<div>` and before the `<Separator />`, so it sits between search and the projects section:

```tsx
<Link
  to="/messages"
  className={cn(
    'mx-3 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted',
    location.pathname.startsWith('/messages') && 'bg-muted',
  )}
>
  <Inbox className="h-4 w-4" />
  Messages
  {(pendingCount.data ?? 0) > 0 && (
    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-xs font-medium text-black">
      {pendingCount.data}
    </span>
  )}
</Link>
```

- [ ] **Step 3: Verify build**

Run: `pnpm build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/app.tsx packages/ui/src/components/sidebar.tsx
git commit -m "feat(ui): add messages route and sidebar link with pending badge"
```

---

## Task 13: Selected Message Sync Fix

When a message status is updated via the detail panel, the `selected` state still holds the old message object. Fix this.

**Files:**
- Modify: `packages/ui/src/pages/messages.tsx`

- [ ] **Step 1: Sync selected message with query data**

In `packages/ui/src/pages/messages.tsx`, after the `messages` variable, add:

```typescript
// Keep selected message in sync with query data
const selectedMessage = selected
  ? messages.find((m) => m.id === selected.id) ?? null
  : null;
```

Replace `selected` with `selectedMessage` in the JSX:
- In `<MessageCard>`: change `selected={selected?.id === msg.id}` to `selected={selectedMessage?.id === msg.id}`
- In the right panel: change `{selected ? <MessageDetail message={selected} />` to `{selectedMessage ? <MessageDetail message={selectedMessage} />`

- [ ] **Step 2: Commit**

```bash
git add packages/ui/src/pages/messages.tsx
git commit -m "fix(ui): sync selected message with query data after status update"
```

---

## Task 14: Full Verification

- [ ] **Step 1: Run all tests**

Run: `pnpm test`
Expected: ALL PASS

- [ ] **Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: 0 errors

- [ ] **Step 3: Run build**

Run: `pnpm build`
Expected: SUCCESS

- [ ] **Step 4: Manual smoke test**

Start the server: `pnpm --filter @agent-brain/mcp dev`

Test via curl:

```bash
# Create a message
curl -s -X POST http://127.0.0.1:4000/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"message_create","params":{"projectSlug":"global","type":"issue","title":"Test message","content":"Hello from curl","priority":"high","metadata":{"severity":"bug","sourceProject":"cruchot"}}}'

# List messages
curl -s -X POST http://127.0.0.1:4000/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"message_list","params":{}}'

# Update status to ack (replace <ID> with the id from create response)
curl -s -X POST http://127.0.0.1:4000/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":3,"method":"message_update","params":{"id":"<ID>","status":"ack"}}'
```

Open `http://localhost:5173/messages` and verify the UI shows the message.

- [ ] **Step 5: Final commit if any fixes needed**

Only if smoke test reveals issues.
