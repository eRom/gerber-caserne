# GitBook Documentation — Design Spec

**Date:** 2026-04-15
**Status:** Approved
**Scope:** Full public documentation for Gerber (user + developer)

---

## 1. Goals

- Provide accessible documentation for developers new to MCP servers
- Offer deep reference material for advanced users (tools, skills, deployment)
- Document internal architecture for contributors
- Highlight the Claude Managed Agent integration as a differentiating feature

## 2. Platform & Hosting

- **GitBook.com** (SaaS) with Community plan (free for open-source)
- **Git Sync** enabled — bidirectional sync between `docs/` in the repo and GitBook
- **Language:** English only. French variant deferred to a future iteration (GitBook variants system)
- **Custom domain:** TBD (GitBook supports it on Community plan)

## 3. Audience

- **Primary:** Developers already using AI coding agents (Claude Code, Gemini CLI, Codex, etc.) who want cross-project memory
- **Secondary:** Developers discovering MCP servers — Gerber as a first MCP server
- Tone: direct, technical, no fluff. Active voice, "you" form.

## 4. File Structure

```
docs/
├── README.md                     # Landing page (hero + pitch)
├── SUMMARY.md                    # Navigation sidebar (GitBook convention)
│
├── getting-started/
│   ├── introduction.md           # What is Gerber, why, for whom
│   ├── quickstart.md             # Install + first use in 5 min
│   └── concepts.md               # Projects, notes, tasks, issues, messages, search
│
├── installation/
│   ├── claude-code.md
│   ├── claude-desktop.md
│   ├── gemini-cli.md
│   ├── codex-cli.md
│   ├── opencode.md
│   ├── kilo-code.md
│   └── cline.md
│
├── plugin/
│   ├── overview.md               # What the plugin adds (skills, agents, hook)
│   ├── skills.md                 # All 13 skills with usage examples
│   └── agents.md                 # agent-vault, agent-status
│
├── tools/
│   ├── projects.md
│   ├── notes.md
│   ├── search.md
│   ├── tasks.md
│   ├── issues.md
│   ├── messages.md
│   └── maintenance.md
│
├── interfaces/
│   ├── web-ui.md                 # Guide + screenshots
│   ├── admin-tui.md              # Rust TUI, keybindings
│   └── terminal-ui.md            # Ink TUI
│
├── deployment/
│   ├── http-mode.md              # --ui flag, port 4000
│   └── managed-agent.md          # Streamable HTTP + Cloudflare tunnel + Vault
│
├── architecture/
│   ├── overview.md               # Monorepo, packages, data flow diagram
│   ├── database.md               # SQLite, Drizzle schema, FTS5, WAL
│   └── embeddings.md             # E5 model, AST chunker, tokenizer, prefixes
│
├── contributing/
│   ├── setup.md                  # Local dev setup (pnpm, bun, prerequisites)
│   ├── conventions.md            # Patterns, naming, camelCase/snake_case mapping
│   └── pre-merge-checklist.md    # test, typecheck, e5 test, build
│
└── assets/                       # Screenshots, diagrams (reuse from repo assets/)
```

**Total: ~25 pages across 8 sections.**

## 5. Content Plan Per Section

### 5.1 Getting Started

**introduction.md**
- One-liner pitch: "One brain, every agent"
- Problem statement: AI agents lose context between sessions and across projects
- Solution: Gerber as a persistent cross-project memory layer via MCP
- Feature highlights: notes (atoms + documents), tasks (7-col kanban), issues (4-col kanban), inter-session messages, hybrid search (semantic + fulltext)
- Supported clients list with logos

**quickstart.md**
- Prerequisites: Node.js 20+, pnpm
- Clone, install, build (3 commands)
- Configure MCP in Claude Code (3-line JSON)
- First commands: `project_create`, `note_create`, `search`
- "What's next" links to deeper sections

**concepts.md**
- **Projects** — isolated namespaces with unique slug, repo path, color
- **Notes** — two kinds: atoms (short knowledge units) and documents (long-form, chunked for embeddings). Tags, status (draft/published/archived), source tracking
- **Tasks** — 7-column kanban: inbox → brainstorming → specification → plan → implementation → test → done. Subtasks via parentId, priority, assignee, dueDate, waitingOn
- **Issues** — 4-column kanban: inbox → in_progress → in_review → closed. Severity (bug/regression/warning/enhancement), relatedTask linking
- **Messages** — inter-session bus with two types: context (background info) and reminder (action required). Status: pending/done. Polled at session start via hook
- **Search** — 3 modes: hybrid (default, combines both), semantic (E5 embeddings, cosine similarity), fulltext (FTS5, BM25 ranking). Filterable by project, kind, status, tags

### 5.2 Installation

One page per client. Each page follows the same template:
1. Config file location
2. JSON/TOML snippet (copy-paste ready)
3. Verify it works (e.g., tool list shows gerber tools)
4. Troubleshooting tips (common pitfalls)

Clients: Claude Code, Claude Desktop/Cowork, Gemini CLI, OpenAI Codex CLI, OpenCode, Kilo Code, Cline.

### 5.3 Plugin (Claude Code)

**overview.md**
- What the plugin bundles: 13 skills, 2 agents, 1 SessionStart hook
- Install commands (marketplace add + plugin install)
- Prerequisite: MCP server must be configured separately
- Verify: `/reload-plugins`, `/gerber:status`
- Update command

**skills.md**
- Table of all 13 skills with one-line descriptions
- For each skill: purpose, when to use it, example invocation, expected behavior
- Grouped by workflow: onboarding → daily use (capture, recall, task, issue) → session lifecycle (inbox, archive, session-complete) → maintenance (review, import, vault, send)

