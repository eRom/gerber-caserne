# GitBook Documentation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the full GitBook documentation for Gerber (~25 Markdown pages) in `docs/`, ready for Git Sync.

**Architecture:** Pure Markdown files organized in `docs/` with a `SUMMARY.md` for GitBook navigation. Content pulled from existing README, CLAUDE.md, source code (tool registrations, schemas, constants), and .cave/ files. No code generation — this is a content authoring plan.

**Tech Stack:** Markdown, GitBook Git Sync, existing screenshots from `assets/`

---

## Task 1: Scaffold — SUMMARY.md + README.md landing page

**Files:**
- Create: `docs/SUMMARY.md`
- Create: `docs/README.md`

- [ ] **Step 1: Create `docs/SUMMARY.md`**

```markdown
# Table of contents

## Getting Started

* [Introduction](getting-started/introduction.md)
* [Quickstart](getting-started/quickstart.md)
* [Concepts](getting-started/concepts.md)

## Installation

* [Claude Code](installation/claude-code.md)
* [Claude Desktop](installation/claude-desktop.md)
* [Gemini CLI](installation/gemini-cli.md)
* [Codex CLI](installation/codex-cli.md)
* [OpenCode](installation/opencode.md)
* [Kilo Code](installation/kilo-code.md)
* [Cline](installation/cline.md)

## Plugin

* [Overview](plugin/overview.md)
* [Skills](plugin/skills.md)
* [Agents](plugin/agents.md)

## Tools Reference

* [Projects](tools/projects.md)
* [Notes](tools/notes.md)
* [Search](tools/search.md)
* [Tasks](tools/tasks.md)
* [Issues](tools/issues.md)
* [Messages](tools/messages.md)
* [Maintenance](tools/maintenance.md)

## Interfaces

* [Web UI](interfaces/web-ui.md)
* [Admin TUI](interfaces/admin-tui.md)
* [Terminal UI](interfaces/terminal-ui.md)

## Deployment

* [HTTP Mode](deployment/http-mode.md)
* [Claude Managed Agent](deployment/managed-agent.md)

## Architecture

* [Overview](architecture/overview.md)
* [Database](architecture/database.md)
* [Embeddings & Search](architecture/embeddings.md)

## Contributing

* [Local Setup](contributing/setup.md)
* [Conventions](contributing/conventions.md)
* [Pre-merge Checklist](contributing/pre-merge-checklist.md)
```

- [ ] **Step 2: Create `docs/README.md` (GitBook landing page)**

```markdown
---
description: Cross-project memory & orchestration MCP server for AI coding agents.
---

# Gerber

<figure><img src="../assets/gerber-logo-light.png" alt="Gerber logo" width="200"></figure>

**One brain, every agent.**

Gerber is a Model Context Protocol (MCP) server that gives AI coding agents persistent memory across sessions and projects. Notes, tasks, issues, and inter-session messages — with semantic and full-text search.

## Why Gerber?

AI coding agents forget everything between sessions. Gerber solves this:

- **Notes** — Capture knowledge atoms and long-form documents, searchable via E5 embeddings
- **Tasks** — 7-column kanban (inbox → done) with subtasks, priorities, and due dates
- **Issues** — Bug tracking with severity levels and 4-column workflow
- **Messages** — Inter-session bus for context and reminders between projects
- **Search** — Hybrid engine combining semantic similarity and full-text matching

## Works with every agent

Claude Code, Claude Desktop, Gemini CLI, OpenAI Codex, OpenCode, Kilo Code, Cline — and any MCP-compatible client.

## Get started

<table data-card-size="large" data-view="cards">
<thead><tr><th></th><th></th></tr></thead>
<tbody>
<tr><td><strong>Quickstart</strong></td><td>Install and use Gerber in 5 minutes</td></tr>
<tr><td><strong>Concepts</strong></td><td>Understand projects, notes, tasks, issues, and search</td></tr>
<tr><td><strong>Tools Reference</strong></td><td>Complete reference for all 26 MCP tools</td></tr>
<tr><td><strong>Claude Managed Agent</strong></td><td>Connect Gerber to Anthropic's managed agent platform</td></tr>
</tbody>
</table>
```

- [ ] **Step 3: Create all subdirectories**

```bash
mkdir -p docs/{getting-started,installation,plugin,tools,interfaces,deployment,architecture,contributing,assets}
```

