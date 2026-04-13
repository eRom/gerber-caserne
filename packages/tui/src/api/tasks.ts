import { mcpCall } from '../client.js';
import type { Task } from '@agent-brain/shared';

export interface TaskListResponse {
  items: Task[];
  total: number;
}

export interface TaskMutationResponse {
  ok: true;
  id: string;
  item: Task;
}

export function listTasks(params: {
  projectId?: string;
  status?: string;
  priority?: string;
  tags?: string[];
  parentId?: string | null;
  limit?: number;
  offset?: number;
} = {}) {
  return mcpCall<TaskListResponse>('task_list', params);
}

export function updateTask(params: {
  id: string;
  status?: string;
  priority?: string;
  title?: string;
}) {
  return mcpCall<TaskMutationResponse>('task_update', params);
}
