import { mcpCall } from '../client.js';
import type { Project } from '@gerber-caserne/shared';

export interface ListResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export function listProjects(params: { limit?: number; offset?: number } = {}) {
  return mcpCall<ListResponse<Project>>('project_list', params);
}
