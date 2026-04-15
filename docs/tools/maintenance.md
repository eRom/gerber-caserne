# Maintenance

Maintenance tools handle database operations that are not part of the core knowledge workflow: backups and statistics.

---

## backup_brain

Create a timestamped backup copy of the SQLite database. The WAL is checkpointed before the copy to ensure a consistent snapshot.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `label` | string | No | Optional label appended to the backup filename, max 64 chars |

### Example

**Request:**
```json
{ "label": "before-v4-migration" }
```

**Response:**
```json
{
  "ok": true,
  "path": "/Users/dev/.local/share/gerber/backups/gerber-2026-04-15T10-00-00-before-v4-migration.db",
  "sizeBytes": 2097152,
  "createdAt": 1744761600000
}
```

### Notes

- The WAL is checkpointed before copying to ensure no unflushed writes are missed.
- Backup files are placed in the configured backup directory (default: `~/.local/share/gerber/backups/`).
- Filename format: `gerber-<ISO8601>[-<label>].db`
- Backups are full SQLite database copies and can be restored with `pnpm mcp:restore <path>`.
- There is no automatic rotation — manage old backups manually.

---

## get_stats

Return counts for all major entities, optionally scoped to a single project.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `projectId` | string | No | Scope stats to this project UUID. Omit for global stats. |

### Example — global stats

**Request:**
```json
{}
```

**Response:**
```json
{
  "ok": true,
  "stats": {
    "projects": 4,
    "notes": {
      "total": 312,
      "atom": 287,
      "document": 25
    },
    "chunks": 1840,
    "tasks": {
      "total": 47,
      "inbox": 12,
      "brainstorming": 3,
      "specification": 2,
      "plan": 4,
      "implementation": 8,
      "test": 5,
      "done": 13
    },
    "issues": {
      "total": 18,
      "inbox": 6,
      "in_progress": 4,
      "in_review": 2,
      "closed": 6
    },
    "messages": {
      "total": 9,
      "pending": 3,
      "done": 6
    }
  }
}
```

### Example — project-scoped stats

**Request:**
```json
{ "projectId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890" }
```

**Response:**
```json
{
  "ok": true,
  "stats": {
    "projects": 1,
    "notes": {
      "total": 98,
      "atom": 85,
      "document": 13
    },
    "chunks": 620,
    "tasks": {
      "total": 15,
      "inbox": 4,
      "brainstorming": 0,
      "specification": 1,
      "plan": 2,
      "implementation": 5,
      "test": 1,
      "done": 2
    },
    "issues": {
      "total": 7,
      "inbox": 2,
      "in_progress": 2,
      "in_review": 1,
      "closed": 2
    },
    "messages": {
      "total": 3,
      "pending": 1,
      "done": 2
    }
  }
}
```

### Notes

- `chunks` counts embedding chunks, not notes. A single document note may generate 20+ chunks.
- When `projectId` is omitted, stats span all projects including the global project.
- Use this tool to get a health overview before a maintenance session or to verify that a bulk import completed successfully.
