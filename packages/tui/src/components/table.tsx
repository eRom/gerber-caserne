import React from 'react';
import { Box, Text } from 'ink';

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
  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box>
        {columns.map((col, i) => (
          <Box key={i} width={col.width}>
            <Text bold dimColor>{col.title}</Text>
          </Box>
        ))}
      </Box>

      {/* Separator */}
      <Box>
        <Text dimColor>{'─'.repeat(columns.reduce((s, c) => s + c.width, 0))}</Text>
      </Box>

      {/* Rows */}
      {rows.length === 0 ? (
        <Text dimColor italic>  (empty)</Text>
      ) : (
        rows.map((row, ri) => (
          <Box key={ri}>
            {selectedIndex === ri && <Text color="cyan" bold>{'▸ '}</Text>}
            {selectedIndex !== ri && <Text>{'  '}</Text>}
            {columns.map((col, ci) => (
              <Box key={ci} width={col.width}>
                {col.render(row)}
              </Box>
            ))}
          </Box>
        ))
      )}
    </Box>
  );
}
