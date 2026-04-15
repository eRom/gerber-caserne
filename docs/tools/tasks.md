# Tasks

Tasks are the project management layer of Gerber. Each project has its own task board with a 7-column kanban flow. Tasks support subtasks (one level deep), due dates, priority, and free-form metadata.

**Status flow:**
```
inbox → brainstorming → specification → plan → implementation → test → done
```

---

## task_create

Create a new task in a project.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `projectSlug` | string | Yes | Slug of the target project |
| `title` | string | Yes | Task title, max 200 chars |
| `description` | string | No | Markdown description |
| `status` | enum | No | Initial status (default: `"inbox"`) |
| `priority` | `"low"` \| `"normal"` \| `"high"` | No | Task priority (default: `"normal"`) |
| `assignee` | string | No | Assignee name or identifier |
| `tags` | string[] | No | Up to 20 tags |
| `dueDate` | number | No | Due date as Unix timestamp (ms) |
| `waitingOn` | string | No | Free-form blocker description |
| `parentId` | string | No | UUID of parent task — creates a subtask |
| `metadata` | object | No | Extra data: `{ source?, relatedNoteIds? }` |

**Status values:** `inbox` \| `brainstorming` \| `specification` \| `plan` \| `implementation` \| `test` \| `done`

### Example

**Request:**
```json
{
  "projectSlug": "agent-brain",
  "title": "Implement semantic search with neighbors expansion",
  "description": "Add the `neighbors` parameter to the search tool to return surrounding chunks.",
  "status": "implementation",
  "priority": "high",
  "tags": ["search", "embeddings"],
  "metadata": {
    "relatedNoteIds": ["b2c3d4e5-f6a7-8901-bcde-f12345678901"]
  }
}
```

**Response:**
```json
{
  "ok": true,
  "item": {
    "id": "f6a7b8c9-d0e1-2345-fab2-456789012345",
    "projectId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "title": "Implement semantic search with neighbors expansion",
    "description": "Add the `neighbors` parameter...",
    "status": "implementation",
    "priority": "high",
    "assignee": null,
    "tags": ["search", "embeddings"],
    "dueDate": null,
    "waitingOn": null,
    "parentId": null,
    "position": 1,
    "completedAt": null,
    "metadata": { "relatedNoteIds": ["b2c3d4e5-f6a7-8901-bcde-f12345678901"] },
    "createdAt": 1744761600000,
    "updatedAt": 1744761600000
  }
}
```

### Notes

- Pass `parentId` to create a subtask. Subtasks appear nested under their parent in `task_get`.
- `dueDate` is stored as a Unix timestamp in milliseconds.

---

## task_list

List tasks with optional filters. Excludes subtasks by default.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `projectSlug` | string | No | Filter by project |
| `status` | enum | No | Filter by status |
| `priority` | `"low"` \| `"normal"` \| `"high"` | No | Filter by priority |
| `tags_any` | string[] | No | Match tasks with at least one of these tags |
| `parentId` | string | No | List subtasks of this parent task UUID |
| `sort` | `"position"` \| `"created_at"` \| `"updated_at"` \| `"due_date"` | No | Sort order (default: `"position"`) |
| `limit` | number | No | Max items (default 50, max 200) |
| `offset` | number | No | Pagination offset (default 0) |

### Example

**Request:**
```json
{
  "projectSlug": "agent-brain",
  "status": "implementation",
  "sort": "due_date",
  "limit": 20
}
```

**Response:**
```json
{
  "ok": true,
  "items": [
    {
      "id": "f6a7b8c9-d0e1-2345-fab2-456789012345",
      "projectId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "title": "Implement semantic search with neighbors expansion",
      "status": "implementation",
      "priority": "high",
      "tags": ["search", "embeddings"],
      "dueDate": null,
      "position": 1,
      "completedAt": null,
      "createdAt": 1744761600000,
      "updatedAt": 1744761600000
    }
  ],
  "total": 1
}
```

### Notes

- Top-level tasks only by default. To list subtasks, pass `parentId` with the parent task UUID.
- `sort: "position"` reflects manual drag-and-drop order set by `task_reorder`.

---

## task_get

Get a task by ID, including its subtasks.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | string | Yes | Task UUID |

### Example

**Request:**
```json
{ "id": "f6a7b8c9-d0e1-2345-fab2-456789012345" }
```

**Response:**
```json
{
  "ok": true,
  "item": {
    "id": "f6a7b8c9-d0e1-2345-fab2-456789012345",
    "projectId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "title": "Implement semantic search with neighbors expansion",
    "status": "implementation",
    "priority": "high",
    "subtasks": [
      {
        "id": "a7b8c9d0-e1f2-3456-ab23-567890123456",
        "title": "Write unit tests for neighbors expansion",
        "status": "test",
        "priority": "normal"
      }
    ],
    "createdAt": 1744761600000,
    "updatedAt": 1744761600000
  }
}
```

---

## task_update

Update a task. Handles `completedAt` automatically when moving to or from `done`.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | string | Yes | Task UUID |
| `title` | string | No | New title |
| `description` | string | No | New description |
| `status` | enum | No | New status |
| `priority` | `"low"` \| `"normal"` \| `"high"` | No | New priority |
| `assignee` | string \| null | No | New assignee (null to clear) |
| `tags` | string[] | No | Replacement tag list |
| `dueDate` | number \| null | No | New due date in ms, or null to clear |
| `waitingOn` | string \| null | No | New blocker, or null to clear |
| `metadata` | object | No | Merged metadata update |

### Example

**Request:**
```json
{
  "id": "f6a7b8c9-d0e1-2345-fab2-456789012345",
  "status": "test"
}
```

**Response:**
```json
{
  "ok": true,
  "item": {
    "id": "f6a7b8c9-d0e1-2345-fab2-456789012345",
    "title": "Implement semantic search with neighbors expansion",
    "status": "test",
    "completedAt": null,
    "updatedAt": 1744848000000
  }
}
```

### Notes

- `completedAt` is set automatically when `status` changes to `"done"`, and cleared when moving away from `"done"`.
- Nullable fields (`assignee`, `dueDate`, `waitingOn`) accept `null` to remove the value.

---

## task_delete

Delete a task and all its subtasks.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | string | Yes | Task UUID |

### Example

**Request:**
```json
{ "id": "f6a7b8c9-d0e1-2345-fab2-456789012345" }
```

**Response:**
```json
{ "ok": true, "deletedCount": 2 }
```

### Notes

- `deletedCount` includes the parent task plus all subtasks.
- Deletion is permanent and cascades to all subtasks.

---

## task_reorder

Set the display order of tasks by providing an ordered array of task UUIDs.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `ids` | string[] | Yes | Ordered array of task UUIDs. Position is derived from array index. |

### Example

**Request:**
```json
{
  "ids": [
    "a7b8c9d0-e1f2-3456-ab23-567890123456",
    "f6a7b8c9-d0e1-2345-fab2-456789012345",
    "b8c9d0e1-f2a3-4567-bc34-678901234567"
  ]
}
```

**Response:**
```json
{ "ok": true }
```

### Notes

- Position `0` is assigned to the first UUID in the array, `1` to the second, etc.
- Only tasks in the provided array are reordered. Tasks not in the array retain their current position.
- Typically called after a drag-and-drop reorder in the UI.
