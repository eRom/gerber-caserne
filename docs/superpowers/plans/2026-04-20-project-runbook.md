# Project Runbook Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-project runbook (command, URL, env) to gerber. MCP tools manage state and detached processes; TUI exposes a `runbook` screen with run/stop/logs/edit; a `/gerber:runbook` skill auto-populates the runbook from repo structure.

**Architecture:** Extend `projects` table with 4 columns + new `running_processes` table. Add MCP tools (`project_get_runbook`, `project_set_runbook`, `project_run`, `project_stop`, `project_tail_logs`) and enrich `project_list` with `is_running`. TUI gains a new `runbook` screen (first in project nav). Skill lives at `skills/runbook/SKILL.md`.

**Tech Stack:** TypeScript, better-sqlite3, Drizzle, Zod, Node `child_process.spawn`, Ink (TUI), Vitest.

**Spec:** `docs/superpowers/specs/2026-04-20-project-runbook-design.md`

---

## File Structure

**Create:**
- `packages/mcp/src/db/migrations/0004_runbook.sql` — Add columns + table
- `packages/mcp/src/tools/runbook.ts` — Runbook CRUD + process management
- `packages/mcp/src/runbook/process.ts` — Spawn/kill/cleanup helpers
- `packages/mcp/src/runbook/logs.ts` — Log path + tail helpers
- `packages/mcp/src/tests/tools/runbook.test.ts` — Unit tests
- `packages/mcp/src/tests/runbook/process.test.ts` — Process lifecycle tests
- `packages/tui/src/api/runbook.ts` — TUI → MCP client for runbook
- `packages/tui/src/api/config.ts` — Read `~/.config/gerber/config.json` (editor_cmd)
- `packages/tui/src/screens/runbook.tsx` — New screen
- `packages/tui/src/screens/runbook-logs.tsx` — Full-screen log tail overlay
- `packages/tui/src/screens/runbook-edit.tsx` — Inline edit form
- `skills/runbook/SKILL.md` — Claude-invokable skill

**Modify:**
- `packages/shared/src/db/schema.ts` — Add runbook columns + running_processes table
- `packages/shared/src/types.ts` — Export `Runbook`, `RunningProcess` types
- `packages/mcp/src/tools/projects.ts` — `toProject()` maps new columns; `projectList` enriched with `is_running`
- `packages/mcp/src/tools/index.ts` — Register new tools
- `packages/mcp/src/db/migrate.ts` — Call boot cleanup at end of applyMigrations
- `packages/tui/src/components/nav.tsx` — Add `runbook` to `ProjectScreen` type
- `packages/tui/src/app.tsx` — Default screen = `runbook`, add `r` shortcut, route to new screen
- `packages/tui/src/screens/home.tsx` — Add `●` indicator when `is_running`
- `.claude-plugin/plugin.json` — Bump version to `1.3.0`
- `CLAUDE.md` — Mention `/gerber:runbook` skill and runbook columns

---

## Task 1 — DB Migration + Drizzle Schema

**Files:**
- Create: `packages/mcp/src/db/migrations/0004_runbook.sql`
- Modify: `packages/shared/src/db/schema.ts`
- Test: `packages/mcp/src/tests/db/schema.test.ts`

- [ ] **Step 1: Write migration SQL**

Create `packages/mcp/src/db/migrations/0004_runbook.sql`:

```sql
ALTER TABLE projects ADD COLUMN run_cmd  TEXT;
--> statement-breakpoint
ALTER TABLE projects ADD COLUMN run_cwd  TEXT;
--> statement-breakpoint
ALTER TABLE projects ADD COLUMN url      TEXT;
--> statement-breakpoint
ALTER TABLE projects ADD COLUMN env_json TEXT;
--> statement-breakpoint
CREATE TABLE running_processes (
  project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  pid        INTEGER NOT NULL,
  started_at INTEGER NOT NULL,
  log_path   TEXT    NOT NULL,
  run_cmd    TEXT    NOT NULL
);
```

- [ ] **Step 2: Update Drizzle schema**

Modify `packages/shared/src/db/schema.ts` — add fields to `projects` table and declare `running_processes`:

```ts
export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  repoPath: text('repo_path'),
  color: text('color'),
  runCmd: text('run_cmd'),
  runCwd: text('run_cwd'),
  url: text('url'),
  envJson: text('env_json'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const runningProcesses = sqliteTable('running_processes', {
  projectId: text('project_id').primaryKey().references(() => projects.id, { onDelete: 'cascade' }),
  pid: integer('pid').notNull(),
  startedAt: integer('started_at').notNull(),
  logPath: text('log_path').notNull(),
  runCmd: text('run_cmd').notNull(),
});
```

- [ ] **Step 3: Write schema test**

Add to `packages/mcp/src/tests/db/schema.test.ts`:

```ts
it('runbook columns exist on projects', () => {
  const { db, close } = freshDb();
  const cols = db.prepare("PRAGMA table_info(projects)").all() as Array<{ name: string }>;
  const names = cols.map(c => c.name);
  expect(names).toContain('run_cmd');
  expect(names).toContain('run_cwd');
  expect(names).toContain('url');
  expect(names).toContain('env_json');
  close();
});

it('running_processes table exists with expected columns', () => {
  const { db, close } = freshDb();
  const cols = db.prepare("PRAGMA table_info(running_processes)").all() as Array<{ name: string }>;
  const names = cols.map(c => c.name);
  expect(names).toEqual(expect.arrayContaining(['project_id', 'pid', 'started_at', 'log_path', 'run_cmd']));
  close();
});
```

- [ ] **Step 4: Run tests — expect FAIL**

```bash
pnpm --filter @agent-brain/mcp test -- schema
```
Expected: first run of new tests should PASS because `freshDb` applies migrations including the new 0004. If they fail, debug the migration file.

- [ ] **Step 5: Run existing tests — expect PASS**

```bash
pnpm --filter @agent-brain/mcp test
```
Expected: all existing tests still pass (migration is additive).

- [ ] **Step 6: Commit**

```bash
git add packages/mcp/src/db/migrations/0004_runbook.sql \
        packages/shared/src/db/schema.ts \
        packages/mcp/src/tests/db/schema.test.ts
git commit -m "feat(db): add runbook columns and running_processes table (migration 0004)"
```

---

## Task 2 — Types + Helper Mapping

**Files:**
- Modify: `packages/shared/src/types.ts`
- Modify: `packages/mcp/src/tools/projects.ts` (extend `toProject` and `RawProjectRow`)

- [ ] **Step 1: Add types in shared**

Append to `packages/shared/src/types.ts`:

```ts
export interface Runbook {
  runCmd: string | null;
  runCwd: string | null;
  url: string | null;
  env: Record<string, string> | null;
}

export interface RunningProcessInfo {
  pid: number;
  startedAt: number;
  logPath: string;
  runCmd: string;
}

export interface ProjectWithRunbook {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  repoPath: string | null;
  color: string | null;
  runCmd: string | null;
  runCwd: string | null;
  url: string | null;
  env: Record<string, string> | null;
  createdAt: number;
  updatedAt: number;
  isRunning: boolean;
  running?: RunningProcessInfo;
}
```

- [ ] **Step 2: Update RawProjectRow and toProject**

In `packages/mcp/src/tools/projects.ts` replace `RawProjectRow` and `toProject`:

```ts
interface RawProjectRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  repo_path: string | null;
  color: string | null;
  run_cmd: string | null;
  run_cwd: string | null;
  url: string | null;
  env_json: string | null;
  created_at: number;
  updated_at: number;
}

function toProject(row: RawProjectRow) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    repoPath: row.repo_path,
    color: row.color,
    runCmd: row.run_cmd,
    runCwd: row.run_cwd,
    url: row.url,
    env: row.env_json ? (JSON.parse(row.env_json) as Record<string, string>) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
```

- [ ] **Step 3: Run existing projects tests**

