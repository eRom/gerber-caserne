import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import { Spinner } from '../components/spinner.js';
import { Table, type Column } from '../components/table.js';
import { StatusBadge } from '../components/status-badge.js';
import { useData } from '../hooks/use-data.js';
import { listTasks, updateTask } from '../api/tasks.js';
import { TASK_STATUSES } from '@agent-brain/shared';
import { TASK_STATUS_LABELS, label } from '../theme.js';
import type { Task } from '@agent-brain/shared';

const COLUMNS: Column<Task>[] = [
  { title: 'Status', width: 10, render: (t) => <StatusBadge type="task" value={t.status} /> },
  { title: 'Priority', width: 10, render: (t) => <StatusBadge type="priority" value={t.priority} /> },
  { title: 'Title', width: 48, render: (t) => <Text>{t.title.slice(0, 46)}</Text> },
  { title: 'Tags', width: 20, render: (t) => <Text dimColor>{t.tags.slice(0, 2).join(', ')}</Text> },
];

interface TasksProps {
  projectId: string;
}

export function Tasks({ projectId }: TasksProps) {
  const [selected, setSelected] = useState(0);
  const [filter, setFilter] = useState<string | undefined>(undefined);
  const [pendingMove, setPendingMove] = useState<{ taskId: string; from: string; to: string } | null>(null);

  const tasks = useData(
    () => listTasks({ projectId, ...(filter !== undefined && { status: filter }), limit: 50 }),
    [projectId, filter],
  );

  const items = tasks.data?.items ?? [];

  const previewMove = useCallback((direction: 1 | -1) => {
    const task = items[selected];
    if (!task) return;
    const idx = TASK_STATUSES.indexOf(task.status as typeof TASK_STATUSES[number]);
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= TASK_STATUSES.length) return;
    const newStatus = TASK_STATUSES[newIdx];
    if (newStatus === undefined) return;
    setPendingMove({ taskId: task.id, from: task.status, to: newStatus });
  }, [items, selected]);

  const confirmMove = useCallback(async () => {
    if (!pendingMove) return;
    await updateTask({ id: pendingMove.taskId, status: pendingMove.to });
    setPendingMove(null);
    tasks.refetch();
  }, [pendingMove, tasks]);

  const cancelMove = useCallback(() => {
    setPendingMove(null);
  }, []);

  useInput((input, key) => {
    // Pending move mode: Enter confirms, Escape/any other key cancels
    if (pendingMove) {
      if (key.return) { void confirmMove(); return; }
      if (key.escape || input === ' ') { cancelMove(); return; }
      // Allow changing direction while previewing
      if (key.rightArrow) { previewMove(1); return; }
      if (key.leftArrow) { previewMove(-1); return; }
      cancelMove();
      return;
    }

    if (key.upArrow) setSelected((s) => Math.max(0, s - 1));
    if (key.downArrow) setSelected((s) => Math.min(items.length - 1, s + 1));
    if (input === ' ') {
      // Space opens move mode — preview next status (right)
      const task = items[selected];
      if (task) previewMove(1);
      return;
    }
    if (input === 'r') tasks.refetch();

    const num = parseInt(input, 10);
    if (num >= 1 && num <= 7) {
      setFilter(TASK_STATUSES[num - 1]);
      setSelected(0);
    }
    if (input === '0') {
      setFilter(undefined);
      setSelected(0);
    }
  });

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box marginBottom={1} gap={1}>
        {TASK_STATUSES.map((s, i) => (
          <React.Fragment key={s}>
            <Text {...(filter === s ? { color: 'cyan' as const } : { dimColor: true })}>
              [{i + 1}]{label(TASK_STATUS_LABELS, s)}
            </Text>
          </React.Fragment>
        ))}
        <Text dimColor>[0]all</Text>
      </Box>

      {/* Pending move confirmation bar */}
      {pendingMove && (
        <Box marginBottom={1} paddingX={1}>
          <Text color="yellow" bold>
            Move: {label(TASK_STATUS_LABELS, pendingMove.from)} → {label(TASK_STATUS_LABELS, pendingMove.to)}
          </Text>
          <Text dimColor>   Enter confirm  |  ←→ change  |  Esc cancel</Text>
        </Box>
      )}

      {tasks.loading ? (
        <Spinner label="Loading tasks..." />
      ) : tasks.error ? (
        <Text color="red">Error: {tasks.error.message}</Text>
      ) : (
        <>
          <Table columns={COLUMNS} rows={items} selectedIndex={selected} />
          <Box marginTop={1}>
            <Text dimColor>
              {items.length}/{tasks.data?.total ?? 0} tasks  |  ↑↓ navigate  |  Space move status  |  [r] refresh
            </Text>
          </Box>
        </>
      )}
    </Box>
  );
}
