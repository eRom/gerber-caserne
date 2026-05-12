import { mcpCall } from '../client.js';
import type { Stats } from '@gerber-caserne/shared';

export function getStats(params: { projectId?: string } = {}) {
  return mcpCall<Stats>('get_stats', params);
}
