# Skills Reference

The plugin provides 13 slash commands covering the full project lifecycle — from initial setup through daily work to session close.

## Summary Table

| Skill | Description |
|-------|-------------|
| `/gerber:onboarding` | Initialize a project in Gerber and configure CLAUDE.md |
| `/gerber:capture` | Quick capture of a knowledge atom (gotcha, pattern, decision) |
| `/gerber:recall` | Search Gerber for context relevant to the current task |
| `/gerber:task` | Manage project tasks via the 7-column kanban |
| `/gerber:issue` | Manage project issues via the 4-column kanban |
| `/gerber:status` | Display the project dashboard (notes, tasks, issues counts) |
| `/gerber:inbox` | Read pending inter-session messages from the central bus |
| `/gerber:send` | Post a message (context or reminder) to the central bus |
| `/gerber:archive` | Extract and archive session learnings as notes |
| `/gerber:session-complete` | End-of-session: persist `.cave/` maps and archive to Gerber |
| `/gerber:review` | Weekly maintenance — drafts, stale notes, potential duplicates |
| `/gerber:import` | One-shot migration of `.cave/` and `_internal/` content |
| `/gerber:vault` | Archive files to the cross-project git vault |

---

## Setup

### `/gerber:onboarding`

Initializes a project in Gerber and configures the current repo's `CLAUDE.md`.

**What it does:** Creates the project record in Gerber, writes `.cave/.gerber-slug`, injects `## Gerber` and `## Contexte projet (.cave)` sections into `CLAUDE.md`, initializes the local vault at `~/.config/gerber-vault/`, and optionally triggers `/gerber:import` if `.cave/` already contains content.

**When to use:** Once per project, before using any other skill.

```
/gerber:onboarding
/gerber:onboarding my-project-slug
```

---

## Daily Use

### `/gerber:capture`

Quick capture of a single knowledge atom during an active session.

**What it does:** Extracts a gotcha, pattern, or decision from the conversation (or from an explicit argument), checks for duplicates via semantic search, shows a draft for confirmation, then creates the note.

**When to use:** Right after discovering a tricky bug, validating a pattern, or making a technical decision you want to remember.

```
/gerber:capture
/gerber:capture Express 5 requires await import() — no require()
```

### `/gerber:recall`

Searches Gerber for context relevant to the current question or task.

**What it does:** Runs a hybrid semantic + full-text search against both the current project and the global corpus, deduplicates results, and returns structured markdown split into project notes and cross-project notes.

**When to use:** Before starting a task, or when you suspect a similar problem has been solved before.

```
/gerber:recall SQLite busy timeout
/gerber:recall how to handle FTS5 query sanitization
```

### `/gerber:task`

Manages project tasks via the 7-column kanban: `inbox → brainstorming → specification → plan → implementation → test → done`.

**What it does:** Lists tasks grouped by status, creates tasks, moves them between columns, and shows task details with subtasks.

**When to use:** To track what needs doing, move work forward, or log a new task mid-session.

```
/gerber:task                              # List all tasks
/gerber:task add "Add pagination to notes list"
/gerber:task 3 impl                       # Move task #3 to implementation
/gerber:task 3 done
```

### `/gerber:issue`

Manages project issues via the 4-column kanban: `inbox → in_progress → in_review → closed`.

**What it does:** Lists issues grouped by status (with severity and priority), creates issues, changes status, and shows issue details.

**When to use:** When you spot a bug, regression, or enhancement that needs tracking.

```
/gerber:issue                                   # List all issues
/gerber:issue add "FTS5 query crashes on special chars" --severity bug --priority high
/gerber:issue 2 in_progress
/gerber:issue 2 close
```

### `/gerber:status`

Displays the full project dashboard.

**What it does:** Resolves the current project slug, fetches metadata, then dispatches `gerber:agent-status` in the background to retrieve note/task/issue counts in parallel. Returns a formatted summary.

**When to use:** At the start of a session, or any time you want a quick project overview.

```
/gerber:status
```

---

## Session Lifecycle

### `/gerber:inbox`

Reads pending inter-session messages from the central bus (`caserne`).

**What it does:** Lists pending messages with type icons (`[i]` context, `[R]` reminder), source project, and relative age. Lets you mark messages as done.

**When to use:** At the start of a session to check for context or reminders left by a previous session.

```
/gerber:inbox           # Pending messages only
/gerber:inbox all       # All messages
/gerber:inbox done      # Completed messages
```

### `/gerber:send`

Posts a message to the central inter-session bus.

**What it does:** Creates a `context` or `reminder` message on the `caserne` project, tagging it with the source project slug so the recipient session knows where it came from.

**When to use:** When you want to leave a note for the next session — a decision to revisit, a context transfer, a reminder.

```
/gerber:send reminder "Test HealthKit flow on physical device before release"
/gerber:send context "Migration strategy"
```

### `/gerber:archive`

Extracts and archives learnings from the current session as notes in Gerber.

**What it does:** Scans the conversation for gotchas, patterns, decisions, and specs. Runs semantic dedup against existing notes. Presents categorized drafts (new / possible duplicate / ignored), asks for confirmation, then batch-creates the approved notes.

**When to use:** Manually at the end of a significant work session, before closing the editor.

```
/gerber:archive
```

### `/gerber:session-complete`

Full end-of-session ritual: persists `.cave/` context maps and archives to Gerber.

**What it does:** Writes or updates 4 files in `.cave/` (`architecture.md`, `key-files.md`, `patterns.md`, `gotchas.md`), updates the `CLAUDE.md` lazy-load pointer, then calls `/gerber:archive` in automatic mode (grouped confirmation, borderline notes saved as drafts).

**When to use:** At the end of a substantial session. This is the recommended way to close — it guarantees the next session starts with accurate context.

```
/gerber:session-complete
```

---

## Maintenance

### `/gerber:review`

Weekly corpus maintenance.

**What it does:** Shows global stats (projects, notes, chunks, top tags, tasks, issues). Surfaces draft notes pending review, stale notes not updated in 30+ days, and potential duplicate pairs (semantic score > 0.90). Lets you bulk-activate, archive, or delete items.

**When to use:** Once a week to keep the knowledge base clean.

```
/gerber:review                # Current project
/gerber:review --all          # All projects
/gerber:review my-other-slug
```

### `/gerber:import`

One-shot migration of existing `.cave/`, `_internal/`, and `audit/` content into Gerber.

**What it does:** Scans markdown files in the target directories, infers note type and tags from filename patterns (gotchas → atoms, architecture → document, specs → archived document, etc.), splits multi-entity files like `gotchas.md` into individual atoms, shows a preview table, and bulk-creates on confirmation.

**When to use:** Once, when onboarding a project that already has `.cave/` content or internal documentation.

```
/gerber:import
/gerber:import ./docs/legacy
```

### `/gerber:vault`

Archives files to the cross-project git vault at `~/.config/gerber-vault/`.

**What it does:** Copies files into a per-project folder inside the vault, generates/updates `INDEX.md` at both project and global level, commits, and pushes if a remote is configured. Also supports `search`, `status`, and `index` sub-commands.

**When to use:** To archive reference files, specs, or design documents outside the project repo for cross-project access.

```
/gerber:vault archive ./docs/spec.md
/gerber:vault archive ./docs/         # Archive entire folder
/gerber:vault search "authentication flow"
/gerber:vault status
/gerber:vault index                   # Rebuild all INDEX.md files
```
