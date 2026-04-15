# Projects

Projects are named workspaces that group notes, tasks, and issues. Every Gerber installation has a built-in global project (`id: 00000000-0000-0000-0000-000000000000`) that acts as the default container when no project is specified.

---

## project_create

Create a new project.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `slug` | string | Yes | URL-safe identifier, max 64 chars (e.g. `agent-brain`) |
| `name` | string | Yes | Human-readable display name, max 120 chars |
| `description` | string | No | Short description, max 500 chars |
| `repoPath` | string | No | Absolute path to the associated git repository |
| `color` | string | No | Hex color for UI display (e.g. `#6366f1`) |

### Example

**Request:**
```json
{
  "slug": "agent-brain",
  "name": "Agent Brain",
  "description": "MCP memory server for Claude agents",
  "repoPath": "/Users/dev/agent-brain",
  "color": "#6366f1"
}
```

**Response:**
```json
{
  "ok": true,
  "item": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "slug": "agent-brain",
    "name": "Agent Brain",
    "description": "MCP memory server for Claude agents",
    "repoPath": "/Users/dev/agent-brain",
    "color": "#6366f1",
    "createdAt": 1744761600000,
    "updatedAt": 1744761600000
  }
}
```

### Notes

- `slug` must be unique across all projects. Attempting to create a duplicate slug returns an error.
- `color` is free-form — any CSS-compatible string is accepted. Convention is a 6-digit hex (`#rrggbb`).

---

## project_list

List all projects with optional pagination.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `limit` | number | No | Max items to return (default 50, max 200) |
| `offset` | number | No | Pagination offset (default 0) |

### Example

**Request:**
```json
{ "limit": 10, "offset": 0 }
```

**Response:**
```json
{
  "ok": true,
  "items": [
    {
      "id": "00000000-0000-0000-0000-000000000000",
      "slug": "global",
      "name": "Global",
      "description": null,
      "repoPath": null,
      "color": null,
      "createdAt": 1700000000000,
      "updatedAt": 1700000000000
    },
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "slug": "agent-brain",
      "name": "Agent Brain",
      "description": "MCP memory server for Claude agents",
      "repoPath": "/Users/dev/agent-brain",
      "color": "#6366f1",
      "createdAt": 1744761600000,
      "updatedAt": 1744761600000
    }
  ],
  "total": 2
}
```

### Notes

- The global project is always present and is returned in the list.
- Results are ordered by `createdAt` ascending.

---

## project_update

Update one or more fields of an existing project.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | string | Yes | Project UUID |
| `slug` | string | No | New slug (must remain unique) |
| `name` | string | No | New display name |
| `description` | string | No | New description |
| `repoPath` | string | No | New repository path |
| `color` | string | No | New color |

### Example

**Request:**
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "color": "#10b981",
  "description": "MCP memory + task server for Claude agents"
}
```

**Response:**
```json
{
  "ok": true,
  "item": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "slug": "agent-brain",
    "name": "Agent Brain",
    "description": "MCP memory + task server for Claude agents",
    "repoPath": "/Users/dev/agent-brain",
    "color": "#10b981",
    "createdAt": 1744761600000,
    "updatedAt": 1744848000000
  }
}
```

### Notes

- Only fields explicitly provided are updated. Omitted fields retain their current values.
- The global project (`id: 00000000-0000-0000-0000-000000000000`) cannot be deleted but can be updated.

---

## project_delete

Delete a project. All notes previously assigned to the project are reassigned to the global project; they are not deleted.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | string | Yes | Project UUID to delete |

### Example

**Request:**
```json
{ "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890" }
```

**Response:**
```json
{ "ok": true }
```

### Notes

- The global project (`00000000-0000-0000-0000-000000000000`) cannot be deleted.
- Notes are reassigned to the global project automatically — no data is lost.
- Tasks and issues associated with the project are also deleted.
