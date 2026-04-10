import { mcpCall } from '../mcp-client.js';
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
  status?: string;
  tags_any?: string[];
  tags_all?: string[];
  neighbors?: number;
}) {
  return mcpCall<SearchResponse>('search', params);
}
