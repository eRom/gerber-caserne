# Issues

Issues track bugs, regressions, and improvement requests. Each project has its own issue board with a 4-column kanban flow.

**Status flow:**
```
inbox → in_progress → in_review → closed
```

Issues differ from tasks in two key ways: they have a **severity** dimension (what kind of problem it is) and a 4-level **priority** scale that includes `critical`.

---

## issue_create

Create a new issue in a project.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `projectSlug` | string | Yes | Slug of the target project |
| `title` | string | Yes | Issue title, max 200 chars |
| `description` | string | No | Markdown description |
| `status` | enum | No | Initial status (default: `"inbox"`) |
| `severity` | enum | No | Issue kind (see below) |
| `priority` | enum | No | Priority level (default: `"normal"`) |
| `assignee` | string | No | Assignee name or identifier |
| `tags` | string[] | No | Up to 20 tags |
| `metadata` | object | No | Extra data: `{ source?, reporter?, relatedNoteIds? }` |

**Status values:** `inbox` \| `in_progress` \| `in_review` \| `closed`

**Severity values:** `bug` \| `regression` \| `warning` \| `enhancement`

**Priority values:** `low` \| `normal` \| `high` \| `critical`

### Example

**Request:**
```json
{
  "projectSlug": "agent-brain",
  "title": "FTS5 triggers not firing after schema migration",
  "description": "After running the v3 migration, FTS5 `after_note_update` trigger is missing. Search returns stale results.",
  "severity": "regression",
  "priority": "high",
  "tags": ["sqlite", "fts5", "search"],
  "metadata": {
    "reporter": "romain",
    "relatedNoteIds": ["b2c3d4e5-f6a7-8901-bcde-f12345678901"]
  }
}
```

**Response:**
```json
{
  "ok": true,
  "item": {
    "id": "c9d0e1f2-a3b4-5678-cd45-789012345678",
    "projectId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "title": "FTS5 triggers not firing after schema migration",
    "description": "After running the v3 migration...",
    "status": "inbox",
    "severity": "regression",
    "priority": "high",
    "assignee": null,
    "tags": ["sqlite", "fts5", "search"],
    "relatedTaskId": null,
    "metadata": {
      "reporter": "romain",
      "relatedNoteIds": ["b2c3d4e5-f6a7-8901-bcde-f12345678901"]
    },
    "createdAt": 1744761600000,
    "updatedAt": 1744761600000
  }
}
```

---

## issue_list

List issues with optional filters and pagination.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `projectSlug` | string | No | Filter by project |
| `status` | enum | No | Filter by status |
| `severity` | enum | No | Filter by severity |
| `priority` | enum | No | Filter by priority |
| `tags_any` | string[] | No | Match issues with at least one of these tags |
| `limit` | number | No | Max items (default 50, max 200) |
| `offset` | number | No | Pagination offset (default 0) |

### Example

**Request:**
```json
{
  "projectSlug": "agent-brain",
  "status": "inbox",
  "priority": "critical",
  "limit": 10
}
```

**Response:**
```json
{
  "ok": true,
  "items": [
    {
      "id": "c9d0e1f2-a3b4-5678-cd45-789012345678",
      "projectId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "title": "FTS5 triggers not firing after schema migration",
      "status": "inbox",
      "severity": "regression",
      "priority": "high",
      "tags": ["sqlite", "fts5", "search"],
      "createdAt": 1744761600000,
      "updatedAt": 1744761600000
    }
  ],
  "total": 1
}
```

---

## issue_get

Get an issue by ID.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | string | Yes | Issue UUID |

### Example

**Request:**
```json
{ "id": "c9d0e1f2-a3b4-5678-cd45-789012345678" }
```

**Response:**
```json
{
  "ok": true,
  "item": {
    "id": "c9d0e1f2-a3b4-5678-cd45-789012345678",
    "projectId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "title": "FTS5 triggers not firing after schema migration",
    "description": "After running the v3 migration...",
    "status": "in_progress",
    "severity": "regression",
    "priority": "high",
    "assignee": "romain",
    "tags": ["sqlite", "fts5", "search"],
    "relatedTaskId": "f6a7b8c9-d0e1-2345-fab2-456789012345",
    "metadata": {
      "reporter": "romain",
      "relatedNoteIds": ["b2c3d4e5-f6a7-8901-bcde-f12345678901"]
    },
    "createdAt": 1744761600000,
    "updatedAt": 1744848000000
  }
}
```

---

## issue_update

Update one or more fields of an existing issue.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | string | Yes | Issue UUID |
| `title` | string | No | New title |
| `description` | string | No | New description |
| `status` | enum | No | New status |
| `severity` | enum | No | New severity |
| `priority` | enum | No | New priority |
| `assignee` | string \| null | No | New assignee (null to clear) |
| `tags` | string[] | No | Replacement tag list |
| `relatedTaskId` | string \| null | No | Link to a task UUID, or null to unlink |
| `metadata` | object | No | Merged metadata update |

### Example

**Request:**
```json
{
  "id": "c9d0e1f2-a3b4-5678-cd45-789012345678",
  "status": "in_progress",
  "assignee": "romain",
  "relatedTaskId": "f6a7b8c9-d0e1-2345-fab2-456789012345"
}
```

**Response:**
```json
{
  "ok": true,
  "item": {
    "id": "c9d0e1f2-a3b4-5678-cd45-789012345678",
    "title": "FTS5 triggers not firing after schema migration",
    "status": "in_progress",
    "assignee": "romain",
    "relatedTaskId": "f6a7b8c9-d0e1-2345-fab2-456789012345",
    "updatedAt": 1744848000000
  }
}
```

### Notes

- `relatedTaskId` links the issue to a task for cross-referencing in the UI.
- `assignee` accepts `null` to remove the assignment.

---

## issue_close

Shorthand to close an issue. Equivalent to `issue_update` with `status: "closed"`.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | string | Yes | Issue UUID |

### Example

**Request:**
```json
{ "id": "c9d0e1f2-a3b4-5678-cd45-789012345678" }
```

**Response:**
```json
{
  "ok": true,
  "item": {
    "id": "c9d0e1f2-a3b4-5678-cd45-789012345678",
    "title": "FTS5 triggers not firing after schema migration",
    "status": "closed",
    "updatedAt": 1744934400000
  }
}
```

### Notes

- Use this instead of `issue_update` when the only intent is closing the issue — it is more explicit and readable in logs.
