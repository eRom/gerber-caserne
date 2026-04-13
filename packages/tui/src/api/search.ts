import { mcpCall } from '../client.js';
import type { SearchHit } from '@agent-brain/shared';

export interface SearchResponse {
  hits: SearchHit[];
  total: number;
  mode: string;
}

export function search(params: {
  query: string;
  mode?: string;
  limit?: number;
  projectId?: string;
  kind?: string;
  tags_any?: string[];
}) {
  return mcpCall<SearchResponse>('search', params);
}