```bash
pnpm --filter @agent-brain/mcp test -- projects.test
```
Expected: PASS (no behavior change, just extra fields in output).

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/types.ts packages/mcp/src/tools/projects.ts
git commit -m "feat(types): runbook types + extended project mapping"
```

---

## Task 3 — Runbook CRUD (project_get_runbook, project_set_runbook)

**Files:**
- Create: `packages/mcp/src/tools/runbook.ts`
- Create: `packages/mcp/src/tests/tools/runbook.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/mcp/src/tests/tools/runbook.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Database } from 'better-sqlite3';
import { freshDb } from '../_helpers/fresh-db.js';
import { projectCreate } from '../../tools/projects.js';
import { projectGetRunbook, projectSetRunbook } from '../../tools/runbook.js';

describe('runbook CRUD', () => {
  let db: Database;
  let close: () => void;
  let projectId: string;

  beforeEach(() => {
    ({ db, close } = freshDb());
    const p = projectCreate(db, { slug: 'demo', name: 'Demo', repoPath: '/tmp/demo' });
    projectId = p.id;
  });
  afterEach(() => close());

  it('get returns nulls for a fresh project', () => {
    const rb = projectGetRunbook(db, { project_id: projectId });
    expect(rb.run_cmd).toBeNull();
    expect(rb.run_cwd).toBeNull();
    expect(rb.url).toBeNull();
    expect(rb.env).toBeNull();
    expect(rb.is_running).toBe(false);
  });

  it('set persists the runbook', () => {
    projectSetRunbook(db, {
      project_id: projectId,
      run_cmd: 'pnpm dev',
      url: 'http://localhost:5173',
      env: { PORT: '5173' },
    });
    const rb = projectGetRunbook(db, { project_id: projectId });
    expect(rb.run_cmd).toBe('pnpm dev');
    expect(rb.url).toBe('http://localhost:5173');
    expect(rb.env).toEqual({ PORT: '5173' });
  });

  it('set with null clears a field', () => {
    projectSetRunbook(db, { project_id: projectId, run_cmd: 'pnpm dev' });
    projectSetRunbook(db, { project_id: projectId, run_cmd: null });
    const rb = projectGetRunbook(db, { project_id: projectId });
    expect(rb.run_cmd).toBeNull();
  });

  it('rejects relative path with traversal', () => {
    expect(() =>
      projectSetRunbook(db, { project_id: projectId, run_cwd: '../etc' }),
    ).toThrow();
  });

  it('rejects run_cmd over 2000 chars', () => {
    expect(() =>
      projectSetRunbook(db, { project_id: projectId, run_cmd: 'x'.repeat(2001) }),
    ).toThrow();
  });

  it('rejects invalid env keys', () => {
    expect(() =>
      projectSetRunbook(db, { project_id: projectId, env: { 'bad-key': '1' } }),
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
pnpm --filter @agent-brain/mcp test -- runbook
```
Expected: FAIL (module `../../tools/runbook.js` not found).

- [ ] **Step 3: Implement runbook.ts CRUD**

Create `packages/mcp/src/tools/runbook.ts`:

```ts
import type { Database } from 'better-sqlite3';
import { z } from 'zod';

const EnvSchema = z.record(
  z.string().regex(/^[A-Z_][A-Z0-9_]*$/, 'env keys must match [A-Z_][A-Z0-9_]*'),
  z.string(),
);

const GetInput = z.object({
  project_id: z.string().uuid(),
});

const SetInput = z.object({
  project_id: z.string().uuid(),
  run_cmd: z.string().trim().max(2000).nullable().optional(),
  run_cwd: z
    .string()
    .trim()
    .max(260)
    .refine((s) => !s.startsWith('/') && !s.split('/').includes('..'), {
      message: 'run_cwd must be relative and must not contain ..',
    })
    .nullable()
    .optional(),
  url: z
    .string()
    .trim()
    .max(500)
    .refine(
      (s) => /^https?:\/\//.test(s) || s.startsWith('http://localhost') || s.startsWith('http://127.'),
      'url must be http(s)://',
    )
    .nullable()
    .optional(),
  env: EnvSchema.nullable().optional(),
});

interface RawProjectRow {
  run_cmd: string | null;
  run_cwd: string | null;
  url: string | null;
  env_json: string | null;
}

interface RawRunningRow {
  pid: number;
  started_at: number;
  log_path: string;
}

export interface RunbookResult {
  run_cmd: string | null;
  run_cwd: string | null;
  url: string | null;
  env: Record<string, string> | null;
  is_running: boolean;
  pid?: number;
  started_at?: number;
  log_path?: string;
}

export function projectGetRunbook(db: Database, raw: unknown): RunbookResult {
  const { project_id } = GetInput.parse(raw);
  const row = db
    .prepare('SELECT run_cmd, run_cwd, url, env_json FROM projects WHERE id = ?')
    .get(project_id) as RawProjectRow | undefined;
  if (!row) throw new Error(`Project ${project_id} not found`);

  const running = db
    .prepare('SELECT pid, started_at, log_path FROM running_processes WHERE project_id = ?')
    .get(project_id) as RawRunningRow | undefined;

  return {
    run_cmd: row.run_cmd,
    run_cwd: row.run_cwd,
    url: row.url,
    env: row.env_json ? (JSON.parse(row.env_json) as Record<string, string>) : null,
    is_running: !!running,
    ...(running ? { pid: running.pid, started_at: running.started_at, log_path: running.log_path } : {}),
  };
}

export function projectSetRunbook(
  db: Database,
  raw: unknown,
): { ok: true; project_id: string } {
  const input = SetInput.parse(raw);
  const { project_id, ...fields } = input;

  const sets: string[] = [];
  const values: unknown[] = [];

  if ('run_cmd' in fields) {
    sets.push('run_cmd = ?');
    values.push(fields.run_cmd ?? null);
  }
  if ('run_cwd' in fields) {
    sets.push('run_cwd = ?');
    values.push(fields.run_cwd ?? null);
  }
  if ('url' in fields) {
    sets.push('url = ?');
    values.push(fields.url ?? null);
  }
  if ('env' in fields) {
    sets.push('env_json = ?');
    values.push(fields.env ? JSON.stringify(fields.env) : null);
  }

  if (sets.length === 0) return { ok: true, project_id };

  sets.push('updated_at = ?');
  values.push(Date.now());
  values.push(project_id);

  db.prepare(`UPDATE projects SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  return { ok: true, project_id };
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
pnpm --filter @agent-brain/mcp test -- runbook
```
Expected: all 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/mcp/src/tools/runbook.ts packages/mcp/src/tests/tools/runbook.test.ts
git commit -m "feat(mcp): project_get_runbook / project_set_runbook"
```

---

## Task 4 — Process Spawn Helpers + Log Paths

**Files:**
- Create: `packages/mcp/src/runbook/logs.ts`
- Create: `packages/mcp/src/runbook/process.ts`
- Create: `packages/mcp/src/tests/runbook/process.test.ts`

- [ ] **Step 1: Implement log path resolver**

Create `packages/mcp/src/runbook/logs.ts`:

```ts
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export function runsDir(): string {
  const xdgState = process.env.XDG_STATE_HOME || join(homedir(), '.local', 'state');
  const dir = join(xdgState, 'gerber', 'runs');
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function logPathForSlug(slug: string): string {
  return join(runsDir(), `${slug}.log`);
}
```

- [ ] **Step 2: Write failing process tests**

Create `packages/mcp/src/tests/runbook/process.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { spawnDetached, isAlive } from '../../runbook/process.js';
import { logPathForSlug } from '../../runbook/logs.js';

describe('process helpers', () => {
  it('isAlive returns false for PID 2^31-1', () => {
    expect(isAlive(2147483646)).toBe(false);
  });

  it('isAlive returns true for current process', () => {
    expect(isAlive(process.pid)).toBe(true);
  });

  it('spawnDetached starts a process and returns pid + log path', async () => {
    const logPath = logPathForSlug('test-spawn');
    const pid = spawnDetached({
      cmd: 'sleep 2',
      cwd: '/tmp',
      env: {},
      logPath,
    });
    expect(typeof pid).toBe('number');
    expect(isAlive(pid)).toBe(true);
    // Cleanup
    try { process.kill(pid, 'SIGTERM'); } catch {}
  });
});
```

- [ ] **Step 3: Run tests — expect FAIL**

```bash
pnpm --filter @agent-brain/mcp test -- runbook/process
```
Expected: FAIL (module not found).

- [ ] **Step 4: Implement process helpers**

Create `packages/mcp/src/runbook/process.ts`:

```ts
import { spawn } from 'node:child_process';
import { openSync, closeSync } from 'node:fs';

export interface SpawnOptions {
  cmd: string;                          // Full shell command (e.g. "pnpm dev")
  cwd: string;                          // Absolute cwd
  env: Record<string, string>;          // Env overrides
  logPath: string;                      // File path for stdout+stderr
}

export function spawnDetached(opts: SpawnOptions): number {
  const fd = openSync(opts.logPath, 'w');
  try {
    const child = spawn('sh', ['-c', opts.cmd], {
      cwd: opts.cwd,
      env: { ...process.env, ...opts.env },
      detached: true,
      stdio: ['ignore', fd, fd],
    });
    child.unref();
    if (child.pid === undefined) {
      throw new Error('spawn failed: no PID returned');
    }
    return child.pid;
  } finally {
    closeSync(fd);
  }
}

export function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function killPid(pid: number, force = false): void {
  try {
    process.kill(pid, force ? 'SIGKILL' : 'SIGTERM');
  } catch {
    // Already dead — ignore
  }
}
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
pnpm --filter @agent-brain/mcp test -- runbook/process
```
Expected: all 3 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/mcp/src/runbook packages/mcp/src/tests/runbook
git commit -m "feat(mcp): detached process helpers + log path resolver"
```

---

## Task 5 — project_run Tool

**Files:**
- Modify: `packages/mcp/src/tools/runbook.ts`
- Modify: `packages/mcp/src/tests/tools/runbook.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `packages/mcp/src/tests/tools/runbook.test.ts`:

```ts
import { projectRun } from '../../tools/runbook.js';

describe('project_run', () => {
  let db: Database;
  let close: () => void;
  let projectId: string;

  beforeEach(() => {
    ({ db, close } = freshDb());
    const p = projectCreate(db, { slug: 'runme', name: 'Run me', repoPath: '/tmp' });
    projectId = p.id;
  });
  afterEach(() => close());

  it('fails when no runbook', () => {
    expect(() => projectRun(db, { project_id: projectId })).toThrow(/no_runbook/);
  });

  it('fails when no repo_path', () => {
    projectSetRunbook(db, { project_id: projectId, run_cmd: 'sleep 1' });
    db.prepare('UPDATE projects SET repo_path = NULL WHERE id = ?').run(projectId);
    expect(() => projectRun(db, { project_id: projectId })).toThrow(/no_repo_path/);
  });

  it('starts a process, inserts running_processes row', () => {
    projectSetRunbook(db, { project_id: projectId, run_cmd: 'sleep 5' });
    const res = projectRun(db, { project_id: projectId });
    expect(res.ok).toBe(true);
    expect(typeof res.pid).toBe('number');
    const row = db.prepare('SELECT * FROM running_processes WHERE project_id = ?').get(projectId);
    expect(row).toBeDefined();
    // Cleanup
    try { process.kill(res.pid, 'SIGTERM'); } catch {}
  });

  it('fails with already_running when called twice', () => {
    projectSetRunbook(db, { project_id: projectId, run_cmd: 'sleep 5' });
    const res = projectRun(db, { project_id: projectId });
    expect(() => projectRun(db, { project_id: projectId })).toThrow(/already_running/);
    try { process.kill(res.pid, 'SIGTERM'); } catch {}
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
pnpm --filter @agent-brain/mcp test -- runbook
```
Expected: 4 new tests FAIL (projectRun not exported).

- [ ] **Step 3: Implement projectRun**

Append to `packages/mcp/src/tools/runbook.ts`:

```ts
import { join, isAbsolute } from 'node:path';
import { spawnDetached, isAlive } from '../runbook/process.js';
import { logPathForSlug } from '../runbook/logs.js';

const RunInput = z.object({ project_id: z.string().uuid() });

interface RawProjectForRun {
  slug: string;
  repo_path: string | null;
  run_cmd: string | null;
  run_cwd: string | null;
  env_json: string | null;
}

export function projectRun(
  db: Database,
  raw: unknown,
): { ok: true; pid: number; log_path: string; url: string | null } {
  const { project_id } = RunInput.parse(raw);

  const existing = db
    .prepare('SELECT pid FROM running_processes WHERE project_id = ?')
    .get(project_id) as { pid: number } | undefined;
  if (existing) {
    if (isAlive(existing.pid)) {
      throw new Error(`already_running (pid ${existing.pid})`);
    }
    // Stale — clean and proceed
    db.prepare('DELETE FROM running_processes WHERE project_id = ?').run(project_id);
  }

  const project = db
    .prepare('SELECT slug, repo_path, run_cmd, run_cwd, env_json, url FROM projects WHERE id = ?')
    .get(project_id) as (RawProjectForRun & { url: string | null }) | undefined;
  if (!project) throw new Error(`Project ${project_id} not found`);
  if (!project.run_cmd) throw new Error('no_runbook: run_cmd is empty');
  if (!project.repo_path) throw new Error('no_repo_path: project.repo_path is null');

  const cwd = project.run_cwd
    ? isAbsolute(project.run_cwd)
      ? project.run_cwd
      : join(project.repo_path, project.run_cwd)
    : project.repo_path;

  const env = project.env_json ? (JSON.parse(project.env_json) as Record<string, string>) : {};
  const logPath = logPathForSlug(project.slug);

  const pid = spawnDetached({ cmd: project.run_cmd, cwd, env, logPath });
  const now = Date.now();

  db.prepare(
    `INSERT INTO running_processes (project_id, pid, started_at, log_path, run_cmd)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(project_id, pid, now, logPath, project.run_cmd);

  return { ok: true, pid, log_path: logPath, url: project.url };
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
pnpm --filter @agent-brain/mcp test -- runbook
```
Expected: all runbook tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/mcp/src/tools/runbook.ts packages/mcp/src/tests/tools/runbook.test.ts
git commit -m "feat(mcp): project_run spawns detached process"
```

---

## Task 6 — project_stop Tool

**Files:**
- Modify: `packages/mcp/src/tools/runbook.ts`
- Modify: `packages/mcp/src/tests/tools/runbook.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `packages/mcp/src/tests/tools/runbook.test.ts`:

```ts
import { projectStop } from '../../tools/runbook.js';

describe('project_stop', () => {
  let db: Database;
  let close: () => void;
  let projectId: string;

  beforeEach(() => {
    ({ db, close } = freshDb());
    const p = projectCreate(db, { slug: 'stopme', name: 'Stop me', repoPath: '/tmp' });
    projectId = p.id;
  });
  afterEach(() => close());

  it('fails with not_running when nothing is running', () => {
    expect(() => projectStop(db, { project_id: projectId })).toThrow(/not_running/);
  });

  it('kills the process and removes the row', async () => {
    projectSetRunbook(db, { project_id: projectId, run_cmd: 'sleep 10' });
    const { pid } = projectRun(db, { project_id: projectId });
    const res = projectStop(db, { project_id: projectId });
    expect(res.ok).toBe(true);
    const row = db.prepare('SELECT * FROM running_processes WHERE project_id = ?').get(projectId);
    expect(row).toBeUndefined();
    // Give SIGTERM time to propagate
    await new Promise((r) => setTimeout(r, 200));
    expect(isAlive(pid)).toBe(false);
  });
});
```

Add import near the top of the test file:
```ts
import { isAlive } from '../../runbook/process.js';
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
pnpm --filter @agent-brain/mcp test -- runbook
```
Expected: 2 new tests FAIL.

- [ ] **Step 3: Implement projectStop**

Append to `packages/mcp/src/tools/runbook.ts`:

```ts
import { killPid } from '../runbook/process.js';

const StopInput = z.object({
  project_id: z.string().uuid(),
  force: z.boolean().optional(),
});

export function projectStop(db: Database, raw: unknown): { ok: true } {
  const { project_id, force } = StopInput.parse(raw);
  const row = db
    .prepare('SELECT pid FROM running_processes WHERE project_id = ?')
    .get(project_id) as { pid: number } | undefined;
  if (!row) throw new Error('not_running');

  killPid(row.pid, force);
  db.prepare('DELETE FROM running_processes WHERE project_id = ?').run(project_id);
  return { ok: true };
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
pnpm --filter @agent-brain/mcp test -- runbook
```
Expected: all runbook tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/mcp/src/tools/runbook.ts packages/mcp/src/tests/tools/runbook.test.ts
git commit -m "feat(mcp): project_stop sends SIGTERM and cleans state"
```

---

## Task 7 — project_tail_logs Tool

**Files:**
- Modify: `packages/mcp/src/tools/runbook.ts`
- Modify: `packages/mcp/src/tests/tools/runbook.test.ts`

- [ ] **Step 1: Write failing test**

Append to `packages/mcp/src/tests/tools/runbook.test.ts`:

```ts
import { projectTailLogs } from '../../tools/runbook.js';
import { writeFileSync } from 'node:fs';
import { logPathForSlug } from '../../runbook/logs.js';

describe('project_tail_logs', () => {
  let db: Database;
  let close: () => void;
  let projectId: string;

  beforeEach(() => {
    ({ db, close } = freshDb());
    const p = projectCreate(db, { slug: 'logtest', name: 'Log', repoPath: '/tmp' });
    projectId = p.id;
  });
  afterEach(() => close());

  it('returns last N lines of the log file', () => {
    const logPath = logPathForSlug('logtest');
    writeFileSync(logPath, Array.from({ length: 50 }, (_, i) => `line ${i + 1}`).join('\n'));
    db.prepare(
      `INSERT INTO running_processes (project_id, pid, started_at, log_path, run_cmd) VALUES (?, ?, ?, ?, ?)`,
    ).run(projectId, 99999, Date.now(), logPath, 'x');
    const res = projectTailLogs(db, { project_id: projectId, lines: 5 });
    expect(res.lines).toEqual(['line 46', 'line 47', 'line 48', 'line 49', 'line 50']);
  });

  it('returns empty array when no runbook has ever run', () => {
    const res = projectTailLogs(db, { project_id: projectId });
    expect(res.lines).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
pnpm --filter @agent-brain/mcp test -- runbook
```
Expected: 2 new tests FAIL.

- [ ] **Step 3: Implement projectTailLogs**

Append to `packages/mcp/src/tools/runbook.ts`:

```ts
import { existsSync, readFileSync } from 'node:fs';

const TailInput = z.object({
  project_id: z.string().uuid(),
  lines: z.number().int().min(1).max(1000).optional().default(100),
});

export function projectTailLogs(
  db: Database,
  raw: unknown,
): { lines: string[]; path: string | null } {
  const { project_id, lines } = TailInput.parse(raw);

  const row = db
    .prepare('SELECT slug FROM projects WHERE id = ?')
    .get(project_id) as { slug: string } | undefined;
  if (!row) throw new Error(`Project ${project_id} not found`);

  const path = logPathForSlug(row.slug);
  if (!existsSync(path)) return { lines: [], path: null };

  const content = readFileSync(path, 'utf-8');
  const all = content.split('\n');
  // Drop trailing empty line from split
  const nonEmpty = all.length > 0 && all[all.length - 1] === '' ? all.slice(0, -1) : all;
  return { lines: nonEmpty.slice(-lines), path };
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
pnpm --filter @agent-brain/mcp test -- runbook
```
Expected: all runbook tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/mcp/src/tools/runbook.ts packages/mcp/src/tests/tools/runbook.test.ts
git commit -m "feat(mcp): project_tail_logs reads last N log lines"
```

---

## Task 8 — Boot Cleanup of Stale PIDs

**Files:**
- Modify: `packages/mcp/src/tools/runbook.ts`
- Modify: `packages/mcp/src/db/migrate.ts`
- Modify: `packages/mcp/src/tests/tools/runbook.test.ts`

- [ ] **Step 1: Write failing test**

Append to `packages/mcp/src/tests/tools/runbook.test.ts`:

```ts
import { cleanupStaleProcesses } from '../../tools/runbook.js';

describe('cleanupStaleProcesses', () => {
  it('removes rows whose PID is dead, keeps live ones', () => {
    const { db, close } = freshDb();
    const p1 = projectCreate(db, { slug: 'p1', name: 'P1', repoPath: '/tmp' });
    const p2 = projectCreate(db, { slug: 'p2', name: 'P2', repoPath: '/tmp' });

    db.prepare(
      `INSERT INTO running_processes (project_id, pid, started_at, log_path, run_cmd) VALUES (?, ?, ?, ?, ?)`,
    ).run(p1.id, 2147483646, Date.now(), '/tmp/p1.log', 'x');
    db.prepare(
      `INSERT INTO running_processes (project_id, pid, started_at, log_path, run_cmd) VALUES (?, ?, ?, ?, ?)`,
    ).run(p2.id, process.pid, Date.now(), '/tmp/p2.log', 'x');

    const cleaned = cleanupStaleProcesses(db);
    expect(cleaned).toBe(1);

    const rows = db.prepare('SELECT project_id FROM running_processes').all() as Array<{ project_id: string }>;
    expect(rows.map((r) => r.project_id)).toEqual([p2.id]);

    close();
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
pnpm --filter @agent-brain/mcp test -- runbook
```
Expected: FAIL (`cleanupStaleProcesses` not exported).

- [ ] **Step 3: Implement and wire into migrate.ts**

Append to `packages/mcp/src/tools/runbook.ts`:

```ts
export function cleanupStaleProcesses(db: Database): number {
  const rows = db
    .prepare('SELECT project_id, pid FROM running_processes')
    .all() as Array<{ project_id: string; pid: number }>;
  let cleaned = 0;
  for (const row of rows) {
    if (!isAlive(row.pid)) {
      db.prepare('DELETE FROM running_processes WHERE project_id = ?').run(row.project_id);
      cleaned++;
    }
  }
  return cleaned;
}
```

Modify `packages/mcp/src/db/migrate.ts` — add a direct synchronous import at the top:

```ts
import { cleanupStaleProcesses } from '../tools/runbook.js';
```

And at the very end of `applyMigrations`, after `checkChunkConfigVersion(db)`, add:

```ts
  // Runbook: clean stale running_processes entries on boot
  const cleaned = cleanupStaleProcesses(db);
  if (cleaned > 0) console.log(`[runbook] cleaned ${cleaned} stale process entries`);
```

**No async change** — the function stays synchronous, no ripple through callers. If you hit a circular import error (unlikely since `runbook.ts` doesn't import from `migrate.ts`), fall back to calling `cleanupStaleProcesses` from the MCP server startup code (`packages/mcp/src/http/server.ts`) right after `applyMigrations(db)` instead.

- [ ] **Step 4: Run full test suite — expect PASS**

```bash
pnpm --filter @agent-brain/mcp test
```
Expected: all tests PASS. If TypeScript errors about missing `await freshDb()`, fix them inline.

- [ ] **Step 5: Commit**

```bash
git add packages/mcp
git commit -m "feat(mcp): cleanup stale running_processes at boot"
```

---

## Task 9 — Enrich project_list with is_running

**Files:**
- Modify: `packages/mcp/src/tools/projects.ts`
- Modify: `packages/mcp/src/tests/tools/projects.test.ts`

- [ ] **Step 1: Write failing test**

Append to `packages/mcp/src/tests/tools/projects.test.ts`:

```ts
import { projectRun } from '../../tools/runbook.js';
import { projectSetRunbook } from '../../tools/runbook.js';

describe('project_list is_running enrichment', () => {
  it('marks running projects with is_running=true', () => {
    const { db, close } = freshDb();
    const p = projectCreate(db, { slug: 'isrunning', name: 'R', repoPath: '/tmp' });
    projectSetRunbook(db, { project_id: p.id, run_cmd: 'sleep 5' });
    const { pid } = projectRun(db, { project_id: p.id });

    const list = projectList(db, {});
    const row = list.items.find((x: any) => x.id === p.id);
    expect(row.isRunning).toBe(true);

    // Cleanup
    try { process.kill(pid, 'SIGTERM'); } catch {}
    close();
  });

  it('marks non-running projects with is_running=false', () => {
    const { db, close } = freshDb();
    projectCreate(db, { slug: 'noprun', name: 'N', repoPath: '/tmp' });
    const list = projectList(db, {});
    const row = list.items.find((x: any) => x.slug === 'noprun');
    expect(row.isRunning).toBe(false);
    close();
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
pnpm --filter @agent-brain/mcp test -- projects.test
```
Expected: FAIL (`isRunning` undefined).

- [ ] **Step 3: Implement enrichment**

Modify `packages/mcp/src/tools/projects.ts` — rewrite `projectList` to JOIN and to lazily clean stales:

```ts
import { isAlive } from '../runbook/process.js';

export function projectList(db: Database, raw: unknown) {
  const input = ProjectListInput.parse(raw);
  const { limit, offset } = input;

  const rows = db
    .prepare(
      `SELECT p.*, rp.pid AS rp_pid
         FROM projects p
         LEFT JOIN running_processes rp ON rp.project_id = p.id
         ORDER BY p.created_at ASC
         LIMIT ? OFFSET ?`,
    )
    .all(limit, offset) as Array<RawProjectRow & { rp_pid: number | null }>;

  const items = rows.map((row) => {
    let isRunning = row.rp_pid !== null;
    if (isRunning && !isAlive(row.rp_pid!)) {
      db.prepare('DELETE FROM running_processes WHERE project_id = ?').run(row.id);
      isRunning = false;
    }
    return { ...toProject(row), isRunning };
  });

  const total = (db.prepare('SELECT COUNT(*) as c FROM projects').get() as { c: number }).c;
  return { items, total, limit, offset };
}
```

Apply the same enrichment to `projectCreate`/`projectUpdate` return values (just add `isRunning: false` for `create`, and re-query for `update`). For simplicity, set `isRunning: false` on create and compute for update:

In `projectUpdate`, after fetching the final `row`:
```ts
  const running = db
    .prepare('SELECT pid FROM running_processes WHERE project_id = ?')
    .get(id) as { pid: number } | undefined;
  const isRunning = !!running && isAlive(running.pid);
  return { ok: true, id, item: { ...toProject(row), isRunning } };
```

In `projectCreate` return:
```ts
  return { ok: true, id, item: { ...toProject(row), isRunning: false } };
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
pnpm --filter @agent-brain/mcp test -- projects
```
Expected: all projects tests PASS including new ones.

- [ ] **Step 5: Commit**

```bash
git add packages/mcp/src/tools/projects.ts packages/mcp/src/tests/tools/projects.test.ts
git commit -m "feat(mcp): project_list / project_update expose isRunning"
```

---

## Task 10 — Register Runbook Tools in MCP Server

**Files:**
- Modify: `packages/mcp/src/tools/index.ts`
- Modify: `packages/mcp/src/tests/tools/register.test.ts`

- [ ] **Step 1: Write failing test**

In `packages/mcp/src/tests/tools/register.test.ts`, add expected tool names. (Read the existing test first to match style.) Example addition:

```ts
it('registers runbook tools', () => {
  // Collect names registered — adapt to the actual harness pattern already in use
  const names = getRegisteredToolNames();
  expect(names).toContain('project_get_runbook');
  expect(names).toContain('project_set_runbook');
  expect(names).toContain('project_run');
  expect(names).toContain('project_stop');
  expect(names).toContain('project_tail_logs');
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
pnpm --filter @agent-brain/mcp test -- register
```
Expected: FAIL.

- [ ] **Step 3: Register tools**

In `packages/mcp/src/tools/index.ts`, add import at top:

```ts
import {
  projectGetRunbook,
  projectSetRunbook,
  projectRun,
  projectStop,
  projectTailLogs,
} from './runbook.js';
```

Then, after the existing project tools registration block, add:

```ts
  server.tool(
    'project_get_runbook',
    'Get the runbook (run_cmd, url, env, is_running) for a project',
    { project_id: z.string() },
    async (params) => {
      const result = projectGetRunbook(db, params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  server.tool(
    'project_set_runbook',
    'Set or clear runbook fields (pass null to clear a field)',
    {
      project_id: z.string(),
      run_cmd: z.string().nullable().optional(),
      run_cwd: z.string().nullable().optional(),
      url: z.string().nullable().optional(),
      env: z.record(z.string(), z.string()).nullable().optional(),
    },
    async (params) => {
      const result = projectSetRunbook(db, params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  server.tool(
    'project_run',
    'Launch the project runbook as a detached process',
    { project_id: z.string() },
    async (params) => {
      const result = projectRun(db, params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  server.tool(
    'project_stop',
    'Stop the running process for a project (SIGTERM, SIGKILL if force=true)',
    { project_id: z.string(), force: z.boolean().optional() },
    async (params) => {
      const result = projectStop(db, params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  server.tool(
    'project_tail_logs',
    'Return the last N lines of the project run log',
    { project_id: z.string(), lines: z.number().optional() },
    async (params) => {
      const result = projectTailLogs(db, params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
pnpm --filter @agent-brain/mcp test
```
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/mcp/src/tools/index.ts packages/mcp/src/tests/tools/register.test.ts
git commit -m "feat(mcp): register runbook tools on MCP server"
```

---

## Task 11 — TUI Global Config Reader

**Files:**
- Create: `packages/tui/src/api/config.ts`

- [ ] **Step 1: Implement config reader**

Create `packages/tui/src/api/config.ts`:

```ts
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

interface GerberConfig {
  streamable_token?: string;
  editor_cmd?: string;
}

const DEFAULT_EDITOR = 'zed .';

let cached: GerberConfig | null = null;

function load(): GerberConfig {
  if (cached) return cached;
  const path = join(homedir(), '.config', 'gerber', 'config.json');
  if (!existsSync(path)) {
    cached = {};
    return cached;
  }
  try {
    cached = JSON.parse(readFileSync(path, 'utf-8')) as GerberConfig;
  } catch {
    cached = {};
  }
  return cached;
}

export function getEditorCmd(): string {
  return load().editor_cmd ?? DEFAULT_EDITOR;
}
```

- [ ] **Step 2: Smoke test manually**

```bash
pnpm --filter @agent-brain/tui build
```
Expected: SUCCESS.

- [ ] **Step 3: Commit**

```bash
git add packages/tui/src/api/config.ts
git commit -m "feat(tui): global config reader (editor_cmd)"
```

---

## Task 12 — TUI Runbook API Client

**Files:**
- Create: `packages/tui/src/api/runbook.ts`

- [ ] **Step 1: Implement client**

Create `packages/tui/src/api/runbook.ts`:

```ts
import { mcpCall } from '../client.js';

export interface RunbookData {
  run_cmd: string | null;
  run_cwd: string | null;
  url: string | null;
  env: Record<string, string> | null;
  is_running: boolean;
  pid?: number;
  started_at?: number;
  log_path?: string;
}

export function getRunbook(projectId: string) {
  return mcpCall<RunbookData>('project_get_runbook', { project_id: projectId });
}

export function setRunbook(
  projectId: string,
  fields: Partial<Pick<RunbookData, 'run_cmd' | 'run_cwd' | 'url' | 'env'>>,
) {
  return mcpCall<{ ok: true }>('project_set_runbook', { project_id: projectId, ...fields });
}

export function runProject(projectId: string) {
  return mcpCall<{ ok: true; pid: number; log_path: string; url: string | null }>(
    'project_run',
    { project_id: projectId },
  );
}

export function stopProject(projectId: string, force = false) {
  return mcpCall<{ ok: true }>('project_stop', { project_id: projectId, force });
}

export function tailLogs(projectId: string, lines = 100) {
  return mcpCall<{ lines: string[]; path: string | null }>('project_tail_logs', {
    project_id: projectId,
    lines,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/tui/src/api/runbook.ts
git commit -m "feat(tui): runbook API client"
```

---

## Task 13 — TUI Nav: Add `runbook` Screen

**Files:**
- Modify: `packages/tui/src/components/nav.tsx`

- [ ] **Step 1: Extend ProjectScreen type and nav render**

In `packages/tui/src/components/nav.tsx`:
- Change type `ProjectScreen = 'tasks' | 'issues' | 'notes'` → `'runbook' | 'tasks' | 'issues' | 'notes'`
- In the render section of project nav, insert **before** the `tasks` NavItem:

```tsx
<NavItem shortcut="r" label="runbook" active={current === 'runbook'} />
<Text dimColor>|</Text>
```

- [ ] **Step 2: Build**

```bash
pnpm --filter @agent-brain/tui build
```
Expected: SUCCESS.

- [ ] **Step 3: Commit**

```bash
git add packages/tui/src/components/nav.tsx
git commit -m "feat(tui): add runbook to project nav"
```

---

## Task 14 — TUI Runbook Screen (Display + Status)

**Files:**
- Create: `packages/tui/src/screens/runbook.tsx`
- Modify: `packages/tui/src/app.tsx`

- [ ] **Step 1: Create runbook screen (display only, no actions yet)**

Create `packages/tui/src/screens/runbook.tsx`:

```tsx
import React from 'react';
import { Box, Text } from 'ink';
import { Spinner } from '../components/spinner.js';
import { useData } from '../hooks/use-data.js';
import { getRunbook, type RunbookData } from '../api/runbook.js';

interface Props {
  projectId: string;
}

export function Runbook({ projectId }: Props) {
  const rb = useData<RunbookData>(() => getRunbook(projectId));

  if (rb.loading) return <Spinner label="Loading runbook..." />;
  if (rb.error) return <Text color="red">Error: {rb.error.message}</Text>;
  const data = rb.data!;

  if (!data.run_cmd) {
    return (
      <Box flexDirection="column" paddingX={2}>
        <Text dimColor>No runbook configured.</Text>
        <Text dimColor>Run /gerber:runbook in Claude Code, or press [E] to add manually.</Text>
        <Box marginTop={1}><Text>  [O]pen in editor    [E]dit</Text></Box>
      </Box>
    );
  }

  const status = data.is_running
    ? <Text color="green">● running (PID {data.pid})</Text>
    : <Text dimColor>○ stopped</Text>;

  return (
    <Box flexDirection="column" paddingX={2}>
      <Box><Text bold>  Status    </Text>{status}</Box>
      {data.url && <Box><Text bold>  URL       </Text><Text color="cyan">{data.url}</Text><Text dimColor>                      [C]opy  [W]eb</Text></Box>}
      <Box><Text bold>  Command   </Text><Text>{data.run_cmd}</Text></Box>
      <Box><Text bold>  CWD       </Text><Text dimColor>{data.run_cwd ?? '(repo root)'}</Text></Box>
      {data.env && Object.keys(data.env).length > 0 && (
        <Box><Text bold>  Env       </Text><Text dimColor>{Object.entries(data.env).map(([k,v]) => `${k}=${v}`).join(' ')}</Text></Box>
      )}
      <Box marginTop={1}>
        <Text dimColor>  [O]pen in editor   [R]un   [S]top   [L]ogs   [E]dit</Text>
      </Box>
    </Box>
  );
}
```

- [ ] **Step 2: Wire into app.tsx**

Modify `packages/tui/src/app.tsx`:
- Add import: `import { Runbook } from './screens/runbook.js';`
- Change default screen when opening a project:
  ```ts
  const handleOpenProject = (project: ActiveProject) => {
    setActiveProject(project);
    setProjectScreen('runbook');  // was 'tasks'
  };
  ```
- In the shortcut switch, add case for `'r'` **before** the existing cases:
  ```ts
  case 'r': setProjectScreen('runbook'); return;
  ```
- In the render block, add case:
  ```tsx
  {projectScreen === 'runbook' && <Runbook projectId={activeProject.id} />}
  ```

- [ ] **Step 3: Build and smoke test**

```bash
pnpm --filter @agent-brain/tui build
pnpm --filter @agent-brain/tui dev
```
Expected: TUI opens, navigating into a project shows the runbook screen.

- [ ] **Step 4: Commit**

```bash
git add packages/tui/src/screens/runbook.tsx packages/tui/src/app.tsx
git commit -m "feat(tui): runbook screen (display + status)"
```

---

## Task 15 — TUI Runbook Actions ([R]un / [S]top / [O]pen / [C]opy / [W]eb)

**Files:**
- Modify: `packages/tui/src/screens/runbook.tsx`

- [ ] **Step 1: Add actions**

Update `packages/tui/src/screens/runbook.tsx` — replace the component with:

```tsx
import React, { useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import { spawn } from 'node:child_process';
import { Spinner } from '../components/spinner.js';
import { useData } from '../hooks/use-data.js';
import { getRunbook, runProject, stopProject, type RunbookData } from '../api/runbook.js';
import { getEditorCmd } from '../api/config.js';

interface Props {
  projectId: string;
  repoPath: string | null;
}

export function Runbook({ projectId, repoPath }: Props) {
  const rb = useData<RunbookData>(() => getRunbook(projectId));

  const openEditor = useCallback(() => {
    if (!repoPath) return;
    const cmd = getEditorCmd();
    spawn('sh', ['-c', cmd], { cwd: repoPath, detached: true, stdio: 'ignore' }).unref();
  }, [repoPath]);

  const doRun = useCallback(async () => {
    try {
      await runProject(projectId);
      rb.refetch();
    } catch {
      // Surface via future toast; for now, ignore and re-fetch
      rb.refetch();
    }
  }, [projectId, rb]);

  const doStop = useCallback(async () => {
    try {
      await stopProject(projectId);
      rb.refetch();
    } catch {
      rb.refetch();
    }
  }, [projectId, rb]);

  const copyUrl = useCallback(() => {
    if (!rb.data?.url) return;
    const p = spawn('pbcopy');
    p.stdin.write(rb.data.url);
    p.stdin.end();
  }, [rb.data?.url]);

  const openWeb = useCallback(() => {
    if (!rb.data?.url) return;
    spawn('open', [rb.data.url], { detached: true, stdio: 'ignore' }).unref();
  }, [rb.data?.url]);

  useInput((input) => {
    if (input === 'o') openEditor();
    if (input === 'R') return; // ignore uppercase
    if (input === 'S') return;
    if (input === 'c') copyUrl();
    if (input === 'w') openWeb();
    // Note: [r] is taken by project nav switch — use capital [R]? Re-use "g" to "go / run"?
    // Decision: use SHIFT-binding via 'g' for run, '.' for stop to avoid nav conflict
    if (input === 'g') doRun();
    if (input === '.') doStop();
  });

  if (rb.loading) return <Spinner label="Loading runbook..." />;
  if (rb.error) return <Text color="red">Error: {rb.error.message}</Text>;
  const data = rb.data!;

  if (!data.run_cmd) {
    return (
      <Box flexDirection="column" paddingX={2}>
        <Text dimColor>No runbook configured.</Text>
        <Text dimColor>Run /gerber:runbook in Claude Code, or press [E] to add manually.</Text>
        <Box marginTop={1}><Text>  [O]pen in editor    [E]dit</Text></Box>
      </Box>
    );
  }

  const status = data.is_running
    ? <Text color="green">● running (PID {data.pid})</Text>
    : <Text dimColor>○ stopped</Text>;

  return (
    <Box flexDirection="column" paddingX={2}>
      <Box><Text bold>  Status    </Text>{status}</Box>
      {data.url && <Box><Text bold>  URL       </Text><Text color="cyan">{data.url}</Text></Box>}
      <Box><Text bold>  Command   </Text><Text>{data.run_cmd}</Text></Box>
      <Box><Text bold>  CWD       </Text><Text dimColor>{data.run_cwd ?? '(repo root)'}</Text></Box>
      {data.env && Object.keys(data.env).length > 0 && (
        <Box><Text bold>  Env       </Text><Text dimColor>{Object.entries(data.env).map(([k,v]) => `${k}=${v}`).join(' ')}</Text></Box>
      )}
      <Box marginTop={1}>
        <Text dimColor>  [O]pen   [g]o/run   [.]stop   [C]opy URL   [W]eb   [L]ogs   [E]dit</Text>
      </Box>
    </Box>
  );
}
```

Also update `packages/tui/src/app.tsx` to pass `repoPath`:
```tsx
{projectScreen === 'runbook' && <Runbook projectId={activeProject.id} repoPath={activeProject.repoPath} />}
```

And ensure `ActiveProject` in `home.tsx` includes `repoPath: string | null` — check and add if missing.

- [ ] **Step 2: Build**

```bash
pnpm --filter @agent-brain/tui build
```
Expected: SUCCESS.

- [ ] **Step 3: Manual smoke test**

```bash
pnpm --filter @agent-brain/tui dev
```
Steps: pick a project with a runbook (set one via MCP CLI first), press `g` → process starts, `.` → process stops.

- [ ] **Step 4: Commit**

```bash
git add packages/tui
git commit -m "feat(tui): runbook actions (run/stop/open-editor/copy/web)"
```

---

## Task 16 — TUI Runbook Edit Form

**Files:**
- Create: `packages/tui/src/screens/runbook-edit.tsx`
- Modify: `packages/tui/src/screens/runbook.tsx`

- [ ] **Step 1: Create edit form**

Create `packages/tui/src/screens/runbook-edit.tsx`:

```tsx
import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { setRunbook, type RunbookData } from '../api/runbook.js';

interface Props {
  projectId: string;
  initial: RunbookData;
  onDone: () => void;
}

type Field = 'run_cmd' | 'url' | 'run_cwd' | 'env';

export function RunbookEdit({ projectId, initial, onDone }: Props) {
  const [field, setField] = useState<Field>('run_cmd');
  const [runCmd, setRunCmd] = useState(initial.run_cmd ?? '');
  const [url, setUrl] = useState(initial.url ?? '');
  const [runCwd, setRunCwd] = useState(initial.run_cwd ?? '');
  const [env, setEnv] = useState(
    initial.env ? Object.entries(initial.env).map(([k, v]) => `${k}=${v}`).join('\n') : '',
  );
  const [error, setError] = useState<string | null>(null);

  useInput(async (input, key) => {
    if (key.escape) { onDone(); return; }
    if (key.tab) {
      const order: Field[] = ['run_cmd', 'url', 'run_cwd', 'env'];
      setField(order[(order.indexOf(field) + 1) % order.length]);
      return;
    }
    if (key.ctrl && input === 's') {
      try {
        const envObj: Record<string, string> = {};
        for (const line of env.split('\n').filter((l) => l.trim())) {
          const [k, ...rest] = line.split('=');
          if (!k) continue;
          envObj[k.trim()] = rest.join('=').trim();
        }
        await setRunbook(projectId, {
          run_cmd: runCmd || null,
          url: url || null,
          run_cwd: runCwd || null,
          env: Object.keys(envObj).length ? envObj : null,
        });
        onDone();
      } catch (e: any) {
        setError(e.message ?? String(e));
      }
    }
  });

  return (
    <Box flexDirection="column" paddingX={2}>
      <Text bold>Edit runbook (Tab = next field, Ctrl+S = save, Esc = cancel)</Text>
      <Box marginTop={1} flexDirection="column">
        <Box>
          <Text color={field === 'run_cmd' ? 'cyan' : undefined}>Command  </Text>
          {field === 'run_cmd' ? <TextInput value={runCmd} onChange={setRunCmd} /> : <Text>{runCmd}</Text>}
        </Box>
        <Box>
          <Text color={field === 'url' ? 'cyan' : undefined}>URL      </Text>
          {field === 'url' ? <TextInput value={url} onChange={setUrl} /> : <Text>{url}</Text>}
        </Box>
        <Box>
          <Text color={field === 'run_cwd' ? 'cyan' : undefined}>CWD      </Text>
          {field === 'run_cwd' ? <TextInput value={runCwd} onChange={setRunCwd} /> : <Text>{runCwd}</Text>}
        </Box>
        <Box>
          <Text color={field === 'env' ? 'cyan' : undefined}>Env      </Text>
          {field === 'env' ? <TextInput value={env} onChange={setEnv} /> : <Text>{env}</Text>}
        </Box>
      </Box>
      {error && <Text color="red">Error: {error}</Text>}
    </Box>
  );
}
```

- [ ] **Step 2: Verify `ink-text-input` is installed**

```bash
pnpm --filter @agent-brain/tui list ink-text-input 2>/dev/null | head -5
```
If missing:
```bash
pnpm --filter @agent-brain/tui add ink-text-input
```

- [ ] **Step 3: Wire into runbook.tsx**

Modify `packages/tui/src/screens/runbook.tsx` — add `editing` state and `[e]` shortcut:

```tsx
import { RunbookEdit } from './runbook-edit.js';

// ... inside component:
const [editing, setEditing] = useState(false);

useInput((input) => {
  if (editing) return; // child handles input
  // ... existing handlers ...
  if (input === 'e') setEditing(true);
});

if (editing && rb.data) {
  return <RunbookEdit projectId={projectId} initial={rb.data} onDone={() => { setEditing(false); rb.refetch(); }} />;
}
```

- [ ] **Step 4: Build and smoke test**

```bash
pnpm --filter @agent-brain/tui build
```
Expected: SUCCESS. Manual test: press `e`, edit fields with Tab, Ctrl+S saves.

- [ ] **Step 5: Commit**

```bash
git add packages/tui
git commit -m "feat(tui): runbook edit form (inline)"
```

---

## Task 17 — TUI Log Tail Overlay

**Files:**
- Create: `packages/tui/src/screens/runbook-logs.tsx`
- Modify: `packages/tui/src/screens/runbook.tsx`

- [ ] **Step 1: Create overlay**

Create `packages/tui/src/screens/runbook-logs.tsx`:

```tsx
import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { tailLogs } from '../api/runbook.js';

interface Props {
  projectId: string;
  onClose: () => void;
}

export function RunbookLogs({ projectId, onClose }: Props) {
  const [lines, setLines] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await tailLogs(projectId, 200);
        if (!cancelled) setLines(res.lines);
      } catch (e: any) {
        if (!cancelled) setError(e.message ?? String(e));
      }
    };
    poll();
    const id = setInterval(poll, 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, [projectId]);

  useInput((_, key) => {
    if (key.escape) onClose();
  });

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold>Logs — Esc to close (refresh every 1s)</Text>
      {error && <Text color="red">Error: {error}</Text>}
      <Box flexDirection="column" marginTop={1}>
        {lines.map((l, i) => <Text key={i}>{l}</Text>)}
      </Box>
    </Box>
  );
}
```

- [ ] **Step 2: Wire into runbook.tsx**

In `packages/tui/src/screens/runbook.tsx`:
- Import: `import { RunbookLogs } from './runbook-logs.js';`
- Add state: `const [viewingLogs, setViewingLogs] = useState(false);`
- Add to `useInput`: `if (input === 'l') setViewingLogs(true);`
- Add render branch (before editing branch):
  ```tsx
  if (viewingLogs) return <RunbookLogs projectId={projectId} onClose={() => setViewingLogs(false)} />;
  ```

- [ ] **Step 3: Build**

```bash
pnpm --filter @agent-brain/tui build
```
Expected: SUCCESS.

- [ ] **Step 4: Commit**

```bash
git add packages/tui
git commit -m "feat(tui): runbook log tail overlay"
```

---

## Task 18 — TUI Home: Running Indicator

**Files:**
- Modify: `packages/tui/src/screens/home.tsx`

- [ ] **Step 1: Show `●` prefix for running projects**

In `packages/tui/src/screens/home.tsx`, find where each project row is rendered. Before the project name, prepend:

```tsx
{p.isRunning ? <Text color="green">● </Text> : <Text>  </Text>}
```

The `isRunning` field comes from `project_list` (task 9). Ensure `listProjects` typing includes it — extend `Project` interface in `@agent-brain/shared` if necessary, or cast locally.

Add to `packages/shared/src/types.ts` (if `Project` exists there, extend; otherwise add):
```ts
export interface Project {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  repoPath: string | null;
  color: string | null;
  runCmd: string | null;
  runCwd: string | null;
  url: string | null;
  env: Record<string, string> | null;
  createdAt: number;
  updatedAt: number;
  isRunning: boolean;
}
```

- [ ] **Step 2: Build and smoke test**

```bash
pnpm --filter @agent-brain/tui build
```

Manual: open TUI, start a project via `g` on runbook screen, return to home (`h`), confirm `●` appears.

- [ ] **Step 3: Commit**

```bash
git add packages/tui packages/shared
git commit -m "feat(tui): running indicator on home project list"
```

---

## Task 19 — Skill `/gerber:runbook`

**Files:**
- Create: `skills/runbook/SKILL.md`

- [ ] **Step 1: Create skill file**

Create `skills/runbook/SKILL.md`:

```markdown
---
name: runbook
description: "Create or update a project runbook (run_cmd, url, env) by reading the repo stack."
user-invocable: true
---

# /gerber:runbook — Compose project runbook

## Role

Tu es un **technicien onboarding**. Ton job : lire un repo et composer un runbook minimal (commande de lancement, URL attendue, env) pour qu'il puisse etre lance en un appui de touche depuis la TUI gerber.

## Invocation

```
/gerber:runbook [slug]
```

`slug` optionnel — si absent, tu cherches le projet dont `repoPath` correspond au cwd.

## Procedure

### 1. Resoudre le projet

Appelle `project_list` via le MCP gerber. Filtre par slug (si fourni) ou par `repoPath` matching le cwd. Si ambigu ou introuvable, demande a Romain.

### 2. Lire la stack

Lis (selon ce qui existe) :

- `package.json` → `scripts.dev`, `scripts.start`, `scripts.serve`, `packageManager`
- `Cargo.toml` → `[[bin]]`, `default-run`
- `pyproject.toml` / `uv.lock` → `[project.scripts]`, `tool.uv`
- `docker-compose.yml` → services + ports
- `pnpm-workspace.yaml` / `turbo.json` / `lerna.json` → detecter monorepo

Ne lis **pas** tout le repo — juste les fichiers ci-dessus + un README si vraiment utile.

### 3. Identifier l'URL

- `vite.config.*` → `server.port` (defaut 5173)
- `next.config.*` → env PORT ou 3000
- `package.json` scripts → flags `--port`
- Fallback : laisse `url` null

### 4. Composer la commande

- Single service → directe (`pnpm dev`, `cargo run`, `uv run app.py`)
- Monorepo multi-services → propose `concurrently -n a,b -c blue,magenta "cmd1" "cmd2"`
- Python venv → `uv run ...` ou `.venv/bin/python ...`

Utilise le package manager declare (`packageManager` field) : pnpm, bun, ou npm. Jamais yarn sans evidence explicite.

### 5. Presenter le runbook propose

Montre a Romain ton proposal sous forme de diff par rapport au runbook actuel (ou vide si nouveau) :

```
run_cmd : pnpm --filter @agent-brain/ui dev
url     : http://localhost:5173
run_cwd : (vide = repo root)
env     : (aucun)
```

Demande confirmation.

### 6. Ecrire via MCP

Appelle `project_set_runbook` avec les champs valides.

### 7. Resumer en une ligne

> Runbook ecrit pour `<slug>`. Lance-le depuis la TUI : Home → projet → [g]o.

## Cas limites

- **Repo sans package manager detecte** : demande a Romain la commande manuelle
- **Monorepo complexe** : propose une commande `concurrently` nommee, demande validation fine
- **Port introuvable** : laisse `url` null plutot que d'inventer
- **Projet non indexe dans gerber** : redirige vers `/gerber:onboarding` d'abord

## Ne fais pas

- N'invente pas de port
- Ne prends pas `start` si `dev` existe (le dev UX est prioritaire)
- Ne touche pas a `.env` / `.env.local` — utilise uniquement le champ `env` du runbook
- Ne lance pas le projet — ton job s'arrete a l'ecriture du runbook
```

- [ ] **Step 2: Verify plugin loads skill**

Restart Claude Code / reload plugin. In a new session, check that `/gerber:runbook` appears in the available skills list.

- [ ] **Step 3: Commit**

```bash
git add skills/runbook/SKILL.md
git commit -m "feat(skills): /gerber:runbook — compose project runbook from repo"
```

---

## Task 20 — Bump Plugin Version + Update CLAUDE.md

**Files:**
- Modify: `.claude-plugin/plugin.json`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Bump version**

Change `.claude-plugin/plugin.json` line 4:
```json
  "version": "1.3.0",
```

- [ ] **Step 2: Update CLAUDE.md**

In `CLAUDE.md`, add to the "Skills disponibles" list:
```
- `/gerber:runbook` — composer le runbook d'un projet (run_cmd, url, env) depuis la stack du repo
```

Add a line under "Gotchas" or create a new small section:
```
| 18 | Les colonnes runbook (`run_cmd`, `run_cwd`, `url`, `env_json`) vivent sur `projects`. Table `running_processes` pour le PID detache, nettoyee au boot via `cleanupStaleProcesses` | `tools/runbook.ts`, `db/migrate.ts` |
```

- [ ] **Step 3: Run full test suite**

```bash
pnpm test && pnpm typecheck && pnpm build
```
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add .claude-plugin/plugin.json CLAUDE.md
git commit -m "chore(release): bump plugin to 1.3.0 — project runbook feature"
```

---

## Final Verification

- [ ] Run full CI-equivalent:
  ```bash
  pnpm test && pnpm typecheck && pnpm build
  ```
- [ ] Manual E2E on `agent-brain` itself:
  1. In Claude Code: `/gerber:runbook` → validates, writes runbook
  2. In TUI: open `agent-brain`, see runbook screen → press `g` → process starts
  3. Close TUI → verify `pgrep -f "pnpm"` shows the process alive
  4. Reopen TUI → home shows `●` next to `agent-brain`; runbook shows `● running`
  5. Press `l` → logs stream in
  6. Press `.` → process stops, row cleaned
  7. Kill -9 the PID manually, restart MCP server → stale entry cleaned at boot
- [ ] Use `superpowers:finishing-a-development-branch` to decide merge strategy
