import { useState } from 'react';
import { useIssues, useCreateIssue } from '@/api/hooks/use-issues';
import { useProjects } from '@/api/hooks/use-projects';
import { KanbanColumn } from './kanban-column';
import { KanbanCard } from './kanban-card';
import { IssueDetailSheet } from './issue-detail-sheet';
import { GLOBAL_PROJECT_ID } from '@agent-brain/shared';

interface IssuesBoardProps {
  projectSlug: string;
}

const ISSUE_COLUMNS = [
  { status: 'inbox', title: 'Inbox', color: 'bg-amber-500' },
  { status: 'in_progress', title: 'In Progress', color: 'bg-emerald-500' },
  { status: 'in_review', title: 'In Review', color: 'bg-violet-500' },
  { status: 'closed', title: 'Closed', color: 'bg-muted-foreground/20' },
] as const;

type IssueStatus = (typeof ISSUE_COLUMNS)[number]['status'];

export function IssuesBoard({ projectSlug }: IssuesBoardProps) {
  const [addingColumn, setAddingColumn] = useState<IssueStatus | null>(null);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);

  const { data: projectsData } = useProjects();
  const project = projectsData?.items.find((p) => p.slug === projectSlug);
  const projectId = project?.id ?? (projectSlug === 'global' ? GLOBAL_PROJECT_ID : undefined);

  const issueParams: Parameters<typeof useIssues>[0] = { limit: 200 };
  if (projectId) issueParams.projectId = projectId;

  const { data, isLoading } = useIssues(issueParams);
  const createIssue = useCreateIssue();

  const issues = data?.items ?? [];

  const grouped = ISSUE_COLUMNS.reduce<Record<IssueStatus, typeof issues>>(
    (acc, col) => {
      acc[col.status] = issues.filter((i) => i.status === col.status);
      return acc;
    },
    { inbox: [], in_progress: [], in_review: [], closed: [] },
  );

  function handleAddSubmit(status: IssueStatus, title: string) {
    if (!projectId) return;
    createIssue.mutate({ projectId, title, status });
    setAddingColumn(null);
  }

  if (isLoading) {
    return (
      <div className="flex gap-3 p-4">
        {ISSUE_COLUMNS.map((col) => (
          <div key={col.status} className="flex flex-col min-w-[180px] flex-1 max-w-[280px]">
            <div className="flex items-center gap-2 px-1 pb-2">
              <div className={`size-2 rounded-full ${col.color}`} />
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {col.title}
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="h-16 rounded-lg bg-card border border-border animate-pulse" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="flex gap-3 p-4 h-full overflow-x-auto">
        {ISSUE_COLUMNS.map((col) => (
          <KanbanColumn
            key={col.status}
            title={col.title}
            color={col.color}
            count={grouped[col.status].length}
            onAdd={() => setAddingColumn(col.status)}
            addingMode={addingColumn === col.status}
            onAddSubmit={(title) => handleAddSubmit(col.status, title)}
            onAddCancel={() => setAddingColumn(null)}
          >
            {grouped[col.status].map((issue) => (
              <KanbanCard
                key={issue.id}
                title={issue.title}
                priority={issue.priority}
                {...(issue.severity ? { severity: issue.severity } : {})}
                tags={issue.tags}
                {...(issue.assignee ? { assignee: issue.assignee } : {})}
                isDone={col.status === 'closed'}
                onClick={() => setSelectedIssueId(issue.id)}
              />
            ))}
          </KanbanColumn>
        ))}
      </div>

      <IssueDetailSheet
        issueId={selectedIssueId}
        projectSlug={projectSlug}
        onClose={() => setSelectedIssueId(null)}
      />
    </>
  );
}
