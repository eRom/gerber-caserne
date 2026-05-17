import { z } from 'zod';
import {
  ProjectSchema,
  ListResponseSchema,
  MutationResponseSchema,
  MessageSchema,
  HandoffSchema,
} from '@gerber-caserne/shared';

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
  handoff_create: MutationResponseSchema(HandoffSchema),
  handoff_list: z.object({
    items: z.array(HandoffSchema),
    total: z.number().int().nonnegative(),
  }),
  handoff_get: z.object({ item: HandoffSchema }),
  handoff_close: MutationResponseSchema(HandoffSchema),
} as const;
