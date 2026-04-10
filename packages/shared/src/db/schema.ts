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
