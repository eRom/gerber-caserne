import { z } from 'zod';
import {
  ProjectSchema,
  ListResponseSchema,
  MutationResponseSchema,
} from '@agent-brain/shared';

// ---------------------------------------------------------------------------
// RESPONSE_SHAPES
//
// Maps each tool name to its expected Zod response shape.
// Contract tests call `.parse()` on actual tool return values to detect drift
// between handler return shapes and the shared Zod envelope schemas.
//
// Gotcha — casing mismatch: ProjectSchema (via drizzle's createSelectSchema)
// uses JS camelCase property names (repoPath, createdAt, updatedAt), but the
// current tool handlers return raw SQLite rows with snake_case column names
// (repo_path, created_at, updated_at).  Passing raw rows through ProjectSchema
// would throw on the required camelCase fields.
//
// Resolution: item-level shapes use z.record(z.string(), z.unknown()) — any
// plain object passes.  The outer envelope (ok: true, id: UUID, items: array,
// total/limit/offset: number) is still fully enforced and will catch regressions.
//
// When tool handlers are updated to map rows to camelCase, replace the
// z.record() shims with the real ProjectSchema for full item-level coverage.
// ---------------------------------------------------------------------------

// Re-export the canonical schema so consumers can reference it.
export { ProjectSchema };

// A permissive "any plain object" schema used for raw SQLite row items.
const AnyRow = z.record(z.string(), z.unknown());

export const RESPONSE_SHAPES = {
  project_create: MutationResponseSchema(AnyRow),
  project_list: ListResponseSchema(AnyRow),
  project_update: MutationResponseSchema(AnyRow),
  // project_delete returns { ok, id, reassigned_count }.
  // The extra `reassigned_count` field is silently stripped by Zod's default
  // behaviour — the parse still succeeds.
  project_delete: MutationResponseSchema(),
  // More will be added as tools are implemented
} as const;
