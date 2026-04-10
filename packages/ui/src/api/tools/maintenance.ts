import { mcpCall } from '../mcp-client.js';
import type { Stats } from '@agent-brain/shared';

export function getStats(params: { projectId?: string } = {}) {
  return mcpCall<Stats>('get_stats', params);
}

export function backupBrain(params: { label?: string } = {}) {
  return mcpCall<{ ok: true; id: string; path: string; sizeBytes: number }>('backup_brain', params);
}
