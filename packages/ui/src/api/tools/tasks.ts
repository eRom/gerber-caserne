import { mcpCall } from '../mcp-client.js';

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  position: number;
  assignee?: string;
  tags: string[];
  dueDate?: string;
  waitingOn?: string;
  completedAt?: string;
  parentId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface TaskListResponse {
  items: Task[];
  total: number;
}

export interface TaskGetResponse {
  item: Task;
  subtasks: Task[];
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
  assignee?: string;
  tags?: string[];
  parentId?: string | null;
  limit?: number;
  offset?: number;
} = {}) {
  return mcpCall<TaskListResponse>('task_list', params);
}

export function getTask({ id }: { id: string }) {
  return mcpCall<TaskGetResponse>('task_get', { id });
}

export function createTask(params: {
  projectId: string;
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  assignee?: string;
  tags?: string[];
  dueDate?: string;
  waitingOn?: string;
  parentId?: string;
  metadata?: Record<string, unknown>;
}) {
  return mcpCall<TaskMutationResponse>('task_create', params);
}

export function updateTask(params: {
  id: string;
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  assignee?: string;
  tags?: string[];
  dueDate?: string;
  waitingOn?: string;
  completedAt?: string;
  parentId?: string;
  metadata?: Record<string, unknown>;
}) {
  return mcpCall<TaskMutationResponse>('task_update', params);
}

export function deleteTask({ id }: { id: string }) {
  return mcpCall<{ ok: true; id: string; deletedCount: number }>('task_delete', { id });
}

export function reorderTasks({ ids }: { ids: string[] }) {
  return mcpCall<{ ok: true }>('task_reorder', { ids });
}
