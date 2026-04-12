import { mcpCall } from '../mcp-client.js';
import type { Message, MessageMetadata } from '@agent-brain/shared';

export interface MessageListResponse {
  items: Message[];
  total: number;
  pendingCount: number;
}

export interface MessageMutationResponse {
  ok: true;
  id: string;
  item: Message;
}

export function listMessages(params: {
  projectSlug?: string;
  type?: string;
  status?: string;
  since?: number;
  limit?: number;
} = {}) {
  return mcpCall<MessageListResponse>('message_list', params);
}

export function createMessage(params: {
  projectSlug: string;
  type: 'context' | 'reminder';
  title: string;
  content: string;
  metadata?: Partial<MessageMetadata>;
}) {
  return mcpCall<MessageMutationResponse>('message_create', params);
}

export function updateMessage(params: {
  id: string;
  status?: 'pending' | 'done';
  content?: string;
  metadata?: Partial<MessageMetadata>;
}) {
  return mcpCall<MessageMutationResponse>('message_update', params);
}
