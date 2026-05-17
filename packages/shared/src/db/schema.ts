import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  repoPath: text('repo_path'),
  color: text('color'),
  runCmd: text('run_cmd'),
  runCwd: text('run_cwd'),
  url: text('url'),
  envJson: text('env_json'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
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

export const runningProcesses = sqliteTable('running_processes', {
  projectId: text('project_id').primaryKey().references(() => projects.id, { onDelete: 'cascade' }),
  pid: integer('pid').notNull(),
  startedAt: integer('started_at').notNull(),
  logPath: text('log_path').notNull(),
  runCmd: text('run_cmd').notNull(),
});
