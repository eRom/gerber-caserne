# Notes

Notes are the primary knowledge unit in Gerber. They come in two kinds:

- **atom** — a discrete, self-contained piece of information (a gotcha, a pattern, a decision). Stored and embedded as a single chunk.
- **document** — longer markdown content (specs, ADRs, reference pages). Automatically split into overlapping chunks for embedding search.

---

## note_create

Create a new note and trigger embedding generation.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `kind` | `"atom"` \| `"document"` | Yes | Note kind |
| `title` | string | Yes | Note title, max 200 chars |
| `content` | string | Yes | Markdown content, max 1 MB |
| `source` | `"ai"` \| `"human"` \| `"import"` | Yes | Who created the note |
| `tags` | string[] | No | Up to 20 tags, each max 40 chars |
| `projectId` | string | No | UUID of the target project |
| `projectSlug` | string | No | Slug of the target project (alternative to `projectId`) |

### Example

**Request:**
```json
{
  "kind": "atom",
  "title": "FTS5 rowid collision gotcha",
  "content": "When inserting into a contentless FTS5 table, the rowid must match the source table's rowid exactly. A mismatch causes phantom results.",
  "source": "ai",
  "tags": ["sqlite", "fts5", "gotcha"],
  "projectSlug": "agent-brain"
}
```

**Response:**
```json
{
  "ok": true,
  "item": {
    "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    "kind": "atom",
    "title": "FTS5 rowid collision gotcha",
    "content": "When inserting into a contentless FTS5 table...",
    "source": "ai",
    "status": "active",
    "tags": ["sqlite", "fts5", "gotcha"],
    "projectId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "createdAt": 1744761600000,
    "updatedAt": 1744761600000
  }
}
```

### Notes

- Use `projectSlug` OR `projectId`, never both. `projectSlug` is resolved to the UUID internally.
- Documents are chunked automatically after creation. The response returns immediately; embedding is async.
- New notes default to `status: "active"`.

---

## note_get

Retrieve a single note by ID.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | string | Yes | Note UUID |

### Example

**Request:**
```json
{ "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901" }
```

**Response:**
```json
{
  "ok": true,
  "item": {
    "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    "kind": "atom",
    "title": "FTS5 rowid collision gotcha",
    "content": "When inserting into a contentless FTS5 table...",
    "source": "ai",
    "status": "active",
    "tags": ["sqlite", "fts5", "gotcha"],
    "projectId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "createdAt": 1744761600000,
    "updatedAt": 1744761600000
  }
}
```

---

## note_update

Update one or more fields of an existing note. Re-chunks and re-embeds if `content` is changed.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | string | Yes | Note UUID |
| `title` | string | No | New title |
| `content` | string | No | New markdown content |
| `tags` | string[] | No | Replacement tag list (replaces all existing tags) |
| `status` | `"draft"` \| `"active"` \| `"archived"` \| `"deprecated"` | No | New status |
| `projectId` | string | No | Move note to this project (by UUID) |
| `projectSlug` | string | No | Move note to this project (by slug) |

### Example

**Request:**
```json
{
  "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "status": "archived",
  "tags": ["sqlite", "fts5", "gotcha", "resolved"]
}
```

**Response:**
```json
{
  "ok": true,
  "item": {
    "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    "kind": "atom",
    "title": "FTS5 rowid collision gotcha",
    "content": "When inserting into a contentless FTS5 table...",
    "source": "ai",
    "status": "archived",
    "tags": ["sqlite", "fts5", "gotcha", "resolved"],
    "projectId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "createdAt": 1744761600000,
    "updatedAt": 1744848000000
  }
}
```

### Notes

- `tags` is a full replacement — passing `["a"]` removes any tags not in the new array.
- If `content` changes on a `document`, all existing chunks are deleted and re-generated.
- Use `projectSlug` OR `projectId` to move the note, not both.

---

## note_delete

Permanently delete a note and all its chunks.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | string | Yes | Note UUID |

### Example

**Request:**
```json
{ "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901" }
```

**Response:**
```json
{ "ok": true }
```

### Notes

- Deletion is permanent. Associated embedding chunks are removed.
- The FTS5 index entry is also cleaned up via trigger.

---

## note_list

List notes with optional filters and pagination.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `kind` | `"atom"` \| `"document"` | No | Filter by kind |
| `status` | `"draft"` \| `"active"` \| `"archived"` \| `"deprecated"` | No | Filter by status |
| `source` | `"ai"` \| `"human"` \| `"import"` | No | Filter by source |
| `projectId` | string | No | Filter by project UUID |
| `projectSlug` | string | No | Filter by project slug |
| `tags_any` | string[] | No | Match notes that have at least one of these tags |
| `tags_all` | string[] | No | Match notes that have all of these tags |
| `sort` | string | No | Sort field: `created_at` (default), `updated_at` |
| `limit` | number | No | Max items (default 50, max 200) |
| `offset` | number | No | Pagination offset (default 0) |

### Example

**Request:**
```json
{
  "projectSlug": "agent-brain",
  "kind": "atom",
  "tags_any": ["gotcha", "sqlite"],
  "status": "active",
  "limit": 20
}
```

**Response:**
```json
{
  "ok": true,
  "items": [
    {
      "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
      "kind": "atom",
      "title": "FTS5 rowid collision gotcha",
      "content": "When inserting into a contentless FTS5 table...",
      "source": "ai",
      "status": "active",
      "tags": ["sqlite", "fts5", "gotcha"],
      "projectId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "createdAt": 1744761600000,
      "updatedAt": 1744761600000
    }
  ],
  "total": 1
}
```

### Notes

- `tags_any` and `tags_all` are evaluated with `json_each()` in SQL — not post-filtered in JS.
- Both can be combined: the result must satisfy both constraints simultaneously.
- `content` is included in list responses. For large document sets, prefer `search` to avoid large payloads.
