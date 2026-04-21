import { mcpCall } from '../client.js';
import type { Handoff } from '@agent-brain/shared';

export interface HandoffListResponse {
  items: Handoff[];
  total: number;
}

export function listHandoffs(
  params: { status?: 'inbox' | 'done'; limit?: number; offset?: number } = {},
) {
  return mcpCall<HandoffListResponse>('handoff_list', params);
}
