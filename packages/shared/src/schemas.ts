import { z } from 'zod';

// ---- Primitive aliases ----

export const UuidSchema = z.string().uuid();
export const SlugSchema = z.string().regex(/^[a-z0-9][a-z0-9-]*$/).max(64);
export const HexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const TimestampSchema = z.number().int().nonnegative();

// ---- Response envelope factories ----
// Kept available for any future tools that need them. After migrations 0007-0011,
// no current tool uses these — the surviving 2 tools (rag, rag_onboard) emit
// free-form markdown / JSON without an envelope.

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
