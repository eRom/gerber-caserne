import { useSearchParams } from 'react-router';
import { useSearch } from '@/api/hooks/use-search';
import { useProjects } from '@/api/hooks/use-projects';
import { SearchHitCard } from '@/components/search-hit';
import { EmptyState } from '@/components/empty-state';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { useState, useEffect } from 'react';

export function SearchResults() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryParam = searchParams.get('q') ?? '';
  const modeParam = searchParams.get('mode') ?? 'hybrid';
  const [localQuery, setLocalQuery] = useState(queryParam);

  const { data, isLoading } = useSearch(queryParam, { mode: modeParam, limit: 30 });
  const { data: projectsData } = useProjects();

  useEffect(() => {
    setLocalQuery(queryParam);
  }, [queryParam]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams);
    params.set('q', localQuery);
    setSearchParams(params);
  };

  const setMode = (mode: string) => {
    const params = new URLSearchParams(searchParams);
    params.set('mode', mode);
    setSearchParams(params);
  };

  const resolveSlug = (projectId: string) => {
    const p = projectsData?.items.find((p) => p.id === projectId);
    return p?.slug ?? 'global';
  };

  return (
    <div className="mx-auto max-w-3xl p-6">
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            value={localQuery}
            onChange={(e) => setLocalQuery(e.target.value)}
            placeholder="Search..."
            className="pl-9"
          />
        </div>
      </form>

      <div className="mt-4">
        <Tabs value={modeParam} onValueChange={setMode}>
          <TabsList>
            <TabsTrigger value="hybrid">Hybrid</TabsTrigger>
            <TabsTrigger value="semantic">Semantic</TabsTrigger>
            <TabsTrigger value="fulltext">Fulltext</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="mt-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Searching...</p>
        ) : data && data.hits.length > 0 ? (
          <div className="space-y-1">
            <p className="mb-3 text-sm text-muted-foreground">
              {data.total} result{data.total !== 1 ? 's' : ''} ({data.mode})
            </p>
            {data.hits.map((hit) => (
              <SearchHitCard
                key={hit.ownerId}
                hit={hit}
                projectSlug={resolveSlug(hit.parent.projectId)}
              />
            ))}
          </div>
        ) : queryParam ? (
          <EmptyState icon={Search} title="No results" description={`Nothing found for "${queryParam}"`} />
        ) : null}
      </div>
    </div>
  );
}
