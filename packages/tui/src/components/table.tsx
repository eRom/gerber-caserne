import React from 'react';
import { Box, Text } from 'ink';
import { useTerminalSize } from '../hooks/use-terminal-size.js';

export interface Column<T> {
  title: string;
  width: number;
  flex?: boolean;
  render: (row: T) => React.ReactNode;
}

interface TableProps<T> {
  columns: Column<T>[];
  rows: T[];
  selectedIndex?: number;
}

const SELECTOR_WIDTH = 2;

export function Table<T>({ columns, rows, selectedIndex }: TableProps<T>) {
  const { columns: termWidth } = useTerminalSize();

  // Calculate flex column width: terminal - selector - fixed columns
  const fixedTotal = columns
    .filter((c) => !c.flex)
    .reduce((sum, c) => sum + c.width, 0);
  const flexWidth = Math.max(10, termWidth - SELECTOR_WIDTH - fixedTotal - 1);

  const getWidth = (col: Column<T>) => (col.flex ? flexWidth : col.width);

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box>
        <Box width={SELECTOR_WIDTH}><Text> </Text></Box>
        {columns.map((col, i) => (
          <Box key={i} width={getWidth(col)}>
            <Text bold dimColor wrap="truncate">{col.title}</Text>
          </Box>
        ))}
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
              <Box key={ci} width={getWidth(col)}>
                <Text wrap="truncate">{col.render(row)}</Text>
              </Box>
            ))}
          </Box>
        ))
      )}
    </Box>
  );
}
