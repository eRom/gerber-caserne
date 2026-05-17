import { z } from 'zod';
import { createSelectSchema } from 'drizzle-zod';
import { messages, handoffs } from './db/schema.js';

// ---- Primitive aliases ----

export const UuidSchema = z.string().uuid();
export const SlugSchema = z.string().regex(/^[a-z0-9][a-z0-9-]*$/).max(64);
export const HexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const TimestampSchema = z.number().int().nonnegative();

// ---- Entity schemas — derived from Drizzle, camelCase everywhere ----

// Manual schema — mirrors toProject() output shape (env_json parsed → env).
// Not generated from drizzle-zod to allow env: Record<string,string>|null instead of envJson: string|null.
export const ProjectSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  repoPath: z.string().nullable(),
  color: z.string().nullable(),
  runCmd: z.string().nullable(),
  runCwd: z.string().nullable(),
  url: z.string().nullable(),
  env: z.record(z.string()).nullable(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
  isRunning: z.boolean(),
});

export const MessageMetadataSchema = z.object({
  source: z.string().optional(),
  sourceProject: z.string().optional(),
}).passthrough();

export const MessageSchema = createSelectSchema(messages).extend({
  metadata: MessageMetadataSchema,
});

// ---- Handoffs ----
// Standalone session snapshots (not scoped to a project) used to hand off
// context between Claude environments (CLI, Desktop, claude.ai, mobile).
export const HandoffSchema = createSelectSchema(handoffs);

// ---- Response envelope factories ----

export const ListResponseSchema = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    items: z.array(item),
    total: z.number().int().nonnegative(),
    limit: z.number().int().positive(),
    offset: z.number().int().nonnegative(),
  });

export const ItemResponseSchema = <T extends z.ZodTypeAny>(item: T) =>
  z.object({ item });

export const MutationResponseSchema = <T extends z.ZodTypeAny>(item?: T) =>
  z.object({
    ok: z.literal(true),
    id: UuidSchema,
    ...(item ? { item: item.optional() } : { item: z.unknown().optional() }),
  });

// ---- Stats ----
// Note: tasks/issues live in Linear (workspace eRom, team eRom-Agents) since 2026-05-17.
// notes/chunks/embeddings were removed in migration 0006 (Gemini vault RAG).
// Stats now track the surviving state engine entities only.

export const StatsSchema = z.object({
  projects: z.number().int(),
  messages: z.object({
    total: z.number().int(),
    byStatus: z.record(z.string(), z.number().int()),
  }),
  handoffs: z.object({
    total: z.number().int(),
    byStatus: z.record(z.string(), z.number().int()),
  }),
  dbSizeBytes: z.number().int(),
});
