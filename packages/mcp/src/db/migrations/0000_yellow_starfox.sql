CREATE TABLE `app_meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `chunks` (
	`id` text PRIMARY KEY NOT NULL,
	`note_id` text NOT NULL,
	`position` integer NOT NULL,
	`heading_path` text,
	`content` text NOT NULL,
	`content_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `chunks_note_idx` ON `chunks` (`note_id`);--> statement-breakpoint
CREATE TABLE `embeddings` (
	`owner_type` text NOT NULL,
	`owner_id` text NOT NULL,
	`model` text NOT NULL,
	`dim` integer NOT NULL,
	`content_hash` text NOT NULL,
	`vector` blob NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`owner_type`, `owner_id`, `model`)
);
--> statement-breakpoint
CREATE INDEX `embeddings_model_idx` ON `embeddings` (`model`);--> statement-breakpoint
CREATE TABLE `notes` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text DEFAULT '00000000-0000-0000-0000-000000000000' NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`source` text NOT NULL,
	`content_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `notes_project_idx` ON `notes` (`project_id`);--> statement-breakpoint
CREATE INDEX `notes_kind_status_idx` ON `notes` (`kind`,`status`);--> statement-breakpoint
CREATE INDEX `notes_updated_idx` ON `notes` (`updated_at`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`repo_path` text,
	`color` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `projects_slug_unique` ON `projects` (`slug`);