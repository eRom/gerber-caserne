# Messages

Messages are the inter-session communication bus. They allow one Claude session (or agent) to leave information for a future session without requiring shared memory or a running process.

Two types are supported:

- **context** — background information a future session should be aware of (e.g., "we decided X in the last session")
- **reminder** — an actionable item to handle at the start of the next session (e.g., "run the migration before doing anything else")

Messages start with status `pending` and are marked `done` once read and acted upon.

---

## message_create

Create an inter-session message targeting a project.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `projectSlug` | string | Yes | Slug of the target project |
| `type` | `"context"` \| `"reminder"` | Yes | Message type |
| `title` | string | Yes | Short title, max 200 chars |
| `content` | string | Yes | Full message content (markdown supported) |
| `metadata` | object | No | Optional: `{ source?, sourceProject? }` |

### Example

**Request:**
```json
{
  "projectSlug": "agent-brain",
  "type": "reminder",
  "title": "Run v4 migration before starting",
  "content": "The WAL checkpoint logic changed in v4. Run `pnpm db:migrate` before touching any DB code. See issue #42.",
  "metadata": {
    "source": "session-end",
    "sourceProject": "agent-brain"
  }
}
```

**Response:**
```json
{
  "ok": true,
  "item": {
    "id": "d0e1f2a3-b4c5-6789-de56-890123456789",
    "projectId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "type": "reminder",
    "title": "Run v4 migration before starting",
    "content": "The WAL checkpoint logic changed in v4...",
    "status": "pending",
    "metadata": {
      "source": "session-end",
      "sourceProject": "agent-brain"
    },
    "createdAt": 1744761600000,
    "updatedAt": 1744761600000
  }
}
```

---

## message_list

List messages with optional filters. Use this at the start of a session to check for pending reminders and context.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `projectSlug` | string | No | Filter by project |
| `type` | `"context"` \| `"reminder"` | No | Filter by message type |
| `status` | `"pending"` \| `"done"` | No | Filter by status |
| `since` | number | No | Unix timestamp (ms) — return only messages created after this time |
| `limit` | number | No | Max items (default 50, max 200) |

### Example

**Request:**
```json
{
  "projectSlug": "agent-brain",
  "status": "pending"
}
```

**Response:**
```json
{
  "ok": true,
  "items": [
    {
      "id": "d0e1f2a3-b4c5-6789-de56-890123456789",
      "projectId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "type": "reminder",
      "title": "Run v4 migration before starting",
      "content": "The WAL checkpoint logic changed in v4...",
      "status": "pending",
      "metadata": { "source": "session-end" },
      "createdAt": 1744761600000,
      "updatedAt": 1744761600000
    }
  ],
  "total": 1,
  "pendingCount": 1
}
```

### Notes

- `pendingCount` is always returned, regardless of the `status` filter. It reflects the total number of pending messages matching the other filters.
- Use `since` to fetch only messages created after a given session started, avoiding re-processing old messages.

---

## message_update

Update a message's status, content, or metadata. Typically used to mark a message as `done` after reading it.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | string | Yes | Message UUID |
| `status` | `"pending"` \| `"done"` | No | New status |
| `content` | string | No | New content |
| `metadata` | object | No | Merged metadata update |

### Example

**Request:**
```json
{
  "id": "d0e1f2a3-b4c5-6789-de56-890123456789",
  "status": "done"
}
```

**Response:**
```json
{
  "ok": true,
  "item": {
    "id": "d0e1f2a3-b4c5-6789-de56-890123456789",
    "type": "reminder",
    "title": "Run v4 migration before starting",
    "status": "done",
    "updatedAt": 1744848000000
  }
}
```

### Notes

- Mark messages `done` after acting on them so they do not clutter future `message_list` results.
- `content` can be updated to append resolution notes before marking done.
