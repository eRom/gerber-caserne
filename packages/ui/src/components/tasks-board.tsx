import { useState } from 'react';
import { KanbanColumn } from './kanban-column';
import { KanbanCard } from './kanban-card';
import { TaskDetailSheet } from './task-detail-sheet';
import { useTasks, useCreateTask } from '@/api/hooks/use-tasks';

const TASK_COLUMNS = [
  { status: 'inbox', title: 'Inbox', color: 'bg-amber-500' },
  { status: 'brainstorming', title: 'Brainstorm', color: 'bg-violet-500' },
  { status: 'specification', title: 'Spec', color: 'bg-blue-500' },
  { status: 'plan', title: 'Plan', color: 'bg-cyan-500' },
  { status: 'implementation', title: 'Implem', color: 'bg-emerald-500' },
  { status: 'test', title: 'Test', color: 'bg-pink-500' },
  { status: 'done', title: 'Done', color: 'bg-muted-foreground/20' },
] as const;

interface TasksBoardProps {
  projectId: string;
}

export function TasksBoard({ projectId }: TasksBoardProps) {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [addingInColumn, setAddingInColumn] = useState<string | null>(null);

  const { data } = useTasks({ projectId, limit: 200 });
  const createTask = useCreateTask();

  const tasks = data?.items ?? [];

  return (
    <>
      <div className="flex gap-3 p-4 h-full overflow-x-auto">
        {TASK_COLUMNS.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.status && !t.parentId);
          return (
            <KanbanColumn
              key={col.status}
              title={col.title}
              color={col.color}
              count={colTasks.length}
              addingMode={addingInColumn === col.status}
              onAdd={() => setAddingInColumn(col.status)}
              onAddSubmit={(title) => {
                createTask.mutate({ projectId, title, status: col.status });
                setAddingInColumn(null);
              }}
              onAddCancel={() => setAddingInColumn(null)}
            >
              {colTasks.map((task) => (
                <KanbanCard
                  key={task.id}
                  title={task.title}
                  priority={task.priority}
                  tags={task.tags}
                  assignee={task.assignee ?? null}
                  dueDate={task.dueDate ? Number(task.dueDate) : null}
                  isDone={col.status === 'done'}
                  onClick={() => setSelectedTaskId(task.id)}
                />
              ))}
            </KanbanColumn>
          );
        })}
      </div>

      <TaskDetailSheet
        taskId={selectedTaskId}
        projectId={projectId}
        onClose={() => setSelectedTaskId(null)}
      />
    </>
  );
}
