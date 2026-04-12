-- Step 1: Create tasks table
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL REFERENCES `projects`(`id`),
	`title` text NOT NULL,
	`description` text NOT NULL DEFAULT '',
	`status` text NOT NULL DEFAULT 'active',
	`priority` text NOT NULL DEFAULT 'normal',
	`position` integer NOT NULL DEFAULT 0,
	`assignee` text,
	`tags` text NOT NULL DEFAULT '[]',
	`due_date` integer,
	`waiting_on` text,
	`completed_at` integer,
	`parent_id` text REFERENCES `tasks`(`id`),
	`metadata` text NOT NULL DEFAULT '{}',
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_tasks_project_status` ON `tasks` (`project_id`, `status`);
--> statement-breakpoint
CREATE INDEX `idx_tasks_parent` ON `tasks` (`parent_id`);
--> statement-breakpoint
CREATE INDEX `idx_tasks_status_position` ON `tasks` (`status`, `position`);
--> statement-breakpoint

-- Step 2: Create issues table
CREATE TABLE `issues` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL REFERENCES `projects`(`id`),
	`title` text NOT NULL,
	`description` text NOT NULL DEFAULT '',
	`status` text NOT NULL DEFAULT 'open',
	`priority` text NOT NULL DEFAULT 'normal',
	`severity` text NOT NULL DEFAULT 'bug',
	`assignee` text,
	`tags` text NOT NULL DEFAULT '[]',
	`related_task_id` text REFERENCES `tasks`(`id`),
	`metadata` text NOT NULL DEFAULT '{}',
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_issues_project_status` ON `issues` (`project_id`, `status`);
--> statement-breakpoint
CREATE INDEX `idx_issues_severity` ON `issues` (`severity`);
--> statement-breakpoint

-- Step 3: Migrate existing task/issue messages to new tables
INSERT INTO tasks (id, project_id, title, description, status, priority, metadata, created_at, updated_at)
  SELECT id, project_id, title, content, 'active',
    CASE WHEN priority IS NOT NULL THEN priority ELSE 'normal' END,
    metadata, created_at, updated_at
  FROM messages WHERE type = 'task';
--> statement-breakpoint
INSERT INTO issues (id, project_id, title, description, status, priority, severity, metadata, created_at, updated_at)
  SELECT id, project_id, title, content,
    'open',
    CASE WHEN priority IS NOT NULL THEN priority ELSE 'normal' END,
    COALESCE(json_extract(metadata, '$.severity'), 'bug'),
    metadata, created_at, updated_at
  FROM messages WHERE type = 'issue';
--> statement-breakpoint

-- Step 4: Delete migrated rows from messages, then simplify
DELETE FROM messages WHERE type IN ('task', 'issue');
--> statement-breakpoint
-- Drop priority column (SQLite 3.35+)
ALTER TABLE messages DROP COLUMN priority;
