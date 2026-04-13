import { mcpCall } from '../client.js';
import type { Issue } from '@agent-brain/shared';

export interface IssueListResponse {
  items: Issue[];
  total: number;
}

export interface IssueMutationResponse {
  ok: true;
  id: string;
  item: Issue;
}

export function getIssue(id: string) {
  return mcpCall<{ item: Issue }>('issue_get', { id });
}

export function listIssues(params: {
  projectId?: string;
  status?: string;
  priority?: string;
  severity?: string;
  limit?: number;
  offset?: number;
} = {}) {
  return mcpCall<IssueListResponse>('issue_list', params);
}

export function updateIssue(params: {
  id: string;
  status?: string;
  priority?: string;
}) {
  return mcpCall<IssueMutationResponse>('issue_update', params);
}

export function closeIssue(id: string) {
  return mcpCall<IssueMutationResponse>('issue_close', { id });
}