- [ ] **Step 4: Commit scaffold**

```bash
git add docs/SUMMARY.md docs/README.md
git commit -m "docs: scaffold GitBook structure with SUMMARY.md and landing page"
```

---

## Task 2: Getting Started — introduction.md + quickstart.md + concepts.md

**Files:**
- Create: `docs/getting-started/introduction.md`
- Create: `docs/getting-started/quickstart.md`
- Create: `docs/getting-started/concepts.md`

**Sources:** `README.md` (pitch, architecture), `packages/shared/src/constants.ts` (enums), spec section 5.1

- [ ] **Step 1: Write `docs/getting-started/introduction.md`**

Content:
- What is Gerber: MCP server for cross-project AI agent memory
- Problem: agents lose context between sessions, can't share knowledge across projects
- Solution: persistent SQLite brain with semantic search, accessible via MCP protocol
- Key features: notes (atoms + documents), tasks (7-col kanban), issues (4-col), messages (inter-session bus), hybrid search (semantic + fulltext)
- Architecture diagram: reference `../assets/principe.png`
- Supported clients: list with links to installation pages

- [ ] **Step 2: Write `docs/getting-started/quickstart.md`**

Content:
- Prerequisites: Node.js 20+, pnpm 9+
- Clone: `git clone` + `pnpm install` + `pnpm build`
- Configure Claude Code MCP: the 3-line JSON in `.mcp.json`
- First use: create a project (`project_create`), create a note (`note_create`), search (`search`)
- Show exact JSON call and response for each step
- "What's next" section with links to concepts, tools reference, plugin

- [ ] **Step 3: Write `docs/getting-started/concepts.md`**

Content — one subsection per entity:
- **Projects**: namespaces with unique slug, optional repoPath/color. Global project for unassigned notes.
- **Notes**: two kinds — `atom` (short knowledge units: gotchas, patterns, decisions) and `document` (long-form, auto-chunked for embeddings). Statuses: draft/active/archived/deprecated. Sources: ai/human/import. Tags for filtering.
- **Tasks**: 7-column kanban: inbox → brainstorming → specification → plan → implementation → test → done. Subtasks via parentId. Priority (low/normal/high), assignee, dueDate, waitingOn. Reorderable.
- **Issues**: 4-column kanban: inbox → in_progress → in_review → closed. Severity (bug/regression/warning/enhancement). Priority includes `critical`. relatedTaskId linking.
- **Messages**: inter-session bus. Two types: `context` (background info) and `reminder` (action required). Status: pending/done. Polled at session start by the plugin hook.
- **Search**: 3 modes — `hybrid` (default, combines both scores), `semantic` (E5 embeddings, cosine similarity), `fulltext` (FTS5, BM25). Filters: project, kind, status, tags. Neighbors parameter for chunk context.

- [ ] **Step 4: Commit**

```bash
git add docs/getting-started/
git commit -m "docs: add getting started section (intro, quickstart, concepts)"
```

---

## Task 3: Installation guides — 7 client pages

**Files:**
- Create: `docs/installation/claude-code.md`
- Create: `docs/installation/claude-desktop.md`
- Create: `docs/installation/gemini-cli.md`
- Create: `docs/installation/codex-cli.md`
- Create: `docs/installation/opencode.md`
- Create: `docs/installation/kilo-code.md`
- Create: `docs/installation/cline.md`

**Sources:** `README.md` lines 50-166 (all installation snippets are there verbatim)

- [ ] **Step 1: Write all 7 pages**

Each page follows the same template:
1. **Config file location** (path + how to find it)
2. **Configuration snippet** (JSON/TOML, copy-paste ready, with `<path-to-folder>` placeholder)
3. **Verify** — "After restarting, you should see Gerber's 26 tools available"
4. **Troubleshooting** — common issues (wrong path, missing build, permission)

Pull snippets directly from `README.md` lines 50-166. Adapt formatting for standalone pages (add headers, intro sentence).

- [ ] **Step 2: Commit**

```bash
git add docs/installation/
git commit -m "docs: add installation guides for 7 MCP clients"
```

---

## Task 4: Plugin section — overview.md + skills.md + agents.md

**Files:**
- Create: `docs/plugin/overview.md`
- Create: `docs/plugin/skills.md`
- Create: `docs/plugin/agents.md`

