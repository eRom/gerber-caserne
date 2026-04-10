import { useQuery } from '@tanstack/react-query';
import { getStats } from '../tools/maintenance.js';

export function useStats(projectId?: string) {
  return useQuery({
    queryKey: ['stats', projectId],
    queryFn: () => getStats(projectId !== undefined ? { projectId } : {}),
    refetchOnWindowFocus: true,
    staleTime: 60_000,
  });
}
