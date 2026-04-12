import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listIssues, getIssue, createIssue, updateIssue, closeIssue } from '../tools/issues.js';

export function useIssues(params: {
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
  return useQuery({
    queryKey: ['issues', params],
    queryFn: () => listIssues(params),
    refetchOnWindowFocus: true,
  });
}

export function useIssue(id: string | null) {
  return useQuery({
    queryKey: ['issues', 'detail', id],
    queryFn: () => getIssue({ id: id! }),
    enabled: !!id,
  });
}

export function useCreateIssue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createIssue,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['issues'] }),
  });
}

export function useUpdateIssue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateIssue,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['issues'] }),
  });
}

export function useCloseIssue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: closeIssue,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['issues'] }),
  });
}
