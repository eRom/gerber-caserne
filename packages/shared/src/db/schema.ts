import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

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


