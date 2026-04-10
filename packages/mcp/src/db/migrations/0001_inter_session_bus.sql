CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL REFERENCES `projects`(`id`),
	`type` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`priority` text DEFAULT 'normal' NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`metadata` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_messages_project_status` ON `messages` (`project_id`,`status`);
--> statement-breakpoint
CREATE INDEX `idx_messages_type_status` ON `messages` (`type`,`status`);
--> statement-breakpoint
CREATE INDEX `idx_messages_created_at` ON `messages` (`created_at`);
