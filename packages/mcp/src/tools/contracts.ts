import { z } from 'zod';
import {
  ProjectSchema,
  ListResponseSchema,
  MutationResponseSchema,
  MessageSchema,
  TaskSchema,
  IssueSchema,
} from '@agent-brain/shared';

// ---------------------------------------------------------------------------
// RESPONSE_SHAPES
//
// Maps each tool name to its expected Zod response shape.
// Contract tests call `.parse()` on actual tool return values to detect drift
// between handler return shapes and the shared Zod envelope schemas.
//
// Handlers MUST map raw SQLite rows to camelCase before returning (gotcha 3).
// This ensures ProjectSchema (via createSelectSchema, camelCase) validates.
// ---------------------------------------------------------------------------

export { ProjectSchema };

export const RESPONSE_SHAPES = {
  project_create: MutationResponseSchema(ProjectSchema),
  project_list: ListResponseSchema(ProjectSchema),
  project_update: MutationResponseSchema(ProjectSchema),
  project_delete: MutationResponseSchema(),
  message_create: MutationResponseSchema(MessageSchema),
  message_list: z.object({
    items: z.array(MessageSchema),
    total: z.number().int().nonnegative(),
    pendingCount: z.number().int().nonnegative(),
  }),
  message_update: MutationResponseSchema(MessageSchema),
  task_create: MutationResponseSchema(TaskSchema),
  task_list: z.object({
    items: z.array(TaskSchema),
    total: z.number().int().nonnegative(),
  }),
  task_get: z.object({
    item: TaskSchema,
    subtasks: z.array(TaskSchema),
  }),
  task_update: MutationResponseSchema(TaskSchema),
  task_delete: z.object({
    ok: z.literal(true),
    id: z.string().uuid(),
    deletedCount: z.number().int(),
  }),
  task_reorder: z.object({ ok: z.literal(true) }),
  issue_create: MutationResponseSchema(IssueSchema),
  issue_list: z.object({
    items: z.array(IssueSchema),
    total: z.number().int().nonnegative(),
  }),
  issue_get: z.object({ item: IssueSchema }),
  issue_update: MutationResponseSchema(IssueSchema),
  issue_close: MutationResponseSchema(IssueSchema),
} as const;
