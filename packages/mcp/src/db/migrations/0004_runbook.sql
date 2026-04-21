ALTER TABLE projects ADD COLUMN run_cmd  TEXT;
--> statement-breakpoint
ALTER TABLE projects ADD COLUMN run_cwd  TEXT;
--> statement-breakpoint
ALTER TABLE projects ADD COLUMN url      TEXT;
--> statement-breakpoint
ALTER TABLE projects ADD COLUMN env_json TEXT;
--> statement-breakpoint
CREATE TABLE running_processes (
  project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  pid        INTEGER NOT NULL,
  started_at INTEGER NOT NULL,
  log_path   TEXT    NOT NULL,
  run_cmd    TEXT    NOT NULL
);
