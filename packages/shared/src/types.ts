import { z } from 'zod';
import { ProjectSchema, NoteSchema, ChunkSchema, SearchHitSchema, StatsSchema, MessageSchema, MessageMetadataSchema } from './schemas.js';

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
