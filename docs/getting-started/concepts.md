# Concepts

A reference for the core data model: what each entity is, how it behaves, and when to use it.

## Projects

Projects are isolated namespaces. Every note, task, issue, and message belongs to exactly one project.

| Field | Type | Notes |
|-------|------|-------|
| `slug` | string (max 64) | Unique identifier used in tool calls |
| `name` | string | Display name |
| `repoPath` | string (optional) | Absolute path to the associated repository |
| `badgeColor` | string (optional) | Hex color for UI display |

Use `projectSlug` (not `projectId`) in tool calls — it's the stable, human-readable handle.

**Global project**: ID `00000000-0000-0000-0000-000000000000`. Holds notes not assigned to any specific project. Useful for cross-cutting knowledge that doesn't belong to a single codebase.

---

## Notes

Notes are the primary knowledge unit. There are two kinds:

### atom

Short, self-contained facts. Gotchas, patterns, architectural decisions, API quirks, one-liners. Intended to be written quickly and retrieved often.

### document

Long-form content: architecture overviews, meeting notes, runbooks, specs. Documents are automatically chunked into overlapping segments before embedding. This means search can surface a relevant paragraph from a 10,000-word document.

### Statuses

Notes follow a lifecycle:

```
draft → active → archived → deprecated
```

- `draft` — work in progress, not yet reliable
- `active` — current and trustworthy (default on creation)
- `archived` — no longer relevant but preserved for history
- `deprecated` — superseded by a newer note; search filters these out by default

### Sources

| Value | Meaning |
|-------|---------|
| `ai` | Written by an AI agent |
| `human` | Written by a human |
| `import` | Migrated from an external source |

Source attribution lets you filter by who produced the knowledge.

### Tags

Up to 20 tags per note, each up to 40 characters. Tags are lowercase strings. Use `tags_any` to filter notes matching at least one tag, `tags_all` to require all tags.

---

## Tasks

Tasks implement a 7-column kanban workflow:

```
inbox → brainstorming → specification → plan → implementation → test → done
```

This maps directly to the software development lifecycle. New tasks land in `inbox` and move right as they progress.

### Fields

| Field | Type | Notes |
|-------|------|-------|
| `title` | string | Required |
| `status` | enum | One of the 7 columns above |
| `priority` | enum | `low`, `normal`, `high` |
| `assignee` | string (optional) | Free text — name or agent ID |
| `dueDate` | timestamp (optional) | Unix timestamp |
| `waitingOn` | string (optional) | Free text — what's blocking this task |
| `parentId` | UUID (optional) | Links this task as a subtask of another |

### Subtasks

A task becomes a subtask by setting `parentId` to an existing task's UUID. `task_list` excludes subtasks by default — pass `includeSubtasks: true` to show them. Use `task_get` with the parent ID to retrieve a task with its subtasks inline.

### Reordering

Tasks within a column are ordered. Use `task_reorder` with an array of task IDs in the desired order to set explicit ordering within a status column.

---

## Issues

Issues track bugs and feedback with a 4-column kanban:

```
inbox → in_progress → in_review → closed
```

### Fields

| Field | Type | Notes |
|-------|------|-------|
| `title` | string | Required |
| `status` | enum | One of the 4 columns above |
| `severity` | enum | `bug`, `regression`, `warning`, `enhancement` |
| `priority` | enum | `low`, `normal`, `high`, `critical` (4 levels, vs 3 for tasks) |
| `relatedTaskId` | UUID (optional) | Links this issue to a task |

### Severity levels

| Severity | When to use |
|----------|------------|
| `bug` | Something broken that shouldn't be |
| `regression` | Something that used to work and no longer does |
| `warning` | Potential problem or code smell, not yet broken |
| `enhancement` | Improvement request, not a defect |

### Closing issues

Use `issue_close` as a shorthand for setting `status` to `closed`. Equivalent to `issue_update` with `status: "closed"`.

---

## Messages

Messages are an inter-session communication bus. They allow one agent session to leave information for a future session — or for a human.

### Types

| Type | Meaning |
|------|---------|
| `context` | Background information the next session should know |
| `reminder` | An action is required — the next session must handle this |

### Lifecycle

Messages start with `status: "pending"`. Once read and acted on, mark them `done` via `message_update`. The Gerber Claude Code plugin polls pending messages automatically at session start, so `reminder` messages surface without any manual retrieval.

### Fields

| Field | Type | Notes |
|-------|------|-------|
| `projectSlug` | string | Target project |
| `type` | enum | `context` or `reminder` |
| `content` | string | The message body |
| `source` | string (optional) | Who sent it (agent ID, username) |
| `sourceProject` | string (optional) | Origin project if cross-project |

---

## Search

Gerber's search engine supports three modes:

| Mode | Engine | Best for |
|------|--------|----------|
| `hybrid` (default) | Semantic + FTS5, scores merged | General-purpose retrieval |
| `semantic` | E5 embeddings, cosine similarity | Conceptual queries, paraphrased content |
| `fulltext` | FTS5 with BM25 ranking | Exact terms, identifiers, stack traces |

### Filters

All modes support the same filter parameters:

| Parameter | Type | Effect |
|-----------|------|--------|
| `projectId` | UUID | Scope to one project |
| `kind` | enum | `atom` or `document` |
| `status` | enum | Note status |
| `source` | enum | `ai`, `human`, `import` |
| `tags_any` | string[] | Match notes with at least one of these tags |
| `tags_all` | string[] | Match notes that have all of these tags |

### Neighbors

The `neighbors` parameter (integer, 0–3) controls how many surrounding chunks are returned alongside a matching chunk. Setting `neighbors: 1` returns the chunk before and after each hit, giving the agent more context around the matched segment without retrieving the entire document.
