import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listProjects, createProject, updateProject, deleteProject } from '../tools/projects.js';

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: () => listProjects({ limit: 200 }),
    refetchOnWindowFocus: true,
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createProject,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateProject,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteProject,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  });
}
