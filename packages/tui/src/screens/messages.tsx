import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import { Spinner } from '../components/spinner.js';
import { StatusBadge } from '../components/status-badge.js';
import { useData } from '../hooks/use-data.js';
import { listMessages, updateMessage } from '../api/messages.js';
import type { Message } from '@agent-brain/shared';

export function Messages() {
  const [selected, setSelected] = useState(0);
  const [filter, setFilter] = useState<string | undefined>('pending');

  const messages = useData(
    () => listMessages({ ...(filter !== undefined && { status: filter }), limit: 30 }),
    [filter],
  );

  const items = messages.data?.items ?? [];

  const markDone = useCallback(async () => {
    const msg = items[selected];
    if (!msg || msg.status === 'done') return;
    await updateMessage({ id: msg.id, status: 'done' });
    messages.refetch();
  }, [items, selected, messages]);

  useInput((input, key) => {
    if (key.upArrow) setSelected((s) => Math.max(0, s - 1));
    if (key.downArrow) setSelected((s) => Math.min(items.length - 1, s + 1));
    if (key.return || input === 'x') void markDone();
    if (input === 'r') messages.refetch();
    if (input === 'p') { setFilter('pending'); setSelected(0); }
    if (input === 'a') { setFilter(undefined); setSelected(0); }
  });

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">{'─── Messages '}</Text>
        {filter && <Text color="yellow">[{filter}] </Text>}
        <Text dimColor>{'─'.repeat(46)}</Text>
      </Box>

      <Box marginBottom={1} gap={2}>
        <Text {...(filter === 'pending' ? { color: 'cyan' as const } : { dimColor: true })}>[p]pending</Text>
        <Text {...(filter === undefined ? { color: 'cyan' as const } : { dimColor: true })}>[a]all</Text>
        <Text dimColor>  │  pending: {messages.data?.pendingCount ?? '…'}</Text>
      </Box>

      {messages.loading ? (
        <Spinner label="Loading messages…" />
      ) : messages.error ? (
        <Text color="red">Error: {messages.error.message}</Text>
      ) : items.length === 0 ? (
        <Text dimColor italic>  No messages</Text>
      ) : (
        <Box flexDirection="column">
          {items.map((msg, i) => (
            <Box key={msg.id} flexDirection="column" marginBottom={1}>
              <Box>
                {selected === i && <Text color="cyan" bold>{'▸ '}</Text>}
                {selected !== i && <Text>{'  '}</Text>}
                <StatusBadge type="message" value={msg.status} />
                <Text> </Text>
                <Text bold>{msg.title}</Text>
                <Text dimColor> ({msg.type})</Text>
              </Box>
              {selected === i && (
                <Box paddingLeft={4}>
                  <Text>{msg.content.slice(0, 200)}{msg.content.length > 200 ? '…' : ''}</Text>
                </Box>
              )}
            </Box>
          ))}

          <Box marginTop={1}>
            <Text dimColor>
              {items.length} messages  │  ↑↓ navigate  │  Enter/[x] mark done  │  [r] refresh
            </Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}
