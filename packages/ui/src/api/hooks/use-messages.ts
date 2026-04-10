import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listMessages, createMessage, updateMessage } from '../tools/messages.js';

export function useMessages(params: {
  projectSlug?: string;
  type?: string;
  status?: string;
  since?: number;
  limit?: number;
} = {}) {
  return useQuery({
    queryKey: ['messages', params],
    queryFn: () => listMessages(params),
    refetchOnWindowFocus: true,
  });
}

export function usePendingCount(projectSlug?: string) {
  return useQuery({
    queryKey: ['messages', 'pending-count', projectSlug],
    queryFn: () => listMessages({
      ...(projectSlug !== undefined && { projectSlug }),
      status: 'pending',
      limit: 1,
    }),
    select: (data) => data.pendingCount,
    refetchInterval: 30_000,
  });
}

export function useCreateMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createMessage,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['messages'] }),
  });
}

export function useUpdateMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateMessage,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['messages'] }),
  });
}
