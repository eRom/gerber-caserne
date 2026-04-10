import { mcpCall } from '../mcp-client.js';
import type { Project } from '@agent-brain/shared';

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

export function listProjects(params: { limit?: number; offset?: number } = {}) {
  return mcpCall<ListResponse<Project>>('project_list', params);
}

export function createProject(params: { slug: string; name: string; description?: string; color?: string }) {
  return mcpCall<MutationResponse<Project>>('project_create', params);
}

export function updateProject(params: { id: string; slug?: string; name?: string; description?: string; color?: string }) {
  return mcpCall<MutationResponse<Project>>('project_update', params);
}

export function deleteProject(params: { id: string }) {
  return mcpCall<MutationResponse<never> & { reassigned_count: number }>('project_delete', params);
}
