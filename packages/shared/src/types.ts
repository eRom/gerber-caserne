import { z } from 'zod';
import {
  ProjectSchema, StatsSchema,
  MessageSchema, MessageMetadataSchema,
} from './schemas.js';

export type Project = z.infer<typeof ProjectSchema>;
export type Stats = z.infer<typeof StatsSchema>;

export type Message = z.infer<typeof MessageSchema>;
export type MessageMetadata = z.infer<typeof MessageMetadataSchema>;
export type MessageType = Message['type'];
export type MessageStatus = Message['status'];

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