**Sources:** `README.md` lines 286-346 (plugin section), `skills/*/SKILL.md` (13 skill files), `agents/*.md` (2 agent files)

- [ ] **Step 1: Write `docs/plugin/overview.md`**

Content:
- What the plugin bundles: 13 skills, 2 agents, 1 SessionStart hook
- Install: marketplace add + plugin install (exact commands from README)
- Prerequisite: MCP server configured separately
- Verify: `/reload-plugins`, `/gerber:status`
- Update: `/plugin update gerber@erom-marketplace`
- Compatible with Claude Desktop Cowork

- [ ] **Step 2: Write `docs/plugin/skills.md`**

Content:
- Summary table of all 13 skills (name + one-liner)
- Grouped by workflow phase:
  - **Setup**: onboarding
  - **Daily use**: capture, recall, task, issue, status
  - **Session lifecycle**: inbox, send, archive, session-complete
  - **Maintenance**: review, import, vault
- For each skill: purpose, when to use, example invocation, what happens
- Read each `skills/*/SKILL.md` file for accurate descriptions

- [ ] **Step 3: Write `docs/plugin/agents.md`**

Content:
- `gerber:agent-status`: dashboard agent, retrieves metadata + counters
- `gerber:agent-vault`: Sonnet sub-agent, git archive operations, copies files, generates INDEX.md, commits and pushes
- How agents are defined: markdown files with frontmatter (name, model, tools) + system prompt
- Read `agents/agent-status.md` and `agents/agent-vault.md` for accurate content

- [ ] **Step 4: Commit**

```bash
git add docs/plugin/
git commit -m "docs: add plugin section (overview, 13 skills, 2 agents)"
```

---

## Task 5: Tools Reference — 7 domain pages

**Files:**
- Create: `docs/tools/projects.md`
- Create: `docs/tools/notes.md`
- Create: `docs/tools/search.md`
- Create: `docs/tools/tasks.md`
- Create: `docs/tools/issues.md`
- Create: `docs/tools/messages.md`
- Create: `docs/tools/maintenance.md`

**Sources:** `packages/mcp/src/tools/index.ts` (all 26 tool registrations with exact param schemas), `README.md` lines 353-410 (tool tables), `packages/shared/src/constants.ts` (enum values)

- [ ] **Step 1: Write `docs/tools/projects.md`**

4 tools: `project_create`, `project_list`, `project_update`, `project_delete`.

For each tool, use this template:

```markdown
## project_create

Create a new project.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `slug` | string | yes | Unique identifier (max 64 chars) |
| `name` | string | yes | Display name (max 120 chars) |
| `description` | string | no | Project description (max 500 chars) |
| `repoPath` | string | no | Path to the git repository |
| `color` | string | no | Badge color (hex) |

### Example

Request:
\`\`\`json
{
  "slug": "my-app",
  "name": "My App",
  "description": "Mobile application project",
  "repoPath": "/Users/dev/my-app"
}
\`\`\`

Response:
\`\`\`json
{
  "ok": true,
  "item": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "slug": "my-app",
    "name": "My App",
    "description": "Mobile application project",
    "repoPath": "/Users/dev/my-app",
    "color": null,
    "createdAt": 1713200000,
    "updatedAt": 1713200000
  }
}
\`\`\`
```

Pull exact parameter names, types, and optionality from `packages/mcp/src/tools/index.ts`. Pull limits from `packages/shared/src/constants.ts`.

- [ ] **Step 2: Write `docs/tools/notes.md`**

5 tools: `note_create`, `note_get`, `note_update`, `note_delete`, `note_list`. Same template. Include enum values for `kind` (atom/document), `status` (draft/active/archived/deprecated), `source` (ai/human/import). Note: `projectSlug` OR `projectId` to assign/filter.

- [ ] **Step 3: Write `docs/tools/search.md`**

1 tool: `search`. Include the 3 modes (hybrid/semantic/fulltext), all filter params, `neighbors` parameter explanation (returns surrounding chunks for context). Example showing hybrid search with tag filter.

- [ ] **Step 4: Write `docs/tools/tasks.md`**

