import { mcpCall } from '../mcp-client.js';

export interface Issue {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  severity?: string;
  assignee?: string;
  tags: string[];
  relatedTaskId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface IssueListResponse {
  items: Issue[];
  total: number;
}

export interface IssueMutationResponse {
  ok: true;
  id: string;
  item: Issue;
}

export function listIssues(params: {
  projectId?: string;
  status?: string;
  priority?: string;
  severity?: string;
  assignee?: string;
  tags?: string[];
  relatedTaskId?: string;
  limit?: number;
  offset?: number;
} = {}) {
  return mcpCall<IssueListResponse>('issue_list', params);
}

export function getIssue({ id }: { id: string }) {
  return mcpCall<{ item: Issue }>('issue_get', { id });
}

export function createIssue(params: {
  projectId: string;
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  severity?: string;
  assignee?: string;
  tags?: string[];
  relatedTaskId?: string;
  metadata?: Record<string, unknown>;
}) {
  return mcpCall<IssueMutationResponse>('issue_create', params);
}

export function updateIssue(params: {
  id: string;
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  severity?: string;
  assignee?: string;
  tags?: string[];
  relatedTaskId?: string;
  metadata?: Record<string, unknown>;
}) {
  return mcpCall<IssueMutationResponse>('issue_update', params);
}

export function closeIssue({ id }: { id: string }) {
  return mcpCall<IssueMutationResponse>('issue_close', { id });
}
