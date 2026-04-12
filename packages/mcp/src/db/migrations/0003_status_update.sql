-- Tasks: map old statuses to new workflow statuses
UPDATE tasks SET status = 'inbox' WHERE status = 'active';
--> statement-breakpoint
UPDATE tasks SET status = 'inbox' WHERE status = 'waiting';
--> statement-breakpoint
UPDATE tasks SET status = 'inbox' WHERE status = 'someday';
--> statement-breakpoint
-- Issues: map old statuses to new workflow statuses
UPDATE issues SET status = 'inbox' WHERE status = 'open';
--> statement-breakpoint
UPDATE issues SET status = 'in_review' WHERE status = 'resolved';