6 tools: `task_create`, `task_list`, `task_get`, `task_update`, `task_delete`, `task_reorder`. Include all 7 statuses, 3 priorities. Note: `task_list` excludes subtasks by default (use `parentId` filter). `task_get` returns subtasks. `task_update` auto-sets `completedAt`. `task_reorder` accepts ordered array of IDs.

- [ ] **Step 5: Write `docs/tools/issues.md`**

5 tools: `issue_create`, `issue_list`, `issue_get`, `issue_update`, `issue_close`. Include 4 statuses, 4 severities, 4 priorities (includes `critical`). `issue_close` is shorthand for status=closed. `relatedTaskId` for linking.

- [ ] **Step 6: Write `docs/tools/messages.md`**

3 tools: `message_create`, `message_list`, `message_update`. Include 2 types (context/reminder), 2 statuses (pending/done). `since` filter is timestamp. Metadata supports `source` and `sourceProject`.

- [ ] **Step 7: Write `docs/tools/maintenance.md`**

2 tools: `backup_brain`, `get_stats`. Backup creates a timestamped copy. Stats returns counts per entity type, optionally filtered by project.

- [ ] **Step 8: Commit**

```bash
git add docs/tools/
git commit -m "docs: add tools reference for all 26 MCP tools"
```

---

## Task 6: Interfaces — web-ui.md + admin-tui.md + terminal-ui.md

**Files:**
- Create: `docs/interfaces/web-ui.md`
- Create: `docs/interfaces/admin-tui.md`
- Create: `docs/interfaces/terminal-ui.md`

**Sources:** `README.md` lines 226-253 (admin TUI), `assets/` (screenshots), `packages/ui/src/pages/` (page list), `packages/tui/src/screens/` (screen list)

- [ ] **Step 1: Write `docs/interfaces/web-ui.md`**

Content:
- How to launch: `node packages/mcp/dist/index.js --ui` or `pnpm --filter @agent-brain/mcp dev -- --ui`
- Port 4000 by default
- Note: `--ui` and stdio cannot coexist — use two separate processes
- Screenshots: tasks kanban, task detail, issues board, memory view (use `../assets/screenshot-*.png`)
- Pages: Dashboard, Project view, Notes, Search, Messages, Settings
- Dev mode: `pnpm --filter @agent-brain/ui dev` (Vite on :5173, proxies to :4000)

- [ ] **Step 2: Write `docs/interfaces/admin-tui.md`**

Content:
- What it is: Rust-based admin panel (ratatui) for managing MCP server + Cloudflare tunnel
- Launch: `pnpm admin`
- Split-pane layout: MCP logs (left) + tunnel logs (right)
- Keybindings table (S, B, Tab, 1/2, C, W, Q, arrows) — from README
- Color-coded structured logs: tool calls (cyan), OK/Error (green/red), sessions, auth
- Status bar: process states, build status, MCP version
- Build release: `pnpm admin:build`
- Screenshot: `../assets/admin.png`

- [ ] **Step 3: Write `docs/interfaces/terminal-ui.md`**

Content:
- What it is: Ink-based terminal UI (React for the terminal)
- Launch: `pnpm tui`
- Screens: home, notes, tasks, issues, search
- Navigation: keyboard-driven
- Screenshots: `../assets/tui-home.png`, `../assets/tui-projet.png`

- [ ] **Step 4: Commit**

```bash
git add docs/interfaces/
git commit -m "docs: add interfaces section (web UI, admin TUI, terminal UI)"
```

---

## Task 7: Deployment — http-mode.md + managed-agent.md

**Files:**
- Create: `docs/deployment/http-mode.md`
- Create: `docs/deployment/managed-agent.md`

**Sources:** `README.md` lines 167-224, `packages/mcp/src/http/streamable.ts`, `packages/mcp/src/config/user-config.ts`

- [ ] **Step 1: Write `docs/deployment/http-mode.md`**

Content:
- `--ui` flag enables HTTP server on port 4000
- JSON-RPC bridge at `/mcp` for the Web UI
- `--db-path` to override default database location (`~/.agent-brain/brain.db`)
- Two-process setup: one stdio for Claude Code, one `--ui` for the browser
- Dev mode: `pnpm --filter @agent-brain/mcp dev -- --ui --db-path ~/.agent-brain/brain.db`

- [ ] **Step 2: Write `docs/deployment/managed-agent.md`**

