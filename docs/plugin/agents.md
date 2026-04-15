# Agents

The plugin includes 2 sub-agents. They are not called directly — skills dispatch them in the background with all necessary parameters pre-resolved.

## How Agents Work

Agents are defined as markdown files with YAML frontmatter. The frontmatter declares the agent name, model, allowed tools, and a display color. The body of the file is the system prompt.

Skills dispatch agents via the `Agent` tool with `run_in_background: true` and `mode: bypassPermissions`. The skill resolves all parameters (project slug, file paths, metadata) before dispatch, so the agent receives a fully-formed prompt and never needs to ask clarifying questions.

---

## `gerber:agent-status`

**Dispatched by:** `/gerber:status`
**Model:** Sonnet
**Tools:** `Bash`, `Read`, `Glob`, `Grep`, `mcp__gerber__note_list`, `mcp__gerber__task_list`, `mcp__gerber__issue_list`

Generates the project dashboard. Receives project metadata from the skill and fetches all counters in parallel.

**What it does:**

1. Retrieves the Git remote URL from the project's repo path via Bash.
2. Fires 6 parallel MCP calls: atom count, document count, total tasks, done tasks, total issues, inbox issues.
3. Computes `pendingTasks = totalTasks - doneTasks`.
4. Returns a formatted dashboard:

```
=== My Project ===

Description : Short project description
Repo Path   : /Users/romain/dev/my-project
Repo Git    : git@github.com:romain/my-project.git
Created     : 01 Apr 2026 | Updated : 10 Apr 2026
Badge       : #10B981

--- Resume ---
Notes  : 42 Atom(s) | 7 Document(s)
Tasks  : 5 pending / 12 total
Issues : 2 inbox / 6 total
```

**Read-only.** Creates and modifies nothing.

---

## `gerber:agent-vault`

**Dispatched by:** `/gerber:vault archive` and `/gerber:vault index`
**Model:** Sonnet
**Tools:** `Bash`, `Read`, `Write`, `Glob`, `Grep`

Handles file archival and index regeneration in the local vault git repository (`~/.config/gerber-vault/`).

**Operations:**

### `archive`

Receives: `SLUG`, list of absolute file paths, `REPO_ROOT`.

1. Verifies `~/.config/gerber-vault/.git` exists. Stops with an error if not.
2. Creates `~/.config/gerber-vault/{SLUG}/` if needed.
3. Copies each file, preserving its relative path from `REPO_ROOT`.
4. Updates `~/.config/gerber-vault/{SLUG}/INDEX.md` — adds new entries, skips already-indexed files.
5. Regenerates the global `~/.config/gerber-vault/INDEX.md` with per-project file counts and last-archive dates.
6. Commits with message `archive({SLUG}): +N fichier(s)` and pushes if a remote is configured. Missing remote is not an error.

Output:
```
Archive terminee -- my-project
---------------------------
Ajoutes  : 3 fichier(s)
Skipped  : 1 (deja presents)
Total    : 12 fichier(s) dans le vault
Commit   : OK
Push     : skipped (no remote)
```

### `index`

No parameters. Scans all project folders in the vault, rebuilds every `INDEX.md` from actual file contents, regenerates the global index, and commits.

**Never deletes files.** Uses `trash` instead of `rm` if removal is ever needed.
