CREATE TABLE `handoffs` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL DEFAULT '',
	`status` text NOT NULL DEFAULT 'inbox',
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_handoffs_status` ON `handoffs` (`status`);
--> statement-breakpoint
CREATE INDEX `idx_handoffs_created_at` ON `handoffs` (`created_at`);
