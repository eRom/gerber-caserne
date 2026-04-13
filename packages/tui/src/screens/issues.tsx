import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import { Spinner } from '../components/spinner.js';
import { Table, type Column } from '../components/table.js';
import { StatusBadge } from '../components/status-badge.js';
import { useData } from '../hooks/use-data.js';
import { listIssues, updateIssue, closeIssue } from '../api/issues.js';
import { ISSUE_STATUSES } from '@agent-brain/shared';
import { ISSUE_STATUS_LABELS, label } from '../theme.js';
import type { Issue } from '@agent-brain/shared';

const COLUMNS: Column<Issue>[] = [
  { title: 'Status', width: 14, render: (iss) => <StatusBadge type="issue" value={iss.status} /> },
  { title: 'Severity', width: 14, render: (iss) => iss.severity ? <StatusBadge type="severity" value={iss.severity} /> : <Text dimColor>-</Text> },
  { title: 'Priority', width: 10, render: (iss) => <StatusBadge type="priority" value={iss.priority} /> },
  { title: 'Title', width: 44, render: (iss) => <Text>{iss.title.slice(0, 42)}</Text> },
];

interface IssuesProps {
  projectId: string;
}

export function Issues({ projectId }: IssuesProps) {
  const [selected, setSelected] = useState(0);
  const [filter, setFilter] = useState<string | undefined>(undefined);
  const [pendingMove, setPendingMove] = useState<{ issueId: string; from: string; to: string } | null>(null);

  const issues = useData(
    () => listIssues({ projectId, ...(filter !== undefined && { status: filter }), limit: 50 }),
    [projectId, filter],
  );

  const items = issues.data?.items ?? [];

  const previewMove = useCallback((direction: 1 | -1) => {
    const issue = items[selected];
    if (!issue) return;
    const idx = ISSUE_STATUSES.indexOf(issue.status as typeof ISSUE_STATUSES[number]);
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= ISSUE_STATUSES.length) return;
    const newStatus = ISSUE_STATUSES[newIdx];
    if (newStatus === undefined) return;
    setPendingMove({ issueId: issue.id, from: issue.status, to: newStatus });
  }, [items, selected]);

  const confirmMove = useCallback(async () => {
    if (!pendingMove) return;
    await updateIssue({ id: pendingMove.issueId, status: pendingMove.to });
    setPendingMove(null);
    issues.refetch();
  }, [pendingMove, issues]);

  const cancelMove = useCallback(() => {
    setPendingMove(null);
  }, []);

  useInput((input, key) => {
    if (pendingMove) {
      if (key.return) { void confirmMove(); return; }
      if (key.escape || input === ' ') { cancelMove(); return; }
      if (key.rightArrow) { previewMove(1); return; }
      if (key.leftArrow) { previewMove(-1); return; }
      cancelMove();
      return;
    }

    if (key.upArrow) setSelected((s) => Math.max(0, s - 1));
    if (key.downArrow) setSelected((s) => Math.min(items.length - 1, s + 1));
    if (input === ' ') {
      const issue = items[selected];
      if (issue) previewMove(1);
      return;
    }
    if (input === 'r') issues.refetch();
    if (input === 'c') {
      const issue = items[selected];
      if (issue) void closeIssue(issue.id).then(() => issues.refetch());
    }

    const num = parseInt(input, 10);
    if (num >= 1 && num <= 4) {
      setFilter(ISSUE_STATUSES[num - 1]);
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
        {ISSUE_STATUSES.map((s, i) => (
          <React.Fragment key={s}>
            <Text {...(filter === s ? { color: 'cyan' as const } : { dimColor: true })}>
              [{i + 1}]{label(ISSUE_STATUS_LABELS, s)}
            </Text>
          </React.Fragment>
        ))}
        <Text dimColor>[0]all</Text>
      </Box>

      {pendingMove && (
        <Box marginBottom={1} paddingX={1}>
          <Text color="yellow" bold>
            Move: {label(ISSUE_STATUS_LABELS, pendingMove.from)} → {label(ISSUE_STATUS_LABELS, pendingMove.to)}
          </Text>
          <Text dimColor>   Enter confirm  |  ←→ change  |  Esc cancel</Text>
        </Box>
      )}

      {issues.loading ? (
        <Spinner label="Loading issues..." />
      ) : issues.error ? (
        <Text color="red">Error: {issues.error.message}</Text>
      ) : (
        <>
          <Table columns={COLUMNS} rows={items} selectedIndex={selected} />
          <Box marginTop={1}>
            <Text dimColor>
              {items.length}/{issues.data?.total ?? 0} issues  |  ↑↓ navigate  |  Space move status  |  [c] close  |  [r] refresh
            </Text>
          </Box>
        </>
      )}
    </Box>
  );
}
