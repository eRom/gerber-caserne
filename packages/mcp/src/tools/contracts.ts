import {
  ProjectSchema,
  ListResponseSchema,
  MutationResponseSchema,
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
} as const;
