import type { Database } from 'better-sqlite3';
import { z } from 'zod';
import { HANDOFF_STATUSES } from '@agent-brain/shared';

// ---------------------------------------------------------------------------
// Helpers — map raw SQLite rows to camelCase (gotcha 3)
// ---------------------------------------------------------------------------

interface RawHandoffRow {
  id: string;
  title: string;
  content: string;
  status: string;
  created_at: number;
}

function toHandoff(row: RawHandoffRow) {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    status: row.status,
    createdAt: row.created_at,
  };
}

// Resolve a handoff reference (by id OR title) to a concrete row.
// Title matches are resolved to the most recent row (any status) — a deliberate
// tie-breaker, since the skill-driven UX uses titles picked by the user and
// collisions should never block the flow. A warning is logged when more than
// one row matches the title.
function resolveHandoff(
  db: Database,
  ref: { id?: string | undefined; title?: string | undefined },
): RawHandoffRow | undefined {
  if (ref.id) {
    return db.prepare('SELECT * FROM handoffs WHERE id = ?').get(ref.id) as
      | RawHandoffRow
      | undefined;
  }
  if (ref.title) {
    const rows = db
      .prepare('SELECT * FROM handoffs WHERE title = ? ORDER BY created_at DESC')
      .all(ref.title) as RawHandoffRow[];
    if (rows.length > 1) {
      console.warn(
        `[handoff] ${rows.length} matches for title="${ref.title}"; returning the most recent`,
      );
    }
    return rows[0];
  }
  return undefined;
}

const HandoffRef = z
  .object({
    id: z.string().uuid().optional(),
    title: z.string().min(1).max(200).optional(),
  })
  .refine((v) => v.id || v.title, {
    message: 'handoff reference requires `id` or `title`',
  });

// ---------------------------------------------------------------------------
// handoffCreate
// ---------------------------------------------------------------------------

const HandoffCreateInput = z.object({
  title: z.string().min(1).max(200),
  content: z.string().max(1_000_000).optional().default(''),
  status: z.enum(HANDOFF_STATUSES).optional().default('inbox'),
});

export function handoffCreate(db: Database, raw: unknown) {
  const input = HandoffCreateInput.parse(raw);
  const id = crypto.randomUUID();
  const now = Date.now();

  db.prepare(
    `INSERT INTO handoffs (id, title, content, status, created_at) VALUES (?, ?, ?, ?, ?)`,
  ).run(id, input.title, input.content, input.status, now);

  const row = db.prepare('SELECT * FROM handoffs WHERE id = ?').get(id) as RawHandoffRow;
  return { ok: true as const, id, item: toHandoff(row) };
}

// ---------------------------------------------------------------------------
// handoffList
// ---------------------------------------------------------------------------

const HandoffListInput = z.object({
  status: z.enum(HANDOFF_STATUSES).optional(),
  limit: z.number().int().min(1).max(200).optional().default(50),
  offset: z.number().int().nonnegative().optional().default(0),
});

export function handoffList(db: Database, raw: unknown) {
  const input = HandoffListInput.parse(raw);

  const clauses: string[] = [];
  const params: unknown[] = [];

  if (input.status) {
    clauses.push('status = ?');
    params.push(input.status);
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';

  const rows = db
    .prepare(`SELECT * FROM handoffs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .all(...params, input.limit, input.offset) as RawHandoffRow[];

  const total = (
    db.prepare(`SELECT COUNT(*) as c FROM handoffs ${where}`).get(...params) as { c: number }
  ).c;

  return {
    items: rows.map(toHandoff),
    total,
  };
}

// ---------------------------------------------------------------------------
// handoffGet
// ---------------------------------------------------------------------------

export function handoffGet(db: Database, raw: unknown) {
  const input = HandoffRef.parse(raw);
  const row = resolveHandoff(db, input);
  if (!row) {
    const ref = input.id ? `id="${input.id}"` : `title="${input.title}"`;
    throw new Error(`Handoff not found: ${ref}`);
  }
  return { item: toHandoff(row) };
}

// ---------------------------------------------------------------------------
// handoffClose
// ---------------------------------------------------------------------------

export function handoffClose(db: Database, raw: unknown) {
  const input = HandoffRef.parse(raw);
  const row = resolveHandoff(db, input);
  if (!row) {
    const ref = input.id ? `id="${input.id}"` : `title="${input.title}"`;
    throw new Error(`Handoff not found: ${ref}`);
  }

  db.prepare('UPDATE handoffs SET status = ? WHERE id = ?').run('done', row.id);

  const updated = db.prepare('SELECT * FROM handoffs WHERE id = ?').get(row.id) as RawHandoffRow;
  return { ok: true as const, id: row.id, item: toHandoff(updated) };
}
