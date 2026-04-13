import { mcpCall } from '../client.js';
import type { Note } from '@agent-brain/shared';

export interface NoteListResponse {
  items: Note[];
  total: number;
  limit: number;
  offset: number;
}

export function listNotes(params: {
  projectId?: string;
  kind?: string;
  status?: string;
  source?: string;
  tags_any?: string[];
  sort?: string;
  limit?: number;
  offset?: number;
} = {}) {
  return mcpCall<NoteListResponse>('note_list', params);
}

export function getNote(id: string) {
  return mcpCall<{ item: Note }>('note_get', { id });
}