**agents.md**
- `gerber:agent-vault` — Sonnet sub-agent, git archive operations, used by `/gerber:vault`
- `gerber:agent-status` — project dashboard, metadata + counters
- How agents are defined (markdown frontmatter + system prompt)

### 5.4 Tools Reference

One page per domain. Each tool entry follows a uniform template:
- **Name** and one-line description
- **Parameters** table: name, type, required/optional, description
- **Example request** (JSON)
- **Example response** (JSON)
- **Notes** (edge cases, gotchas)

Domains: Projects (4 tools), Notes (5 tools), Search (1 tool), Tasks (6 tools), Issues (5 tools), Messages (3 tools), Maintenance (2 tools). Total: 26 tools.

### 5.5 Interfaces

**web-ui.md**
- How to launch (`--ui` flag)
- Screenshots: tasks kanban, task detail, issues board, memory/notes view
- Navigation, filtering, search
- Note: `--ui` and stdio cannot coexist on the same process

**admin-tui.md**
- How to launch (`pnpm admin`)
- Split-pane layout description (MCP logs + tunnel logs)
- Keybindings table (S, B, Tab, 1/2, C, W, Q, arrows)
- Color-coded log parsing
- Status bar explanation
- Build: `pnpm admin:build`

**terminal-ui.md**
- Ink-based TUI
- How to launch (`pnpm tui`)
- Features and navigation

### 5.6 Deployment

**http-mode.md**
- `--ui` flag, serves on port 4000
- Two-process setup for stdio + UI simultaneously
- `--db-path` override

**managed-agent.md** (highlight section)
- What is Claude Managed Agent (brief intro + link to Anthropic docs)
- Streamable HTTP adapter: `--ui --stream` flags, `/mcp/stream` endpoint
- Bearer token auth: generated on first run, stored in `~/.config/gerber/config.json` (mode 600)
- Token management: `pnpm mcp:token` (display), `pnpm mcp:token --rotate` (rotate + update Vault)
- Cloudflare tunnel setup: `cloudflared tunnel login`, create, route DNS, config.yml, run
- Critical: URL is **immutable** in Anthropic Vault credential — use named tunnel, never quick tunnel
- Alternatives: Tailscale Funnel, ngrok reserved domain
- End-to-end verification steps

### 5.7 Architecture (Developer)

**overview.md**
- Monorepo structure: shared → mcp → ui → tui → admin
- Package dependency graph
- Data flow: Agent → MCP (stdio/HTTP/Streamable) → SQLite → Response
- Tech stack: TypeScript, Drizzle ORM, Express 5, React 19, Tailwind 4, Ratatui (Rust)

**database.md**
- SQLite with WAL mode, busy_timeout pragma
- Drizzle schema: projects, notes, note_chunks, tasks, issues, messages
- FTS5 virtual tables for fulltext search
- camelCase (Drizzle) ↔ snake_case (SQLite) mapping via helper functions
- Backup: WAL checkpoint before copy

**embeddings.md**
- E5-small model via @huggingface/transformers
- Prefix convention: `passage:` for indexing, `query:` for search
- AST-based markdown chunker (not regex — handles fenced code blocks)
- Tokenizer: token count includes 9-char prefix
- Preload: fire-and-forget after server.listen

### 5.8 Contributing (Developer)

**setup.md**
- Prerequisites: Node.js 20+, pnpm, Rust (for admin TUI)
- Clone + `pnpm install` (shamefully-hoist required)
- Build: `pnpm build`
- Dev mode commands for each package

**conventions.md**
- Response shapes must match Zod envelopes
- Express 5: `await import()`, no require()
- camelCase ↔ snake_case: always use `toProject()`/`toNote()` helpers
- Tags filter: `json_each()` in SQL, never post-filter in JS
- Pin devDep versions

**pre-merge-checklist.md**
- `pnpm test` passes
- `pnpm typecheck` passes
- If touching embeddings: `pnpm --filter @agent-brain/mcp test:e5`
- `pnpm build` succeeds

## 6. Content Conventions

- **Format:** Pure Markdown (no MDX), GitBook-native compatible
- **Images:** Stored in `docs/assets/`. Reuse existing screenshots from `assets/` at repo root. Add new ones as needed.
- **Code blocks:** JSON for configs, bash for commands. Inline comments for clarity.
- **Links:** Relative paths between pages. GitBook resolves them automatically.
- **No duplication:** The root README.md will be simplified to a summary + "Read the full docs" link. The GitBook doc is the source of truth.

## 7. README Simplification

The current README (~420 lines) will be reduced to:
- Hero image + one-liner pitch
- Feature highlights (bullet list)
- Quick install snippet (Claude Code only, most common)
- Link to full documentation on GitBook
- License

All detailed content (multi-client install, tools reference, skills, deployment, architecture) moves to the GitBook docs.

## 8. Migration Strategy

1. Create `docs/` structure with all pages
2. Write content, pulling from existing README + CLAUDE.md + .cave/ files
3. Create `SUMMARY.md` for GitBook navigation
4. Simplify root README.md with doc link
5. Commit and push — Git Sync picks it up automatically
6. Configure GitBook space settings (title, logo, custom domain if ready)
7. Apply for GitBook Community plan (open-source)

## 9. Out of Scope

- French translation (deferred — GitBook variants when needed)
- API playground / interactive examples
- Video tutorials
- Changelog / release notes page (can be added later)
- Blog / announcements section
