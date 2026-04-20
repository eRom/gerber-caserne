# Project Runbook — Design Spec

**Date** : 2026-04-20
**Status** : Approved, ready for implementation plan
**Target version** : plugin `1.3.0`

---

## Problem

Managing ~80 projects in `~/dev` is slow: finding the right folder, opening it in an editor, discovering the right run command (`npm run dev` vs `start` vs `pnpm dev` vs `cargo run`), fighting port collisions, hunting for the URL in logs. Every project has a recipe; none of it is captured anywhere.

**Goal** : store a minimal "runbook" per project in gerber (command to run, URL to hit, optional env/cwd). Expose actions from the TUI (open editor, run, stop, view logs). Let a Claude skill auto-populate the runbook by reading the repo.

## Non-goals (v1)

- Multiple services per project (user composes via `concurrently` manually)
- HTTP health checks or port-conflict detection (let the command crash, user sees it)
- Structured log format / log rotation (plain file, append-only)
- Per-project editor override (global config only)
- Impact on `packages/admin` (manages gerber's own MCP+tunnel, orthogonal to this feature)

---

## Architecture

Four layers, existing patterns reused:

1. **DB** — extend `projects` with 4 columns + new `running_processes` table
2. **MCP tools** — new CRUD tools for runbook, enrich `project_list`/`project_get` with `is_running`, new `project_run`/`project_stop`/`project_tail_logs`
3. **TUI** — new `runbook` screen added to the project nav (`runbook | tasks | issues | notes`), `●` indicator on home list
4. **Skill** — `skills/runbook/SKILL.md` (invoked as `/gerber:runbook`) reads repo and calls `project_set_runbook`

### Data flow

```
User in Claude Code:
  /gerber:runbook
    → Claude reads package.json / Cargo.toml / etc.
    → Claude calls project_set_runbook(id, {run_cmd, url, ...})
    → DB updated

User in TUI:
  Select project → press [R]un on runbook screen
    → TUI calls project_run via MCP
    → MCP spawns detached process, writes to ~/.local/state/gerber/runs/<slug>.log
    → INSERT running_processes
    → TUI shows ● running + URL

User closes TUI:
  Process keeps running (detached)

User reopens TUI:
  project_list returns is_running=true for live PIDs
  Stale PIDs auto-cleaned at MCP boot
```

---

## DB Schema

**Migration** : `packages/mcp/src/db/migrations/0004_runbook.sql`

```sql
-- Extend projects with runbook fields
ALTER TABLE projects ADD COLUMN run_cmd  TEXT;
ALTER TABLE projects ADD COLUMN run_cwd  TEXT;   -- relative to repo_path, null = repo_path
ALTER TABLE projects ADD COLUMN url      TEXT;   -- e.g. "http://localhost:5173"
ALTER TABLE projects ADD COLUMN env_json TEXT;   -- JSON object of env overrides

-- Track detached processes launched via project_run
CREATE TABLE running_processes (
  project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  pid        INTEGER NOT NULL,
  started_at INTEGER NOT NULL,
  log_path   TEXT    NOT NULL,
  run_cmd    TEXT    NOT NULL          -- snapshot of command as launched
);
```

**Drizzle schema** : mirror the above in `packages/shared/src/db/schema.ts`. Update `toProject()` helper in `packages/mcp/src/tools/projects.ts` to map new columns.

**Constraints** :
- PK on `project_id` in `running_processes` → one run per project at a time. Second run attempt returns error `already_running`.
- `env_json` stored as text, parsed/stringified at Zod layer.

---

## MCP Tools

New file : `packages/mcp/src/tools/runbook.ts`

### `project_get_runbook`

**Input** : `{ project_id: uuid }`
**Output** :
```ts
{
  run_cmd: string | null,
  run_cwd: string | null,
  url: string | null,
  env: Record<string, string> | null,
  is_running: boolean,
  pid?: number,
  started_at?: number,
  log_path?: string,
}
```

### `project_set_runbook`

**Input** :
```ts
{
  project_id: uuid,
  run_cmd?: string | null,      // null clears
  run_cwd?: string | null,
  url?: string | null,
  env?: Record<string, string> | null,
}
```
**Output** : `{ ok: true, item: ProjectRow }`

**Validation** (Zod) :
- `run_cmd` max 2000 chars, trimmed
- `run_cwd` must be relative (no `/`, no `..` traversal)
- `url` loose check (`string().url()` OR starts with `http://localhost` / `http://127.`)
- `env` keys match `^[A-Z_][A-Z0-9_]*$`

### `project_run`

**Input** : `{ project_id: uuid }`
**Output** : `{ ok: true, pid: number, log_path: string, url: string | null }`
**Errors** :
- `already_running` if row exists in `running_processes`
- `no_runbook` if `run_cmd` empty
- `no_repo_path` if `projects.repo_path` null

**Behavior** :
1. Resolve cwd = `repo_path` + `run_cwd` (if set)
2. Resolve env = `{ ...process.env, ...env_json }`
3. Resolve log path = `~/.local/state/gerber/runs/<slug>.log` (truncate on each run)
4. `spawn('sh', ['-c', run_cmd], { cwd, env, detached: true, stdio: ['ignore', logFd, logFd] })`
5. `child.unref()`
6. `INSERT INTO running_processes`
7. Return `{ pid, log_path, url }`

### `project_stop`

**Input** : `{ project_id: uuid, force?: boolean }`
**Output** : `{ ok: true }`
**Errors** : `not_running` if no row

**Behavior** :
1. `process.kill(pid, force ? 'SIGKILL' : 'SIGTERM')`
2. `DELETE FROM running_processes WHERE project_id = ?`
3. If `SIGTERM` and process still alive after 5s → escalate `SIGKILL` (async, fire-and-forget)

### `project_tail_logs`

**Input** : `{ project_id: uuid, lines?: number = 100 }`
**Output** : `{ lines: string[], path: string }`
**Behavior** : read last N lines from log file (stream-reverse, not `fs.readFileSync`).

### Enriched existing tools

`project_list` and `project_get` → add `is_running: boolean` computed via LEFT JOIN on `running_processes` with lazy `kill -0` verification. If PID is stale (kill -0 throws `ESRCH`), delete the row and return `false`.

### Boot cleanup

On MCP server start, iterate `running_processes`, `kill -0` each PID, delete stale rows. Logged as `[runbook] cleaned N stale entries`.

### Security note

`run_cmd` runs via `sh -c`, full shell semantics. User writes their own runbooks — no sandbox. Document explicitly in skill and in contracts.ts comment.

---

## TUI

### Navigation

Project navbar extended : `runbook | tasks | issues | notes` (runbook first).

`Enter` on a project in home → opens runbook screen by default (not tasks).

### Home indicator

`project_list` now returns `is_running`. Home list prefixes each project with `● ` (green) if running, space otherwise. No other change to home.

### Runbook screen

New file : `packages/tui/src/screens/runbook.tsx`

Layout :
```
gerber | buck-writer-app                  runbook | tasks | issues | notes

  Status    ● running (PID 34521, started 2m ago)
  URL       http://localhost:5173                          [C]opy  [W]eb
  Command   pnpm --filter @agent-brain/ui dev
  CWD       (repo root)
  Env       PORT=3001

  ──────── Last 20 log lines ────────
  [vite] dev server running at http://localhost:5173
  [vite] ready in 312ms
  ...

  [O]pen in editor   [R]un   [S]top   [L]ogs (full)   [E]dit
```

**States** :
- **No runbook** : `No runbook configured. Run /gerber:runbook in Claude Code, or press [E] to add manually.` Actions : `[O]`, `[E]`.
- **Runbook, stopped** : Status = `○ stopped`. Actions : `[O]`, `[R]`, `[E]`.
- **Running** : Status = `● running` (green). Actions : `[O]`, `[S]`, `[L]`, `[E]`. `[R]` grayed.

**Key bindings** :
- `o` → spawn `editor_cmd` (from global config) with cwd = `repo_path`, fire-and-forget
- `r` → call `project_run`, refresh
- `s` → call `project_stop`, refresh
- `l` → push full-screen log overlay (below)
- `e` → inline edit form (below)
- `c` → copy URL to clipboard (via `pbcopy` spawn)
- `w` → `open <url>` (macOS)

### Log overlay (`[L]ogs`)

Full-screen tail view. Implementation : `fs.watch(log_path)` + incremental read of file size delta. `Esc` closes. Auto-scroll to bottom. No pause/search in v1.

### Edit form (`[E]dit`)

Inline form with 4 fields (run_cmd, cwd, url, env as `KEY=VALUE` lines). `Ctrl+S` saves via `project_set_runbook`. `Esc` cancels.

### Global config

Read at TUI boot from `~/.config/gerber/config.json` :
```json
{
  "streamable_token": "...",    // existing
  "editor_cmd": "zed ."         // new, default if absent
}
```

Helper `getEditorCmd()` in `packages/tui/src/api/config.ts` (new file or extend existing config reader).

---

## Skill

New file : `skills/runbook/SKILL.md`

Frontmatter :
```yaml
---
name: runbook
description: "Create or update a project runbook (run_cmd, url, env) by reading the repo."
user-invocable: true
---
```

Invocation : `/gerber:runbook [slug]` (default = project matching cwd).

### Procedure

1. **Resolve project** : call `project_list`, filter by slug arg OR by `repo_path` matching cwd. If ambiguous → ask user.
2. **Read the stack** :
   - `package.json` → `scripts.dev`, `scripts.start`, `scripts.serve`, `packageManager`
   - `Cargo.toml` → `[[bin]]` + `default-run`
   - `pyproject.toml` / `uv.lock` → `[project.scripts]`
   - `docker-compose.yml` → services, ports
   - Monorepo detect : `pnpm-workspace.yaml`, `lerna.json`, `turbo.json`
3. **Identify URL** :
   - `vite.config.*` → `server.port` (default 5173)
   - `next.config.*` → PORT env or 3000
   - `package.json` scripts → scan for `--port` flags
   - Fallback : leave `url` null
4. **Compose runbook** :
   - Single service → direct command (`pnpm dev`)
   - Multi-service monorepo → propose `concurrently -n a,b -c blue,magenta "cmd1" "cmd2"`
   - Python venv → `uv run ...` or `.venv/bin/python ...`
5. **Show proposal to user**, get confirmation
6. **Call `project_set_runbook`** with validated fields
7. **Confirm success** with a one-line summary

### Heuristic notes

- Prefer `dev` script over `start` (interactive dev UX)
- If `packageManager` is `pnpm@x.y`, use `pnpm`; if `bun@x.y`, use `bun`; else `npm run`
- Never invent ports — if undetected, leave `url` null

---

## Tests

### Unit (`packages/mcp/tests/`)

- `runbook.test.ts` — set/get/null-clear, Zod validation (run_cmd length, cwd traversal, env key regex)
- `running-processes.test.ts` — INSERT at run, DELETE at stop, boot cleanup with mocked `process.kill(pid, 0)` throwing `ESRCH`
- `project-list-running.test.ts` — `is_running` JOIN + lazy stale cleanup

### Integration

- `project_run` with `run_cmd = "sleep 30"` → verify PID alive, DB row, log file created
- `project_stop` → SIGTERM sent, row removed
- `project_run` twice → second call returns `already_running`

### Manual (pre-merge)

1. `/gerber:runbook` on `agent-brain` itself → runbook composed with `concurrently` for mcp+ui
2. Launch from TUI, close TUI, verify process still alive (`ps aux | grep <cmd>`)
3. Reopen TUI → `●` indicator on home, `[L]ogs` tails correctly
4. `[S]top` → process dies, DB row cleaned
5. Kill -9 manually, reopen TUI → stale row auto-cleaned at boot

### Not tested

- Full-screen log overlay in TUI (`fs.watch` behavior hard to assert in ink-testing-library — validated manually)
- Editor spawn (`zed .`) — trivial, manual check

---

## Rollout

- Migration 0004 applies at MCP boot (same pattern as 0001-0003)
- No breaking changes to MCP contracts (new tools additive, `project_list` enrichment is additive field)
- Plugin version bump : `.claude-plugin/plugin.json` `1.2.0` → `1.3.0`
- TUI package version bumped in `packages/tui/package.json` in lockstep
- CLAUDE.md update : add `/gerber:runbook` to skills list, mention runbook columns in schema section

## Open questions — none

All design decisions confirmed in brainstorming :
- Fields : `run_cmd` + `url` + `run_cwd` + `env_json` (B from Q1, expanded)
- Editor : global config only (B from Q2)
- Process lifecycle : detached + attachable logs + stop (C from Q3)
- Auto-detect : Claude-invoked skill only, no TS heuristic tool (user-refined from Q4)
- UX : runbook screen in project navbar (user-proposed, better than Q5 options)
- Storage : columns on `projects` + dedicated `running_processes` table (A1 + B2)
