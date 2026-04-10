import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { search } from '../tools/search.js';

export function useSearch(
  query: string,
  options: { mode?: string; limit?: number; projectId?: string; enabled?: boolean } = {},
) {
  const { mode = 'hybrid', limit = 20, projectId, enabled = true } = options;
  return useQuery({
    queryKey: ['search', query, mode, limit, projectId],
    queryFn: () => search({ query, mode, limit, ...(projectId !== undefined && { projectId }) }),
    enabled: enabled && query.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}
