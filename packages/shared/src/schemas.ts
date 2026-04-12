import { z } from 'zod';
import { createSelectSchema } from 'drizzle-zod';
import { projects, notes, chunks, messages } from './db/schema.js';
import { KINDS, STATUSES, SOURCES, SEARCH_MODES, MESSAGE_TYPES, MESSAGE_STATUSES } from './constants.js';

// ---- Primitive aliases ----

export const UuidSchema = z.string().uuid();
export const SlugSchema = z.string().regex(/^[a-z0-9][a-z0-9-]*$/).max(64);
export const HexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const TimestampSchema = z.number().int().nonnegative();

// ---- Entity schemas — derived from Drizzle, camelCase everywhere ----

export const ProjectSchema = createSelectSchema(projects);

// Override `tags`: stored as JSON string in DB, exposed as string[] in the typed API.
// The MCP handlers are responsible for JSON.parse on read and JSON.stringify on write.
export const NoteSchema = createSelectSchema(notes).extend({
  tags: z.array(z.string().min(1).max(40)).max(20),
});

export const ChunkSchema = createSelectSchema(chunks);

export const MessageMetadataSchema = z.object({
  severity: z.enum(['bug', 'regression', 'warning']).optional(),
  assignee: z.string().optional(),
  source: z.string().optional(),
  sourceProject: z.string().optional(),
  relatedNoteIds: z.array(z.string().uuid()).optional(),
}).passthrough();

export const MessageSchema = createSelectSchema(messages).extend({
  metadata: MessageMetadataSchema,
});

// Note on naming: these are "wire" response shapes (not DB rows), so we pick
// camelCase everywhere to stay consistent with the Drizzle-derived entity schemas.
export const SearchHitSchema = z.object({
  ownerType: z.enum(['note', 'chunk']),
  ownerId: UuidSchema,
  score: z.number(),
  scoreFts: z.number().optional(),
  scoreSem: z.number().optional(),
  snippet: z.string(),
  parent: z.object({
    noteId: UuidSchema,
    title: z.string(),
    kind: z.enum(KINDS),
    projectId: UuidSchema,
    tags: z.array(z.string()),
    status: z.enum(STATUSES),
  }),
  chunk: z
    .object({
      headingPath: z.string(),
      position: z.number().int(),
      neighbors: z.array(
        z.object({
          position: z.number().int(),
          content: z.string(),
        }),
      ),
    })
    .optional(),
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

export const SearchResponseSchema = z.object({
  hits: z.array(SearchHitSchema),
  total: z.number().int().nonnegative(),
  mode: z.enum(SEARCH_MODES),
});

// ---- Stats ----

export const StatsSchema = z.object({
  projects: z.number().int(),
  notes: z.object({
    total: z.number().int(),
    byKind: z.record(z.string(), z.number().int()),
    byStatus: z.record(z.string(), z.number().int()),
    bySource: z.record(z.string(), z.number().int()),
  }),
  chunks: z.object({
    total: z.number().int(),
    avgPerDoc: z.number(),
  }),
  embeddings: z.object({
    total: z.number().int(),
    byOwnerType: z.record(z.string(), z.number().int()),
    model: z.string(),
  }),
  dbSizeBytes: z.number().int(),
  topTags: z.array(z.object({ tag: z.string(), count: z.number().int() })),
});