Content:
- **What is Claude Managed Agent**: brief intro + link to Anthropic platform docs
- **Streamable HTTP**: `--ui --stream` flags, exposes `/mcp/stream` endpoint
- **Authentication**: Bearer token, auto-generated on first run
  - Location: `~/.config/gerber/config.json` (mode 600)
  - Display: `pnpm mcp:token`
  - Rotate: `pnpm mcp:token --rotate` (then update Vault credential)
- **Cloudflare Tunnel setup** (step-by-step):
  1. `cloudflared tunnel login`
  2. `cloudflared tunnel create gerber`
  3. `cloudflared tunnel route dns gerber gerber.<hostname>`
  4. `config.yml` content (exact YAML from README)
  5. `cloudflared tunnel run gerber`
- **Critical warning**: URL is immutable in Anthropic Vault credential. Use named tunnel, NEVER quick tunnel.
- **Alternatives**: Tailscale Funnel, ngrok reserved domain
- **Verification**: how to test the endpoint is working end-to-end

- [ ] **Step 3: Commit**

```bash
git add docs/deployment/
git commit -m "docs: add deployment section (HTTP mode, Claude Managed Agent)"
```

---

## Task 8: Architecture (developer) — overview.md + database.md + embeddings.md

**Files:**
- Create: `docs/architecture/overview.md`
- Create: `docs/architecture/database.md`
- Create: `docs/architecture/embeddings.md`

**Sources:** `packages/shared/src/db/schema.ts`, `packages/mcp/src/db/index.ts`, `packages/mcp/src/embeddings/*.ts`, `packages/mcp/src/search/*.ts`, `.cave/architecture.md`

- [ ] **Step 1: Write `docs/architecture/overview.md`**

Content:
- Monorepo structure: `shared` → `mcp` → `ui` / `tui` / `admin`
- Package dependency graph (text-based, or reference `../assets/gerber-full-architecture.png` if suitable)
- Data flow: Agent → MCP protocol (stdio/HTTP/Streamable) → tool handler → SQLite → response
- Tech stack table: TypeScript, Drizzle ORM, Express 5, better-sqlite3, React 19, Tailwind 4, Ink, Ratatui
- Transport modes: stdio (default), HTTP (for UI), Streamable HTTP (for Managed Agents)

- [ ] **Step 2: Write `docs/architecture/database.md`**

Content:
- SQLite with WAL mode (`PRAGMA journal_mode = WAL` first, then `PRAGMA busy_timeout = 5000`)
- Location: `~/.agent-brain/brain.db`
- Schema overview: projects, notes, note_chunks, tasks, issues, messages (read from `packages/shared/src/db/schema.ts`)
- FTS5 virtual tables for fulltext search
- camelCase (Drizzle/TypeScript) ↔ snake_case (SQLite columns) — always use `toProject()`/`toNote()` helpers
- Migrations: Drizzle Kit, stored in `packages/mcp/src/db/migrations/`
- Backup: WAL checkpoint before copy, `backup_brain` tool

- [ ] **Step 3: Write `docs/architecture/embeddings.md`**

Content:
- E5-small model via `@huggingface/transformers` (runs locally, no API key needed)
- Prefix convention: `passage:` for indexing content, `query:` for search queries
- AST-based markdown chunker (not regex): handles fenced code blocks correctly, `#` inside code is not a header
- Token count includes the 9-char prefix
- Preload strategy: fire-and-forget after server.listen (non-blocking startup)
- Search modes: semantic (cosine similarity on embeddings), fulltext (FTS5 BM25), hybrid (weighted combination)
- Neighbors: returns N surrounding chunks for context around a hit

- [ ] **Step 4: Commit**

```bash
git add docs/architecture/
git commit -m "docs: add architecture section (overview, database, embeddings)"
```

---

## Task 9: Contributing (developer) — setup.md + conventions.md + pre-merge-checklist.md

**Files:**
- Create: `docs/contributing/setup.md`
- Create: `docs/contributing/conventions.md`
- Create: `docs/contributing/pre-merge-checklist.md`

**Sources:** `CLAUDE.md` (gotchas table, pre-merge checklist, commands), `package.json`

- [ ] **Step 1: Write `docs/contributing/setup.md`**

