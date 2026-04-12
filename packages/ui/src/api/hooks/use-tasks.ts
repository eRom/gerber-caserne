import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listTasks, getTask, createTask, updateTask, deleteTask } from '../tools/tasks.js';

export function useTasks(params: {
  projectId?: string;
  status?: string;
  priority?: string;
  assignee?: string;
  tags?: string[];
  parentId?: string | null;
  limit?: number;
  offset?: number;
} = {}) {
  return useQuery({
    queryKey: ['tasks', params],
    queryFn: () => listTasks(params),
    refetchOnWindowFocus: true,
  });
}

export function useTask(id: string | null) {
  return useQuery({
    queryKey: ['tasks', 'detail', id],
    queryFn: () => getTask({ id: id! }),
    enabled: !!id,
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createTask,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateTask,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteTask,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
}
