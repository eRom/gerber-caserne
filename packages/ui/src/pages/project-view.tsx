import { useParams, useSearchParams, Link } from 'react-router';
import { useNotes } from '@/api/hooks/use-notes';
import { useProjects } from '@/api/hooks/use-projects';
import { NoteCard } from '@/components/note-card';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, FileText } from 'lucide-react';
import { GLOBAL_PROJECT_ID } from '@agent-brain/shared';

export function ProjectView() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: projectsData } = useProjects();

  const project = projectsData?.items.find((p) => p.slug === slug);
  const projectId = project?.id ?? (slug === 'global' ? GLOBAL_PROJECT_ID : undefined);

  const kindFilter = searchParams.get('kind') ?? undefined;
  const statusFilter = searchParams.get('status') ?? 'active';

  const noteParams: Parameters<typeof useNotes>[0] = { limit: 50 };
  if (projectId) noteParams.projectId = projectId;
  if (kindFilter && kindFilter !== 'all') noteParams.kind = kindFilter;
  if (statusFilter && statusFilter !== 'all') noteParams.status = statusFilter;

  const { data, isLoading } = useNotes(noteParams);

  const setFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value === 'all' || !value) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    setSearchParams(params);
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{project?.name ?? slug}</h1>
          {project?.description && (
            <p className="mt-1 text-sm text-muted-foreground">{project.description}</p>
          )}
        </div>
        <Link to={`/projects/${slug}/notes/new`}>
          <Button className="gap-1.5">
            <Plus className="h-4 w-4" />
            New Note
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="mt-4 flex items-center gap-4">
        <Tabs value={kindFilter ?? 'all'} onValueChange={(v) => setFilter('kind', v)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="atom">Atoms</TabsTrigger>
            <TabsTrigger value="document">Docs</TabsTrigger>
          </TabsList>
        </Tabs>
        <Tabs value={statusFilter} onValueChange={(v) => setFilter('status', v)}>
          <TabsList>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="draft">Draft</TabsTrigger>
            <TabsTrigger value="archived">Archived</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Note list */}
      <div className="mt-6 space-y-3">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))
        ) : data && data.items.length > 0 ? (
          data.items.map((n) => (
            <NoteCard key={n.id} note={n} projectSlug={slug!} />
          ))
        ) : (
          <EmptyState
            icon={FileText}
            title="No notes"
            description="Create a note or import from Apple Notes"
          >
            <Link to={`/projects/${slug}/notes/new`}>
              <Button variant="outline" className="gap-1.5">
                <Plus className="h-4 w-4" />
                New Note
              </Button>
            </Link>
          </EmptyState>
        )}
      </div>
    </div>
  );
}
