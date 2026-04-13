import React from 'react';
import { Box, Text, useStdout } from 'ink';

export interface Column<T> {
  title: string;
  width: number;
  render: (row: T) => React.ReactNode;
}

interface TableProps<T> {
  columns: Column<T>[];
  rows: T[];
  selectedIndex?: number;
}

export function Table<T>({ columns, rows, selectedIndex }: TableProps<T>) {
  const { stdout } = useStdout();
  const termWidth = stdout.columns ?? 80;

  // Last column stretches to fill remaining width
  const fixedWidth = columns.slice(0, -1).reduce((s, c) => s + c.width, 0) + 2; // +2 for cursor
  const lastColWidth = Math.max(columns[columns.length - 1]?.width ?? 10, termWidth - fixedWidth);

  return (
    <Box flexDirection="column" width={termWidth}>
      {/* Header */}
      <Box>
        <Box width={2}><Text> </Text></Box>
        {columns.map((col, i) => (
          <Box key={i} width={i === columns.length - 1 ? lastColWidth : col.width}>
            <Text bold dimColor>{col.title}</Text>
          </Box>
        ))}
      </Box>

      {/* Separator */}
      <Box width="100%">
        <Text dimColor wrap="truncate">{'─'.repeat(300)}</Text>
      </Box>

      {/* Rows */}
      {rows.length === 0 ? (
        <Text dimColor italic>  (empty)</Text>
      ) : (
        rows.map((row, ri) => (
          <Box key={ri}>
            {selectedIndex === ri && <Text color="cyan" bold>{'> '}</Text>}
            {selectedIndex !== ri && <Text>{'  '}</Text>}
            {columns.map((col, ci) => (
              <Box key={ci} width={ci === columns.length - 1 ? lastColWidth : col.width}>
                {col.render(row)}
              </Box>
            ))}
          </Box>
        ))
      )}
    </Box>
  );
}
