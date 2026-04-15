# Database

Gerber uses a single SQLite database file with WAL mode and FTS5 for fulltext search.

## Location

Default path: `~/.agent-brain/brain.db`

Override with the `--db-path` CLI flag when starting the server.

## Initialization

Database connection is opened in `packages/mcp/src/db/index.ts`. Pragma order matters:

```typescript
db.pragma('journal_mode = WAL');   // Must be first
db.pragma('busy_timeout = 5000');  // Prevents SQLITE_BUSY on concurrent access
db.pragma('foreign_keys = ON');
db.pragma('recursive_triggers = ON');
```

WAL mode must be set before `busy_timeout`. The 5000 ms busy timeout is required because the HTTP server and background reindex can hit the DB concurrently.

## Schema

Schema is defined with Drizzle ORM in `packages/shared/src/db/schema.ts`.

### projects

Central namespace for all entities.

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | UUID |
| slug | TEXT UNIQUE | URL-friendly identifier |
| name | TEXT | Display name |
| description | TEXT | Optional |
| repo_path | TEXT | Optional local repo path |
| color | TEXT | Optional UI accent color |
| created_at | INTEGER | Unix timestamp |
| updated_at | INTEGER | Unix timestamp |

### notes

Knowledge atoms and documents.

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | UUID |
| project_id | TEXT FK | References `projects.id`, default `00000000-…` |
| kind | TEXT | `atom` or `document` |
| title | TEXT | |
| content | TEXT | Markdown |
| tags | TEXT | JSON array string, e.g. `["rust","perf"]` |
| status | TEXT | `draft`, `active`, `archived`, `deprecated` |
| source | TEXT | `ai`, `human`, or `import` |
| content_hash | TEXT | SHA-256 of content, used for dedup |
| created_at | INTEGER | Unix timestamp |
| updated_at | INTEGER | Unix timestamp |

Indexes: `(project_id)`, `(kind, status)`, `(updated_at)`

### chunks

Markdown chunks produced by the AST chunker. One note produces 1..N chunks.

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | UUID |
| note_id | TEXT FK | References `notes.id`, CASCADE DELETE |
| position | INTEGER | 0-based index within the note |
| heading_path | TEXT | Breadcrumb, e.g. `Introduction > Setup` |
| content | TEXT | Chunk text (markdown) |
| content_hash | TEXT | SHA-256 of content |
| created_at | INTEGER | Unix timestamp |

Unique constraint on `(note_id, position)`.

### embeddings

Stores vector embeddings for notes and chunks. Polymorphic: `owner_type` + `owner_id` identifies the target.

| Column | Type | Notes |
|--------|------|-------|
| owner_type | TEXT | `note` or `chunk` |
| owner_id | TEXT | UUID of the owner |
| model | TEXT | Model identifier, e.g. `Xenova/multilingual-e5-base` |
| dim | INTEGER | Vector dimensionality |
| content_hash | TEXT | Hash of the content at embedding time |
| vector | BLOB | Raw Float32Array bytes |
| created_at | INTEGER | Unix timestamp |

Primary key on `(owner_type, owner_id, model)`. A `embedding_owners` view joins this table with notes/chunks metadata to enable pre-filtered vector search.

### tasks

Project tasks with a 7-column kanban workflow.

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | UUID |
| project_id | TEXT FK | |
| title | TEXT | |
| description | TEXT | Markdown, default `''` |
| status | TEXT | `inbox` → `brainstorming` → `specification` → `plan` → `implementation` → `test` → `done` |
| priority | TEXT | `low`, `normal`, `high` |
| position | INTEGER | Order within a status column |
| assignee | TEXT | Optional |
| tags | TEXT | JSON array string |
| due_date | INTEGER | Optional Unix timestamp |
| waiting_on | TEXT | Optional free-text dependency |
| completed_at | INTEGER | Set when status = `done` |
| parent_id | TEXT FK | Self-reference for subtasks |
| metadata | TEXT | JSON object, default `{}` |
| created_at | INTEGER | Unix timestamp |
| updated_at | INTEGER | Unix timestamp |

Indexes: `(project_id, status)`, `(parent_id)`, `(status, position)`

### issues

Bug reports and enhancements with a 4-column kanban.

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | UUID |
| project_id | TEXT FK | |
| title | TEXT | |
| description | TEXT | Markdown, default `''` |
| status | TEXT | `inbox`, `in_progress`, `in_review`, `closed` |
| priority | TEXT | `low`, `normal`, `high`, `critical` |
| severity | TEXT | `bug`, `regression`, `warning`, `enhancement` |
| assignee | TEXT | Optional |
| tags | TEXT | JSON array string |
| related_task_id | TEXT FK | Optional link to a task |
| metadata | TEXT | JSON object |
| created_at | INTEGER | Unix timestamp |
| updated_at | INTEGER | Unix timestamp |

### messages

Inter-session message bus. Used to pass context or reminders between Claude sessions.

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | UUID |
| project_id | TEXT FK | |
| type | TEXT | `context` or `reminder` |
| status | TEXT | `pending` or `done` |
| title | TEXT | |
| content | TEXT | Markdown |
| metadata | TEXT | JSON object |
| created_at | INTEGER | Unix timestamp |
| updated_at | INTEGER | Unix timestamp |

### app_meta

Key-value store for application metadata (schema version, config values).

| Column | Type |
|--------|------|
| key | TEXT PK |
| value | TEXT |

## FTS5 Fulltext Search

A virtual `notes_fts` table indexes note and chunk content. A companion `fts_source` table maps FTS5 rowids back to `(source_type, source_id)` pairs. Triggers keep both in sync on insert/update/delete.

Query sanitization strips FTS5 special characters (`.(){}[]"*:^~` etc.) before building the `MATCH` expression, while preserving intentional `OR`/`AND`/`NOT` operators.

## camelCase / snake_case Mapping

Drizzle returns column names in camelCase (matching TypeScript field names), while raw SQLite queries return snake_case. Always use the helper functions when reading raw rows:

```typescript
toProject(row)   // raw SQLite row → Project type
toNote(row)      // raw SQLite row → Note type
// etc.
```

Never map columns manually outside these helpers — they are the single source of truth for field name translation.

## Migrations

Drizzle Kit manages migrations. Migration files are in `packages/mcp/src/db/migrations/`. Run migrations with:

```bash
pnpm --filter @agent-brain/mcp db:migrate
```

## Backup

The `backup_brain` MCP tool checkpoints the WAL file before copying the database. This ensures the backup is consistent and does not include uncommitted WAL frames. Implementation: `packages/mcp/src/db/backup.ts`.

```bash
pnpm mcp:restore <path>   # Restore DB from a backup
```
