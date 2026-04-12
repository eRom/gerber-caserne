import { sqliteTable, text, integer, blob, primaryKey, index } from 'drizzle-orm/sqlite-core';

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  repoPath: text('repo_path'),
  color: text('color'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const notes = sqliteTable(
  'notes',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .default('00000000-0000-0000-0000-000000000000')
      .references(() => projects.id),
    kind: text('kind', { enum: ['atom', 'document'] }).notNull(),
    title: text('title').notNull(),
    content: text('content').notNull(),
    tags: text('tags').notNull().default('[]'),     // JSON array string
    status: text('status', { enum: ['draft', 'active', 'archived', 'deprecated'] }).notNull().default('active'),
    source: text('source', { enum: ['ai', 'human', 'import'] }).notNull(),
    contentHash: text('content_hash').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => ({
    projectIdx: index('notes_project_idx').on(t.projectId),
    kindStatusIdx: index('notes_kind_status_idx').on(t.kind, t.status),
    updatedIdx: index('notes_updated_idx').on(t.updatedAt),
  }),
);

export const chunks = sqliteTable(
  'chunks',
  {
    id: text('id').primaryKey(),
    noteId: text('note_id')
      .notNull()
      .references(() => notes.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    headingPath: text('heading_path'),
    content: text('content').notNull(),
    contentHash: text('content_hash').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (t) => ({
    noteIdx: index('chunks_note_idx').on(t.noteId),
    uniq: { name: 'chunks_note_position_uniq', columns: [t.noteId, t.position], unique: true } as any,
  }),
);

export const embeddings = sqliteTable(
  'embeddings',
  {
    ownerType: text('owner_type', { enum: ['note', 'chunk'] }).notNull(),
    ownerId: text('owner_id').notNull(),
    model: text('model').notNull(),
    dim: integer('dim').notNull(),
    contentHash: text('content_hash').notNull(),
    vector: blob('vector', { mode: 'buffer' }).notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.ownerType, t.ownerId, t.model] }),
    modelIdx: index('embeddings_model_idx').on(t.model),
  }),
);

export const appMeta = sqliteTable('app_meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export const messages = sqliteTable(
  'messages',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id),
    type: text('type', { enum: ['context', 'reminder'] }).notNull(),
    status: text('status', { enum: ['pending', 'done'] }).notNull().default('pending'),
    title: text('title').notNull(),
    content: text('content').notNull(),
    metadata: text('metadata').notNull().default('{}'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => ({
    projectStatusIdx: index('idx_messages_project_status').on(t.projectId, t.status),
    typeStatusIdx: index('idx_messages_type_status').on(t.type, t.status),
    createdAtIdx: index('idx_messages_created_at').on(t.createdAt),
  }),
);

export const tasks = sqliteTable(
  'tasks',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    status: text('status', { enum: ['active', 'waiting', 'someday', 'done'] }).notNull().default('active'),
    priority: text('priority', { enum: ['low', 'normal', 'high'] }).notNull().default('normal'),
    position: integer('position').notNull().default(0),
    assignee: text('assignee'),
    tags: text('tags').notNull().default('[]'),
    dueDate: integer('due_date'),
    waitingOn: text('waiting_on'),
    completedAt: integer('completed_at'),
    parentId: text('parent_id').references((): any => tasks.id),
    metadata: text('metadata').notNull().default('{}'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => ({
    projectStatusIdx: index('idx_tasks_project_status').on(t.projectId, t.status),
    parentIdx: index('idx_tasks_parent').on(t.parentId),
    statusPositionIdx: index('idx_tasks_status_position').on(t.status, t.position),
  }),
);

export const issues = sqliteTable(
  'issues',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    status: text('status', { enum: ['open', 'in_progress', 'resolved', 'closed'] }).notNull().default('open'),
    priority: text('priority', { enum: ['low', 'normal', 'high', 'critical'] }).notNull().default('normal'),
    severity: text('severity', { enum: ['bug', 'regression', 'warning', 'enhancement'] }).notNull().default('bug'),
    assignee: text('assignee'),
    tags: text('tags').notNull().default('[]'),
    relatedTaskId: text('related_task_id').references(() => tasks.id),
    metadata: text('metadata').notNull().default('{}'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => ({
    projectStatusIdx: index('idx_issues_project_status').on(t.projectId, t.status),
    severityIdx: index('idx_issues_severity').on(t.severity),
  }),
);