Content:
- Prerequisites: Node.js 20+, pnpm 9+, Rust toolchain (for admin TUI only)
- Clone + `pnpm install` (note: `shamefully-hoist` is required, already in `.npmrc`)
- Build all: `pnpm build`
- Dev mode commands (per package):
  - MCP: `pnpm --filter @agent-brain/mcp dev -- --ui --db-path ~/.agent-brain/brain.db`
  - Web UI: `pnpm --filter @agent-brain/ui dev`
  - TUI: `pnpm tui`
  - Admin: `pnpm admin`
- Run tests: `pnpm test`
- Typecheck: `pnpm typecheck`
- Project structure recap with one-liner per package

- [ ] **Step 2: Write `docs/contributing/conventions.md`**

Content — pulled from CLAUDE.md gotchas table:
- Express 5: `await import()`, no `require()`
- Response shapes must match Zod envelopes in `contracts.ts`
- camelCase ↔ snake_case: Drizzle returns camelCase, SQLite columns are snake_case. Always use `toProject()`/`toNote()` helpers.
- Tags filter: `json_each()` in SQL WHERE, never post-filter in JS
- E5 prefixes: `passage:` / `query:` mandatory
- Token count includes the 9-char prefix
- Pragma order: WAL first, then busy_timeout
- `busy_timeout = 5000` prevents SQLITE_BUSY
- Mock tokenizer (chars/4) may diverge from real E5
- Embedder preload: fire-and-forget
- AST chunker, not regex
- `/mcp` (JSON-RPC for UI) ≠ `/mcp/stream` (Streamable HTTP for Managed Agents)
- Pin devDep versions

- [ ] **Step 3: Write `docs/contributing/pre-merge-checklist.md`**

Content:
- `pnpm test` passes
- `pnpm typecheck` passes
- If touching `embeddings/chunking.ts` or `embeddings/tokenizer.ts`: run `pnpm --filter @agent-brain/mcp test:e5` locally
- `pnpm build` succeeds

- [ ] **Step 4: Commit**

```bash
git add docs/contributing/
git commit -m "docs: add contributing section (setup, conventions, pre-merge checklist)"
```

---

## Task 10: Copy screenshots + simplify root README

**Files:**
- Copy: `assets/*.png` → `docs/assets/` (symlinks or copies, for GitBook to resolve image paths)
- Modify: `README.md` (simplify to summary + link to docs)

- [ ] **Step 1: Symlink or copy screenshots**

Images in `assets/` at repo root need to be accessible from `docs/`. Two options:
- If GitBook Git Sync resolves `../assets/` paths from `docs/` pages → no action needed
- If not → copy the images: `cp assets/*.png docs/assets/`

Test with GitBook preview first. If images don't resolve, copy them.

- [ ] **Step 2: Simplify root `README.md`**

Keep:
- Hero image + title + one-liner
- Feature highlights (short bullet list)
- Quick install for Claude Code (most common, 3-line JSON)
- Link to full documentation: `[Read the full documentation](https://docs.gerber...)`
- Screenshots section (reduced — 2 screenshots max)
- License

Remove (moved to docs):
- All 7+ client installation guides
- Full MCP tools reference tables
- Skills & agents tables
- Admin TUI details
- Managed Agent / Cloudflare setup
- Database section
- Full scripts section

Target: ~80 lines instead of ~420.

- [ ] **Step 3: Commit**

```bash
git add docs/assets/ README.md
git commit -m "docs: add screenshots to docs/ and simplify root README"
```

---

## Task 11: Final review + GitBook verification

- [ ] **Step 1: Verify all pages exist and SUMMARY.md links resolve**

```bash
# Check every file referenced in SUMMARY.md exists
grep -oP '\(.*?\.md\)' docs/SUMMARY.md | tr -d '()' | while read f; do
  [ -f "docs/$f" ] || echo "MISSING: docs/$f"
done
```

- [ ] **Step 2: Verify all image references resolve**

```bash
grep -rn '\.\./assets/' docs/ --include='*.md' | while IFS=: read file line content; do
  img=$(echo "$content" | grep -oP '\.\./assets/[^\s\)\"]+')
  [ -f "$(dirname "$file")/$img" ] || echo "BROKEN IMAGE in $file: $img"
done
```

- [ ] **Step 3: Check GitBook sync**

Push to remote. Verify GitBook picks up the `docs/` folder and renders the sidebar from `SUMMARY.md`.

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add docs/
git commit -m "docs: fix broken links and images after review"
```
