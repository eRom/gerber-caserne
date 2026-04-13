import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import { Spinner } from '../components/spinner.js';
import { Table, type Column } from '../components/table.js';
import { StatusBadge } from '../components/status-badge.js';
import { useData } from '../hooks/use-data.js';
import { listTasks, getTask, updateTask, type TaskGetResponse } from '../api/tasks.js';
import { TASK_STATUSES } from '@agent-brain/shared';
import { TASK_STATUS_LABELS, TASK_STATUS_COLORS, label } from '../theme.js';
import { StatusBar } from '../components/status-bar.js';
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

function formatDate(ts: number | string | undefined): string {
  if (!ts) return '-';
  const d = new Date(typeof ts === 'number' ? ts * 1000 : ts);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function Tasks({ projectId }: TasksProps) {
  const [selected, setSelected] = useState(0);
  const [filter, setFilter] = useState<string | undefined>(undefined);
  const [pendingMove, setPendingMove] = useState<{ taskId: string; from: string; to: string } | null>(null);
  const [detail, setDetail] = useState<TaskGetResponse | null>(null);

  const tasks = useData(
    () => listTasks({ projectId, ...(filter !== undefined && { status: filter }), limit: 50 }),
    [projectId, filter],
  );

  const items = tasks.data?.items ?? [];

  const previewMove = useCallback((direction: 1 | -1) => {
    const task = detail ? detail.item : items[selected];
    if (!task) return;
    const idx = TASK_STATUSES.indexOf(task.status as typeof TASK_STATUSES[number]);
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= TASK_STATUSES.length) return;
    const newStatus = TASK_STATUSES[newIdx];
    if (newStatus === undefined) return;
    setPendingMove({ taskId: task.id, from: task.status, to: newStatus });
  }, [items, selected, detail]);

  const confirmMove = useCallback(async () => {
    if (!pendingMove) return;
    await updateTask({ id: pendingMove.taskId, status: pendingMove.to });
    setPendingMove(null);
    if (detail) {
      const refreshed = await getTask(detail.item.id);
      setDetail(refreshed);
    }
    tasks.refetch();
  }, [pendingMove, tasks, detail]);

  const cancelMove = useCallback(() => {
    setPendingMove(null);
  }, []);

  useInput((input, key) => {
    // Pending move mode
    if (pendingMove) {
      if (key.return) { void confirmMove(); return; }
      if (key.escape || input === ' ') { cancelMove(); return; }
      if (key.rightArrow) { previewMove(1); return; }
      if (key.leftArrow) { previewMove(-1); return; }
      cancelMove();
      return;
    }

    // Detail view
    if (detail) {
      if (key.escape) { setDetail(null); return; }
      if (input === ' ') { previewMove(1); return; }
      if (input === 'r') { void getTask(detail.item.id).then(setDetail); return; }
      return;
    }

    // List view
    if (key.upArrow) setSelected((s) => Math.max(0, s - 1));
    if (key.downArrow) setSelected((s) => Math.min(items.length - 1, s + 1));
    if (key.return) {
      const task = items[selected];
      if (task) void getTask(task.id).then(setDetail);
      return;
    }
    if (input === ' ') {
      const task = items[selected];
      if (task) previewMove(1);
      return;
    }
    if (input === 'r') tasks.refetch();

    // Tab / Shift+Tab to cycle status filter
    if (key.tab) {
      const forward = !key.shift;
      setFilter((f) => {
        if (forward) {
          if (f === undefined) return TASK_STATUSES[0];
          const idx = TASK_STATUSES.indexOf(f as typeof TASK_STATUSES[number]);
          return idx >= TASK_STATUSES.length - 1 ? undefined : TASK_STATUSES[idx + 1];
        }
        // backward
        if (f === undefined) return TASK_STATUSES[TASK_STATUSES.length - 1];
        const idx = TASK_STATUSES.indexOf(f as typeof TASK_STATUSES[number]);
        return idx <= 0 ? undefined : TASK_STATUSES[idx - 1];
      });
      setSelected(0);
      return;
    }
  });

  // ─── Detail view ───
  if (detail) {
    const t = detail.item;
    return (
      <Box flexDirection="column" paddingX={1}>
        <Box marginBottom={1}>
          <Text bold color="cyan">--- {t.title} </Text>
        </Box>

        <Box gap={3} marginBottom={1}>
          <Box>
            <Text dimColor>Status  </Text>
            <StatusBadge type="task" value={t.status} />
          </Box>
          <Box>
            <Text dimColor>Priority  </Text>
            <StatusBadge type="priority" value={t.priority} />
          </Box>
          {t.assignee && (
            <Box>
              <Text dimColor>Assignee  </Text>
              <Text>{t.assignee}</Text>
            </Box>
          )}
        </Box>

        <Box gap={3} marginBottom={1}>
          <Box>
            <Text dimColor>Created  </Text>
            <Text>{formatDate(t.createdAt)}</Text>
          </Box>
          <Box>
            <Text dimColor>Updated  </Text>
            <Text>{formatDate(t.updatedAt)}</Text>
          </Box>
          {t.dueDate && (
            <Box>
              <Text dimColor>Due  </Text>
              <Text color="yellow">{t.dueDate}</Text>
            </Box>
          )}
          {t.completedAt && (
            <Box>
              <Text dimColor>Completed  </Text>
              <Text color="green">{formatDate(t.completedAt)}</Text>
            </Box>
          )}
        </Box>

        {t.tags.length > 0 && (
          <Box marginBottom={1}>
            <Text dimColor>Tags  </Text>
            <Text color="cyan">{t.tags.join(', ')}</Text>
          </Box>
        )}

        {t.waitingOn && (
          <Box marginBottom={1}>
            <Text dimColor>Waiting on  </Text>
            <Text color="yellow">{t.waitingOn}</Text>
          </Box>
        )}

        {t.description && (
          <Box flexDirection="column" marginTop={1}>
            <Text dimColor>--- Description</Text>
            <Box marginTop={1}>
              <Text>{t.description}</Text>
            </Box>
          </Box>
        )}

        {detail.subtasks.length > 0 && (
          <Box flexDirection="column" marginTop={1}>
            <Text dimColor>--- Subtasks ({detail.subtasks.length})</Text>
            {detail.subtasks.map((st) => (
              <Box key={st.id} gap={1} marginTop={1}>
                <Text>  </Text>
                <StatusBadge type="task" value={st.status} />
                <StatusBadge type="priority" value={st.priority} />
                <Text>{st.title}</Text>
              </Box>
            ))}
          </Box>
        )}

        {/* Pending move bar */}
        {pendingMove && (
          <Box marginTop={1} paddingX={1}>
            <Text color="yellow" bold>
              Move: {label(TASK_STATUS_LABELS, pendingMove.from)} → {label(TASK_STATUS_LABELS, pendingMove.to)}
            </Text>
            <Text dimColor>   Enter confirm  |  ←→ change  |  Esc cancel</Text>
          </Box>
        )}

        <Box marginTop={1}>
          <Text dimColor>Esc back  |  Space move status  |  [r] refresh</Text>
        </Box>
      </Box>
    );
  }

  // ─── List view ───
  return (
    <Box flexDirection="column" paddingX={1}>
      <StatusBar statuses={TASK_STATUSES} labels={TASK_STATUS_LABELS} colors={TASK_STATUS_COLORS} active={filter} />

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
              {items.length}/{tasks.data?.total ?? 0} tasks  |  ↑↓ navigate  |  Enter detail  |  Space move status  |  [r] refresh
            </Text>
          </Box>
        </>
      )}
    </Box>
  );
}
