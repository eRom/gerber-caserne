import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import { Spinner } from '../components/spinner.js';
import { Table, type Column } from '../components/table.js';
import { StatusBadge } from '../components/status-badge.js';
import { useData } from '../hooks/use-data.js';
import { listIssues, getIssue, updateIssue, closeIssue } from '../api/issues.js';
import { ISSUE_STATUSES } from '@agent-brain/shared';
import { ISSUE_STATUS_LABELS, ISSUE_STATUS_COLORS, label } from '../theme.js';
import { StatusBar } from '../components/status-bar.js';
import type { Issue } from '@agent-brain/shared';

const COLUMNS: Column<Issue>[] = [
  { title: 'Status', width: 14, render: (iss) => <StatusBadge type="issue" value={iss.status} /> },
  { title: 'Severity', width: 14, render: (iss) => iss.severity ? <StatusBadge type="severity" value={iss.severity} /> : <Text dimColor>-</Text> },
  { title: 'Priority', width: 10, render: (iss) => <StatusBadge type="priority" value={iss.priority} /> },
  { title: 'Title', width: 44, flex: true, render: (iss) => <Text>{iss.title}</Text> },
];

interface IssuesProps {
  projectId: string;
}

function formatDate(ts: number | string | undefined): string {
  if (!ts) return '-';
  const d = new Date(typeof ts === 'number' ? ts * 1000 : ts);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function Issues({ projectId }: IssuesProps) {
  const [selected, setSelected] = useState(0);
  const [filter, setFilter] = useState<string | undefined>(undefined);
  const [pendingMove, setPendingMove] = useState<{ issueId: string; from: string; to: string } | null>(null);
  const [detail, setDetail] = useState<Issue | null>(null);

  const issues = useData(
    () => listIssues({ projectId, ...(filter !== undefined && { status: filter }), limit: 50 }),
    [projectId, filter],
  );

  const items = issues.data?.items ?? [];

  const previewMove = useCallback((direction: 1 | -1) => {
    const issue = detail ?? items[selected];
    if (!issue) return;
    const idx = ISSUE_STATUSES.indexOf(issue.status as typeof ISSUE_STATUSES[number]);
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= ISSUE_STATUSES.length) return;
    const newStatus = ISSUE_STATUSES[newIdx];
    if (newStatus === undefined) return;
    setPendingMove({ issueId: issue.id, from: issue.status, to: newStatus });
  }, [items, selected, detail]);

  const confirmMove = useCallback(async () => {
    if (!pendingMove) return;
    await updateIssue({ id: pendingMove.issueId, status: pendingMove.to });
    setPendingMove(null);
    if (detail) {
      const refreshed = await getIssue(detail.id);
      setDetail(refreshed.item);
    }
    issues.refetch();
  }, [pendingMove, issues, detail]);

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
      if (input === 'c') { void closeIssue(detail.id).then(() => { issues.refetch(); setDetail(null); }); return; }
      if (input === 'r') { void getIssue(detail.id).then((r) => setDetail(r.item)); return; }
      return;
    }

    // List view
    if (key.upArrow) setSelected((s) => Math.max(0, s - 1));
    if (key.downArrow) setSelected((s) => Math.min(items.length - 1, s + 1));
    if (key.return) {
      const issue = items[selected];
      if (issue) void getIssue(issue.id).then((r) => setDetail(r.item));
      return;
    }
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

    // Tab / Shift+Tab to cycle status filter
    if (key.tab) {
      const forward = !key.shift;
      setFilter((f) => {
        if (forward) {
          if (f === undefined) return ISSUE_STATUSES[0];
          const idx = ISSUE_STATUSES.indexOf(f as typeof ISSUE_STATUSES[number]);
          return idx >= ISSUE_STATUSES.length - 1 ? undefined : ISSUE_STATUSES[idx + 1];
        }
        if (f === undefined) return ISSUE_STATUSES[ISSUE_STATUSES.length - 1];
        const idx = ISSUE_STATUSES.indexOf(f as typeof ISSUE_STATUSES[number]);
        return idx <= 0 ? undefined : ISSUE_STATUSES[idx - 1];
      });
      setSelected(0);
      return;
    }
  });

  // ─── Detail view ───
  if (detail) {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Box marginBottom={1}>
          <Text bold color="cyan">--- {detail.title} </Text>
        </Box>

        <Box gap={3} marginBottom={1}>
          <Box>
            <Text dimColor>Status  </Text>
            <StatusBadge type="issue" value={detail.status} />
          </Box>
          <Box>
            <Text dimColor>Priority  </Text>
            <StatusBadge type="priority" value={detail.priority} />
          </Box>
          {detail.severity && (
            <Box>
              <Text dimColor>Severity  </Text>
              <StatusBadge type="severity" value={detail.severity} />
            </Box>
          )}
        </Box>

        <Box gap={3} marginBottom={1}>
          {detail.assignee && (
            <Box>
              <Text dimColor>Assignee  </Text>
              <Text>{detail.assignee}</Text>
            </Box>
          )}
          <Box>
            <Text dimColor>Created  </Text>
            <Text>{formatDate(detail.createdAt)}</Text>
          </Box>
          <Box>
            <Text dimColor>Updated  </Text>
            <Text>{formatDate(detail.updatedAt)}</Text>
          </Box>
        </Box>

        {detail.tags.length > 0 && (
          <Box marginBottom={1}>
            <Text dimColor>Tags  </Text>
            <Text color="cyan">{detail.tags.join(', ')}</Text>
          </Box>
        )}

        {detail.description && (
          <Box flexDirection="column" marginTop={1}>
            <Text dimColor>--- Description</Text>
            <Box marginTop={1}>
              <Text>{detail.description}</Text>
            </Box>
          </Box>
        )}

        {/* Pending move bar */}
        {pendingMove && (
          <Box marginTop={1} paddingX={1}>
            <Text color="yellow" bold>
              Move: {label(ISSUE_STATUS_LABELS, pendingMove.from)} → {label(ISSUE_STATUS_LABELS, pendingMove.to)}
            </Text>
            <Text dimColor>   Enter confirm  |  ←→ change  |  Esc cancel</Text>
          </Box>
        )}

        <Box marginTop={1}>
          <Text dimColor>Esc back  |  Space move status  |  [c] close  |  [r] refresh</Text>
        </Box>
      </Box>
    );
  }

  // ─── List view ───
  return (
    <Box flexDirection="column" paddingX={1}>
      <StatusBar statuses={ISSUE_STATUSES} labels={ISSUE_STATUS_LABELS} colors={ISSUE_STATUS_COLORS} active={filter} />

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
              {items.length}/{issues.data?.total ?? 0} issues  |  ↑↓ navigate  |  Enter detail  |  Space move status  |  [c] close  |  [r] refresh
            </Text>
          </Box>
        </>
      )}
    </Box>
  );
}
