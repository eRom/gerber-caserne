import { mcpCall } from '../mcp-client.js';
import type { Note, Chunk } from '@agent-brain/shared';

export interface ListResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface MutationResponse<T> {
  ok: true;
  id: string;
  item?: T;
}

export type NoteWithChunks = Note & { chunks?: Chunk[] };

export function getNote(params: { id: string }) {
  return mcpCall<{ item: NoteWithChunks }>('note_get', params);
}

export function createNote(params: {
  kind: string;
  title: string;
  content: string;
  tags?: string[];
  source: string;
  projectId?: string;
}) {
  return mcpCall<MutationResponse<Note>>('note_create', params);
}

export function updateNote(params: {
  id: string;
  title?: string;
  content?: string;
  tags?: string[];
  status?: string;
}) {
  return mcpCall<MutationResponse<Note>>('note_update', params);
}

export function deleteNote(params: { id: string }) {
  return mcpCall<MutationResponse<never>>('note_delete', params);
}

export function listNotes(params: {
  projectId?: string;
  kind?: string;
  status?: string;
  source?: string;
  tags_any?: string[];
  tags_all?: string[];
  sort?: string;
  limit?: number;
  offset?: number;
} = {}) {
  return mcpCall<ListResponse<Note>>('note_list', params);
}
