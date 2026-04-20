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
  /** Lines reserved around the table (nav, header, footer). Defaults to 10. */
  reservedRows?: number;
  /** Explicit max rows to display. Overrides auto-computation. */
  maxRows?: number;
}

const SELECTOR_WIDTH = 2;
const DEFAULT_RESERVED = 10;
const MIN_VIEWPORT = 3;

function computeWindow(total: number, viewport: number, selected: number | undefined): number {
  if (total <= viewport) return 0;
  if (selected === undefined) return 0;
  // Keep selected in the middle-ish of the viewport
  const half = Math.floor(viewport / 2);
  let start = selected - half;
  if (start < 0) start = 0;
  if (start + viewport > total) start = total - viewport;
  return start;
}

export function Table<T>({ columns, rows, selectedIndex, reservedRows, maxRows }: TableProps<T>) {
  const { columns: termWidth, rows: termRows } = useTerminalSize();

  const fixedTotal = columns
    .filter((c) => !c.flex)
    .reduce((sum, c) => sum + c.width, 0);
  const flexWidth = Math.max(10, termWidth - SELECTOR_WIDTH - fixedTotal - 1);
  const getWidth = (col: Column<T>) => (col.flex ? flexWidth : col.width);

  // Reserve room for header + indicator lines (2) on top of caller chrome
  const reserve = (reservedRows ?? DEFAULT_RESERVED) + 2;
  const autoViewport = Math.max(MIN_VIEWPORT, termRows - reserve);
  const viewport = Math.max(MIN_VIEWPORT, maxRows ?? autoViewport);

  const start = computeWindow(rows.length, viewport, selectedIndex);
  const end = Math.min(rows.length, start + viewport);
  const visible = rows.slice(start, end);
  const hiddenAbove = start;
  const hiddenBelow = rows.length - end;

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

      {/* Top scroll indicator */}
      {hiddenAbove > 0 && (
        <Text dimColor>  ↑ {hiddenAbove} more</Text>
      )}

      {/* Rows */}
      {rows.length === 0 ? (
        <Text dimColor italic>  (empty)</Text>
      ) : (
        visible.map((row, vi) => {
          const ri = start + vi;
          return (
            <Box key={ri}>
              {selectedIndex === ri && <Text color="cyan" bold>{'> '}</Text>}
              {selectedIndex !== ri && <Text>{'  '}</Text>}
              {columns.map((col, ci) => (
                <Box key={ci} width={getWidth(col)}>
                  <Text wrap="truncate">{col.render(row)}</Text>
                </Box>
              ))}
            </Box>
          );
        })
      )}

      {/* Bottom scroll indicator */}
      {hiddenBelow > 0 && (
        <Text dimColor>  ↓ {hiddenBelow} more</Text>
      )}
    </Box>
  );
}
