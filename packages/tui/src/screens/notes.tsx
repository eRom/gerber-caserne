import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { Spinner } from '../components/spinner.js';
import { Table, type Column } from '../components/table.js';
import { StatusBadge } from '../components/status-badge.js';
import { useData } from '../hooks/use-data.js';
import { listNotes, getNote } from '../api/notes.js';
import type { Note } from '@agent-brain/shared';

const COLUMNS: Column<Note>[] = [
  { title: 'Kind', width: 10, render: (n) => <StatusBadge type="kind" value={n.kind} /> },
  { title: 'Status', width: 12, render: (n) => <StatusBadge type="note" value={n.status} /> },
  { title: 'Title', width: 44, render: (n) => <Text>{n.title.slice(0, 42)}</Text> },
  { title: 'Tags', width: 20, render: (n) => <Text dimColor>{n.tags.slice(0, 3).join(', ')}</Text> },
];

export function Notes() {
  const [selected, setSelected] = useState(0);
  const [detail, setDetail] = useState<Note | null>(null);
  const [kindFilter, setKindFilter] = useState<string | undefined>(undefined);

  const notes = useData(
    () => listNotes({ ...(kindFilter !== undefined && { kind: kindFilter }), limit: 50, sort: 'updated' }),
    [kindFilter],
  );

  const items = notes.data?.items ?? [];

  useInput((input, key) => {
    if (detail) {
      // Detail view — escape back
      if (key.escape || input === 'b') setDetail(null);
      return;
    }

    if (key.upArrow) setSelected((s) => Math.max(0, s - 1));
    if (key.downArrow) setSelected((s) => Math.min(items.length - 1, s + 1));
    if (key.return) {
      const note = items[selected];
      if (note) void getNote(note.id).then((r) => setDetail(r.item));
    }
    if (input === 'r') notes.refetch();
    if (input === 'a') { setKindFilter('atom'); setSelected(0); }
    if (input === 'o') { setKindFilter('document'); setSelected(0); } // 'o' for dOcument
    if (input === '0') { setKindFilter(undefined); setSelected(0); }
  });

  // Detail view
  if (detail) {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Box marginBottom={1}>
          <Text bold color="cyan">{'─── '}{detail.title}{' '}</Text>
          <Text dimColor>{'─'.repeat(30)}</Text>
        </Box>
        <Box gap={2} marginBottom={1}>
          <StatusBadge type="kind" value={detail.kind} />
          <StatusBadge type="note" value={detail.status} />
          <Text dimColor>source: {detail.source}</Text>
        </Box>
        {detail.tags.length > 0 && (
          <Box marginBottom={1}>
            <Text dimColor>tags: </Text>
            <Text color="cyan">{detail.tags.join(', ')}</Text>
          </Box>
        )}
        <Box flexDirection="column" marginTop={1}>
          <Text>{detail.content}</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>[b] Back to list</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">{'─── Notes '}</Text>
        {kindFilter && <Text color="yellow">[{kindFilter}] </Text>}
        <Text dimColor>{'─'.repeat(50)}</Text>
      </Box>

      <Box marginBottom={1} gap={2}>
        <Text {...(kindFilter === 'atom' ? { color: 'cyan' as const } : { dimColor: true })}>[a]atom</Text>
        <Text {...(kindFilter === 'document' ? { color: 'cyan' as const } : { dimColor: true })}>[o]document</Text>
        <Text dimColor>[0]all</Text>
      </Box>

      {notes.loading ? (
        <Spinner label="Loading notes…" />
      ) : notes.error ? (
        <Text color="red">Error: {notes.error.message}</Text>
      ) : (
        <>
          <Table columns={COLUMNS} rows={items} selectedIndex={selected} />
          <Box marginTop={1}>
            <Text dimColor>
              {items.length}/{notes.data?.total ?? 0} notes  │  ↑↓ navigate  │  Enter open  │  [r] refresh
            </Text>
          </Box>
        </>
      )}
    </Box>
  );
}
