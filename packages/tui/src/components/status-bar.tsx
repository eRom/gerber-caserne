import React from 'react';
import { Box, Text } from 'ink';

interface StatusBarProps {
  statuses: readonly string[];
  labels: Record<string, string>;
  colors: Record<string, string>;
  active?: string | undefined;
  onAllLabel?: string;
}

/** Centered status filter bar: inbox | brain | spec | plan | dev | test | done */
export function StatusBar({ statuses, labels, colors, active, onAllLabel = 'all' }: StatusBarProps) {
  return (
    <Box justifyContent="center" marginBottom={1}>
      {statuses.map((s, i) => {
        const lbl = labels[s] ?? s;
        const color = colors[s] ?? 'white';
        const isActive = active === s;
        return (
          <React.Fragment key={s}>
            {i > 0 && <Text dimColor> | </Text>}
            <Text
              {...(isActive ? { color, bold: true, underline: true } : active === undefined ? { color } : { dimColor: true })}
            >
              {lbl}
            </Text>
          </React.Fragment>
        );
      })}
      <Text dimColor> | </Text>
      <Text {...(active === undefined ? { bold: true, underline: true } : { dimColor: true })}>
        {onAllLabel}
      </Text>
    </Box>
  );
}
