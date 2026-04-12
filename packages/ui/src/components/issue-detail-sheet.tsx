import { useEffect, useRef, useState } from 'react';
import { useIssue, useUpdateIssue, useCloseIssue } from '@/api/hooks/use-issues';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface IssueDetailSheetProps {
  issueId: string | null;
  projectSlug: string;
  onClose: () => void;
}

const STATUS_PILLS = [
  { value: 'inbox', label: 'Inbox', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  { value: 'in_review', label: 'In Review', color: 'bg-violet-500/10 text-violet-400 border-violet-500/20' },
  { value: 'closed', label: 'Closed', color: 'bg-muted/50 text-muted-foreground border-border' },
] as const;

type IssueStatus = (typeof STATUS_PILLS)[number]['value'];

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export function IssueDetailSheet({ issueId, projectSlug: _projectSlug, onClose }: IssueDetailSheetProps) {
  const { data, isLoading } = useIssue(issueId);
  const updateIssue = useUpdateIssue();
  const closeIssue = useCloseIssue();

  const issue = data?.item;

  // Local editable state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignee, setAssignee] = useState('');
  const [tagsRaw, setTagsRaw] = useState('');
  const [severity, setSeverity] = useState('');
  const [priority, setPriority] = useState('');

  // Track if we've seeded from server data
  const seededRef = useRef<string | null>(null);

  useEffect(() => {
    if (issue && seededRef.current !== issue.id) {
      seededRef.current = issue.id;
      setTitle(issue.title);
      setDescription(issue.description ?? '');
      setAssignee(issue.assignee ?? '');
      setTagsRaw(issue.tags.join(', '));
      setSeverity(issue.severity ?? '');
      setPriority(issue.priority ?? 'normal');
    }
  }, [issue]);

  // Debounced values for auto-save
  const debouncedTitle = useDebounced(title, 600);
  const debouncedDescription = useDebounced(description, 600);
  const debouncedAssignee = useDebounced(assignee, 600);
  const debouncedTagsRaw = useDebounced(tagsRaw, 600);

  // Auto-save title
  useEffect(() => {
    if (!issue || debouncedTitle === issue.title) return;
    if (debouncedTitle.trim() === '') return;
    updateIssue.mutate({ id: issue.id, title: debouncedTitle.trim() });
  }, [debouncedTitle]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save description
  useEffect(() => {
    if (!issue || debouncedDescription === (issue.description ?? '')) return;
    updateIssue.mutate({ id: issue.id, description: debouncedDescription });
  }, [debouncedDescription]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save assignee
  useEffect(() => {
    if (!issue || debouncedAssignee === (issue.assignee ?? '')) return;
    if (debouncedAssignee) {
      updateIssue.mutate({ id: issue.id, assignee: debouncedAssignee });
    } else {
      updateIssue.mutate({ id: issue.id });
    }
  }, [debouncedAssignee]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save tags
  useEffect(() => {
    if (!issue) return;
    const newTags = debouncedTagsRaw
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const currentTags = issue.tags;
    if (JSON.stringify(newTags) === JSON.stringify(currentTags)) return;
    updateIssue.mutate({ id: issue.id, tags: newTags });
  }, [debouncedTagsRaw]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleStatusChange(newStatus: IssueStatus) {
    if (!issue || issue.status === newStatus) return;
    updateIssue.mutate({ id: issue.id, status: newStatus });
  }

  function handleSeverityChange(val: string) {
    if (!issue) return;
    setSeverity(val);
    updateIssue.mutate({ id: issue.id, severity: val });
  }

  function handlePriorityChange(val: string) {
    if (!issue) return;
    setPriority(val);
    updateIssue.mutate({ id: issue.id, priority: val });
  }

  function handleCloseIssue() {
    if (!issue) return;
    closeIssue.mutate({ id: issue.id });
  }

  const isClosed = issue?.status === 'closed';

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  return (
    <Sheet open={!!issueId} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-[480px] sm:max-w-[480px] flex flex-col overflow-y-auto gap-0 p-0">
        {isLoading || !issue ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="h-8 w-8 rounded-full border-2 border-border border-t-foreground animate-spin" />
          </div>
        ) : (
          <>
            {/* Header */}
            <SheetHeader className="px-5 pt-5 pb-3 border-b border-border">
              <SheetTitle asChild>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-transparent text-base font-medium text-foreground outline-none placeholder:text-muted-foreground/40 focus:outline-none"
                  placeholder="Issue title..."
                />
              </SheetTitle>
            </SheetHeader>

            {/* Status pills */}
            <div className="px-5 py-3 flex gap-1.5 flex-wrap border-b border-border">
              {STATUS_PILLS.map((pill) => (
                <button
                  key={pill.value}
                  onClick={() => handleStatusChange(pill.value)}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all',
                    issue.status === pill.value
                      ? pill.color
                      : 'bg-transparent text-muted-foreground/40 border-border/40 hover:text-muted-foreground hover:border-border',
                  )}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            {/* Fields */}
            <div className="flex-1 px-5 py-4 flex flex-col gap-4">
              {/* Severity */}
              <div className="flex items-center gap-3">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground w-24 shrink-0">
                  Severity
                </label>
                <Select value={severity} onValueChange={handleSeverityChange}>
                  <SelectTrigger size="sm" className="w-40">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bug">Bug</SelectItem>
                    <SelectItem value="regression">Regression</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="enhancement">Enhancement</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Priority */}
              <div className="flex items-center gap-3">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground w-24 shrink-0">
                  Priority
                </label>
                <Select value={priority} onValueChange={handlePriorityChange}>
                  <SelectTrigger size="sm" className="w-40">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Assignee */}
              <div className="flex items-center gap-3">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground w-24 shrink-0">
                  Assignee
                </label>
                <input
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                  placeholder="—"
                  className="flex-1 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-ring focus:outline-none h-7"
                />
              </div>

              {/* Tags */}
              <div className="flex items-center gap-3">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground w-24 shrink-0">
                  Tags
                </label>
                <input
                  value={tagsRaw}
                  onChange={(e) => setTagsRaw(e.target.value)}
                  placeholder="tag1, tag2, ..."
                  className="flex-1 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-ring focus:outline-none h-7"
                />
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add a description..."
                  rows={5}
                  className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-ring focus:outline-none resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <SheetFooter className="px-5 py-4 border-t border-border gap-2">
              {/* Timestamps */}
              <div className="flex gap-3 text-[10px] text-muted-foreground/50 mb-1">
                <span>Created {formatDate(issue.createdAt)}</span>
                <span>·</span>
                <span>Updated {formatDate(issue.updatedAt)}</span>
              </div>

              <div className="flex gap-2">
                {!isClosed && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCloseIssue}
                    disabled={closeIssue.isPending}
                    className="flex-1"
                  >
                    Close Issue
                  </Button>
                )}
              </div>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
