import { z } from 'zod';
import {
  ProjectSchema, NoteSchema, ChunkSchema, SearchHitSchema, StatsSchema,
  MessageSchema, MessageMetadataSchema,
  TaskSchema, TaskMetadataSchema,
  IssueSchema, IssueMetadataSchema,
  HandoffSchema,
} from './schemas.js';

export type Project = z.infer<typeof ProjectSchema>;
export type Note = z.infer<typeof NoteSchema>;
export type Chunk = z.infer<typeof ChunkSchema>;
export type SearchHit = z.infer<typeof SearchHitSchema>;
export type Stats = z.infer<typeof StatsSchema>;

export type Kind = Note['kind'];
export type Status = Note['status'];
export type Source = Note['source'];

export type Message = z.infer<typeof MessageSchema>;
export type MessageMetadata = z.infer<typeof MessageMetadataSchema>;
export type MessageType = Message['type'];
export type MessageStatus = Message['status'];

export type Task = z.infer<typeof TaskSchema>;
export type TaskMetadata = z.infer<typeof TaskMetadataSchema>;
export type TaskStatus = Task['status'];
export type TaskPriority = Task['priority'];

export type Issue = z.infer<typeof IssueSchema>;
export type IssueMetadata = z.infer<typeof IssueMetadataSchema>;
export type IssueStatus = Issue['status'];
export type IssuePriority = Issue['priority'];
export type IssueSeverity = Issue['severity'];

export type Handoff = z.infer<typeof HandoffSchema>;
export type HandoffStatus = Handoff['status'];

export interface Runbook {
  runCmd: string | null;
  runCwd: string | null;
  url: string | null;
  env: Record<string, string> | null;
}

export interface RunningProcessInfo {
  pid: number;
  startedAt: number;
  logPath: string;
  runCmd: string;
}
