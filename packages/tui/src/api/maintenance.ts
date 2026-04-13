import { mcpCall } from '../client.js';
import type { Stats } from '@agent-brain/shared';

export function getStats(params: { projectId?: string } = {}) {
  return mcpCall<Stats>('get_stats', params);
}
