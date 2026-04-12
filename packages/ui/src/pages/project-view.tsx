import { useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router';
import { useNotes } from '@/api/hooks/use-notes';
import { useProjects } from '@/api/hooks/use-projects';
import { useTasks } from '@/api/hooks/use-tasks';
import { useIssues } from '@/api/hooks/use-issues';
import { NoteCard } from '@/components/note-card';
import { EmptyState } from '@/components/empty-state';
import { ImportZone } from '@/components/import-zone';
import { TasksBoard } from '@/components/tasks-board';
import { IssuesBoard } from '@/components/issues-board';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Plus, FileText, Upload } from 'lucide-react';
import { GLOBAL_PROJECT_ID } from '@agent-brain/shared';

const TAB_TRIGGER_CLASS =
  'rounded-none border-b-2 border-transparent px-4 pb-2.5 pt-1 text-[13px] font-medium text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none bg-transparent';

export function ProjectView() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showImport, setShowImport] = useState(false);
  const { data: projectsData } = useProjects();

  const project = projectsData?.items.find((p) => p.slug === slug);
  const projectId = project?.id ?? (slug === 'global' ? GLOBAL_PROJECT_ID : undefined);

  // Count badges — lightweight queries
  const tasksCountParams: Parameters<typeof useTasks>[0] = { limit: 1 };
  if (projectId) tasksCountParams.projectId = projectId;
  const { data: tasksData } = useTasks(tasksCountParams);
  const taskCount = tasksData?.total ?? 0;

  const issuesCountParams: Parameters<typeof useIssues>[0] = { limit: 1 };
  if (projectId) issuesCountParams.projectId = projectId;
  const { data: issuesData } = useIssues(issuesCountParams);
  const issueCount = issuesData?.total ?? 0;

  // Notes filters
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
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-5 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{project?.name ?? slug}</h1>
            {project?.description && (
              <p className="mt-1 text-sm text-muted-foreground">{project.description}</p>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="tasks" className="flex flex-col flex-1 min-h-0 mt-3">
        <div className="px-6 border-b border-border shrink-0">
          <TabsList className="bg-transparent h-auto p-0 gap-0">
            <TabsTrigger value="tasks" className={TAB_TRIGGER_CLASS}>
              Tâches
              {taskCount > 0 && (
                <span className="ml-1.5 text-[10px] font-semibold bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">
                  {taskCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="issues" className={TAB_TRIGGER_CLASS}>
              Issues
              {issueCount > 0 && (
                <span className="ml-1.5 text-[10px] font-semibold bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
                  {issueCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="memory" className={TAB_TRIGGER_CLASS}>
              Mémoire
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent
          value="tasks"
          className="flex-1 overflow-hidden mt-0 data-[state=inactive]:hidden"
        >
          {projectId && slug ? (
            <TasksBoard projectId={projectId} />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Projet introuvable
            </div>
          )}
        </TabsContent>

        <TabsContent
          value="issues"
          className="flex-1 overflow-hidden mt-0 data-[state=inactive]:hidden"
        >
          {slug ? (
            <IssuesBoard projectSlug={slug} />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Projet introuvable
            </div>
          )}
        </TabsContent>

        <TabsContent
          value="memory"
          className="flex-1 overflow-y-auto mt-0 data-[state=inactive]:hidden"
        >
          <div className="p-6">
            {/* Mémoire header actions */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
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
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => setShowImport(!showImport)}
                >
                  <Upload className="h-4 w-4" />
                  {showImport ? 'Notes' : 'Import'}
                </Button>
                <Link to={`/projects/${slug}/notes/new`}>
                  <Button className="gap-1.5">
                    <Plus className="h-4 w-4" />
                    New Note
                  </Button>
                </Link>
              </div>
            </div>

            {showImport ? (
              <ImportZone projectId={projectId!} />
            ) : (
              <div className="space-y-3">
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
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
