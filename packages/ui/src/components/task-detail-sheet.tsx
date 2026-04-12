import { useState, useEffect, useMemo } from 'react';
import { Trash2 } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useTask, useUpdateTask, useDeleteTask, useCreateTask } from '@/api/hooks/use-tasks';
import { cn } from '@/lib/utils';

const TASK_COLUMNS = [
  { status: 'inbox', label: 'Inbox' },
  { status: 'brainstorming', label: 'Brainstorm' },
  { status: 'specification', label: 'Spec' },
  { status: 'plan', label: 'Plan' },
  { status: 'implementation', label: 'Implem' },
  { status: 'test', label: 'Test' },
  { status: 'done', label: 'Done' },
] as const;

interface TaskDetailSheetProps {
  taskId: string | null;
  projectId: string;
  onClose: () => void;
}

function epochToDateString(epoch: number): string {
  const d = new Date(epoch);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateStringToEpoch(dateStr: string): number {
  return new Date(dateStr).getTime();
}

export function TaskDetailSheet({ taskId, projectId, onClose }: TaskDetailSheetProps) {
  const { data } = useTask(taskId);
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const createTask = useCreateTask();

  const task = data?.item;
  const subtasks = data?.subtasks ?? [];

  // Local state for debounced fields
  const [localTitle, setLocalTitle] = useState('');
  const [localAssignee, setLocalAssignee] = useState('');
  const [localDescription, setLocalDescription] = useState('');
  const [localTags, setLocalTags] = useState('');
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  useEffect(() => {
    if (task) {
      setLocalTitle(task.title);
      setLocalAssignee(task.assignee ?? '');
      setLocalDescription(task.description ?? '');
      setLocalTags(task.tags?.join(', ') ?? '');
    }
  }, [task?.id]);

  // Debounced save — title
  const saveTitle = useMemo(() => {
    let timer: ReturnType<typeof setTimeout>;
    return (value: string) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (taskId && value !== task?.title) {
          updateTask.mutate({ id: taskId, title: value });
        }
      }, 500);
    };
  }, [taskId, task?.title]);

  // Debounced save — assignee
  const saveAssignee = useMemo(() => {
    let timer: ReturnType<typeof setTimeout>;
    return (value: string) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (taskId && value !== (task?.assignee ?? '')) {
          if (value) {
            updateTask.mutate({ id: taskId, assignee: value });
          } else {
            updateTask.mutate({ id: taskId });
          }
        }
      }, 500);
    };
  }, [taskId, task?.assignee]);

  // Debounced save — description
  const saveDescription = useMemo(() => {
    let timer: ReturnType<typeof setTimeout>;
    return (value: string) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (taskId && value !== (task?.description ?? '')) {
          updateTask.mutate({ id: taskId, description: value });
        }
      }, 500);
    };
  }, [taskId, task?.description]);

  function handleTagsBlur() {
    if (!taskId) return;
    const parsed = localTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const current = task?.tags ?? [];
    if (JSON.stringify(parsed) !== JSON.stringify(current)) {
      updateTask.mutate({ id: taskId, tags: parsed });
    }
  }

  function handleDueDateChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!taskId) return;
    const value = e.target.value;
    if (value) {
      const epoch = dateStringToEpoch(value);
      updateTask.mutate({ id: taskId, dueDate: String(epoch) });
    } else {
      // omit dueDate to clear it — exactOptionalPropertyTypes requires no undefined
      updateTask.mutate({ id: taskId });
    }
  }

  function handleDelete() {
    if (!taskId) return;
    if (window.confirm('Delete this task? This action cannot be undone.')) {
      deleteTask.mutate({ id: taskId });
      onClose();
    }
  }

  function handleAddSubtask() {
    const trimmed = newSubtaskTitle.trim();
    if (!trimmed || !taskId) return;
    createTask.mutate({ projectId, title: trimmed, parentId: taskId, status: 'inbox' });
    setNewSubtaskTitle('');
  }

  function handleSubtaskKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleAddSubtask();
  }

  function toggleSubtask(subtaskId: string, currentStatus: string) {
    const newStatus = currentStatus === 'done' ? 'inbox' : 'done';
    updateTask.mutate({ id: subtaskId, status: newStatus });
  }

  const dueDateValue = task?.dueDate
    ? epochToDateString(Number(task.dueDate))
    : '';

  return (
    <Sheet open={!!taskId} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent
        side="right"
        className="w-[480px] sm:max-w-[480px] overflow-y-auto flex flex-col gap-0 p-0"
      >
        {task && (
          <>
            {/* Header */}
            <SheetHeader className="px-5 pt-5 pb-3 border-b border-border/50">
              {/* Visually hidden title for accessibility */}
              <SheetTitle className="sr-only">{task.title}</SheetTitle>
              <input
                value={localTitle}
                onChange={(e) => {
                  setLocalTitle(e.target.value);
                  saveTitle(e.target.value);
                }}
                className="w-full bg-transparent text-base font-bold text-foreground outline-none border-none placeholder:text-muted-foreground focus:ring-0 pr-8"
                placeholder="Task title..."
              />
            </SheetHeader>

            <div className="flex flex-col gap-4 px-5 py-4 flex-1">
              {/* Status pills */}
              <div className="flex flex-wrap gap-1.5">
                {TASK_COLUMNS.map((col) => (
                  <button
                    key={col.status}
                    onClick={() => {
                      if (col.status !== task.status) {
                        updateTask.mutate({ id: task.id, status: col.status });
                      }
                    }}
                    className={cn(
                      'px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors',
                      task.status === col.status
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80',
                    )}
                  >
                    {col.label}
                  </button>
                ))}
              </div>

              {/* Fields */}
              <div className="flex flex-col gap-3">
                {/* Priority */}
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-muted-foreground w-20 shrink-0">Priority</span>
                  <Select
                    value={task.priority}
                    onValueChange={(value) => updateTask.mutate({ id: task.id, priority: value })}
                  >
                    <SelectTrigger size="sm" className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Assignee */}
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-muted-foreground w-20 shrink-0">Assignee</span>
                  <Input
                    value={localAssignee}
                    onChange={(e) => {
                      setLocalAssignee(e.target.value);
                      saveAssignee(e.target.value);
                    }}
                    placeholder="—"
                    className="h-7 text-sm"
                  />
                </div>

                {/* Due date */}
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-muted-foreground w-20 shrink-0">Due date</span>
                  <input
                    type="date"
                    value={dueDateValue}
                    onChange={handleDueDateChange}
                    className="h-7 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
                  />
                </div>

                {/* Tags */}
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-muted-foreground w-20 shrink-0">Tags</span>
                  <Input
                    value={localTags}
                    onChange={(e) => setLocalTags(e.target.value)}
                    onBlur={handleTagsBlur}
                    placeholder="tag1, tag2"
                    className="h-7 text-sm"
                  />
                </div>

                {/* Description */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] text-muted-foreground">Description</span>
                  <Textarea
                    value={localDescription}
                    onChange={(e) => {
                      setLocalDescription(e.target.value);
                      saveDescription(e.target.value);
                    }}
                    placeholder="Add a description..."
                    className="min-h-[80px] text-sm resize-none"
                  />
                </div>
              </div>

              {/* Subtasks */}
              <div className="flex flex-col gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Subtasks {subtasks.length > 0 && `(${subtasks.length})`}
                </span>

                {subtasks.length > 0 && (
                  <div className="flex flex-col gap-1">
                    {subtasks.map((sub) => (
                      <label
                        key={sub.id}
                        className="flex items-center gap-2.5 cursor-pointer group"
                      >
                        <input
                          type="checkbox"
                          checked={sub.status === 'done'}
                          onChange={() => toggleSubtask(sub.id, sub.status)}
                          className="rounded border-border text-primary focus:ring-ring"
                        />
                        <span
                          className={cn(
                            'text-sm text-foreground',
                            sub.status === 'done' && 'line-through text-muted-foreground',
                          )}
                        >
                          {sub.title}
                        </span>
                      </label>
                    ))}
                  </div>
                )}

                {/* Add subtask input */}
                <input
                  value={newSubtaskTitle}
                  onChange={(e) => setNewSubtaskTitle(e.target.value)}
                  onKeyDown={handleSubtaskKeyDown}
                  placeholder="+ Add subtask..."
                  className="w-full rounded-md border border-dashed border-border/60 bg-transparent px-2.5 py-1.5 text-[12px] text-foreground placeholder:text-muted-foreground/40 focus:border-ring focus:outline-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-border/50 mt-auto">
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] text-muted-foreground">
                  Created {new Date(task.createdAt).toLocaleDateString()}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  Updated {new Date(task.updatedAt).toLocaleDateString()}
                </span>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                className="gap-1.5"
              >
                <Trash2 className="size-3.5" />
                Delete
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
