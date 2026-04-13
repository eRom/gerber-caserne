import { mcpCall } from '../client.js';
import type { Project } from '@agent-brain/shared';

export interface ListResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export function listProjects(params: { limit?: number; offset?: number } = {}) {
  return mcpCall<ListResponse<Project>>('project_list', params);
}
