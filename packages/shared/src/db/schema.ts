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

export const tasks = sqliteTable(
  'tasks',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    status: text('status', { enum: ['inbox', 'brainstorming', 'specification', 'plan', 'implementation', 'test', 'done'] }).notNull().default('inbox'),
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
    status: text('status', { enum: ['inbox', 'in_progress', 'in_review', 'closed'] }).notNull().default('inbox'),
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

export const handoffs = sqliteTable(
  'handoffs',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    content: text('content').notNull().default(''),
    status: text('status', { enum: ['inbox', 'done'] }).notNull().default('inbox'),
    createdAt: integer('created_at').notNull(),
  },
  (t) => ({
    statusIdx: index('idx_handoffs_status').on(t.status),
    createdAtIdx: index('idx_handoffs_created_at').on(t.createdAt),
  }),
);

export const runningProcesses = sqliteTable('running_processes', {
  projectId: text('project_id').primaryKey().references(() => projects.id, { onDelete: 'cascade' }),
  pid: integer('pid').notNull(),
  startedAt: integer('started_at').notNull(),
  logPath: text('log_path').notNull(),
  runCmd: text('run_cmd').notNull(),
});
