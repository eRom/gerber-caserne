import { z } from 'zod';

// ---- Primitive aliases ----

export const UuidSchema = z.string().uuid();
export const SlugSchema = z.string().regex(/^[a-z0-9][a-z0-9-]*$/).max(64);
export const HexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const TimestampSchema = z.number().int().nonnegative();

// ---- Entity schemas — derived from Drizzle, camelCase everywhere ----

export const ProjectSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  repoPath: z.string().nullable(),
  color: z.string().nullable(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});

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
// Migration history:
// - 0006 : notes/chunks/embeddings removed (Gemini vault RAG)
// - 0007 : tasks/issues migrated to Linear (workspace eRom)
// - 0008 : handoffs migrated to Linear (projet Handoffs)
// - 0009 : runbook feature dropped (unused)
// - 0010 : messages migrated to Airtable (gerber-bus / bus / Messages)
// Only projects + dbSizeBytes remain trackable on this server.

export const StatsSchema = z.object({
  projects: z.number().int(),
  dbSizeBytes: z.number().int(),
});
