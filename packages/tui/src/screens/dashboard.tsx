import React from 'react';
import { Box, Text } from 'ink';
import { Spinner } from '../components/spinner.js';
import { StatusBadge } from '../components/status-badge.js';
import { useData } from '../hooks/use-data.js';
import { getStats } from '../api/maintenance.js';
import { listTasks } from '../api/tasks.js';
import { listMessages } from '../api/messages.js';
import { listIssues } from '../api/issues.js';
import type { Stats } from '@agent-brain/shared';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function Dashboard() {
  const stats = useData<Stats>(() => getStats());
  const inProgress = useData(() => listTasks({ status: 'implementation', limit: 5 }));
  const pendingMsgs = useData(() => listMessages({ status: 'pending', limit: 5 }));
  const openIssues = useData(() => listIssues({ status: 'inbox', limit: 5 }));

  if (stats.loading) return <Spinner label="Loading dashboard…" />;
  if (stats.error) return <Text color="red">Error: {stats.error.message}</Text>;

  const s = stats.data!;

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Stats overview */}
      <Box marginBottom={1}>
        <Text bold color="cyan">{'─── Overview '}</Text>
        <Text dimColor>{'─'.repeat(50)}</Text>
      </Box>

      <Box gap={4} marginBottom={1}>
        <Box flexDirection="column">
          <Text dimColor>Projects</Text>
          <Text bold>{s.projects}</Text>
        </Box>
        <Box flexDirection="column">
          <Text dimColor>Notes</Text>
          <Text bold>{s.notes.total}</Text>
        </Box>
        <Box flexDirection="column">
          <Text dimColor>Chunks</Text>
          <Text bold>{s.chunks.total}</Text>
        </Box>
        <Box flexDirection="column">
          <Text dimColor>Embeddings</Text>
          <Text bold>{s.embeddings.total}</Text>
        </Box>
        <Box flexDirection="column">
          <Text dimColor>DB Size</Text>
          <Text bold>{formatBytes(s.dbSizeBytes)}</Text>
        </Box>
      </Box>

      {/* Top tags */}
      {s.topTags.length > 0 && (
        <Box marginBottom={1}>
          <Text dimColor>Top tags: </Text>
          {s.topTags.slice(0, 8).map((t, i) => (
            <React.Fragment key={t.tag}>
              {i > 0 && <Text dimColor>, </Text>}
              <Text color="cyan">{t.tag}</Text>
              <Text dimColor>({t.count})</Text>
            </React.Fragment>
          ))}
        </Box>
      )}

      {/* In-progress tasks */}
      <Box marginTop={1} marginBottom={1}>
        <Text bold color="yellow">{'─── In Progress '}</Text>
        <Text dimColor>{'─'.repeat(46)}</Text>
      </Box>

      {inProgress.loading ? (
        <Spinner label="Loading tasks…" />
      ) : inProgress.data?.items.length === 0 ? (
        <Text dimColor italic>  No tasks in progress</Text>
      ) : (
        inProgress.data?.items.map((t) => (
          <Box key={t.id} gap={1}>
            <StatusBadge type="priority" value={t.priority} />
            <Text>{t.title}</Text>
            <Text dimColor>({t.status})</Text>
          </Box>
        ))
      )}

      {/* Open issues */}
      <Box marginTop={1} marginBottom={1}>
        <Text bold color="red">{'─── Open Issues '}</Text>
        <Text dimColor>{'─'.repeat(46)}</Text>
      </Box>

      {openIssues.loading ? (
        <Spinner label="Loading issues…" />
      ) : openIssues.data?.items.length === 0 ? (
        <Text dimColor italic>  No open issues</Text>
      ) : (
        openIssues.data?.items.map((iss) => (
          <Box key={iss.id} gap={1}>
            {iss.severity && <StatusBadge type="severity" value={iss.severity} />}
            <Text>{iss.title}</Text>
          </Box>
        ))
      )}

      {/* Pending messages */}
      <Box marginTop={1} marginBottom={1}>
        <Text bold color="magenta">{'─── Pending Messages '}</Text>
        <Text dimColor>{'─'.repeat(41)}</Text>
      </Box>

      {pendingMsgs.loading ? (
        <Spinner label="Loading messages…" />
      ) : pendingMsgs.data?.items.length === 0 ? (
        <Text dimColor italic>  No pending messages</Text>
      ) : (
        pendingMsgs.data?.items.map((msg) => (
          <Box key={msg.id} gap={1}>
            <StatusBadge type="message" value={msg.type} />
            <Text>{msg.title}</Text>
          </Box>
        ))
      )}

      <Box marginTop={1}>
        <Text dimColor>Press [r] to refresh</Text>
      </Box>
    </Box>
  );
}
