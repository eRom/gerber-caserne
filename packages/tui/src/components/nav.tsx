import React from 'react';
import { Box, Text } from 'ink';

export type Screen = 'dashboard' | 'tasks' | 'issues' | 'notes' | 'messages' | 'search';

const TABS: { key: string; screen: Screen; label: string }[] = [
  { key: 'd', screen: 'dashboard', label: 'Dashboard' },
  { key: 't', screen: 'tasks',     label: 'Tasks' },
  { key: 'i', screen: 'issues',    label: 'Issues' },
  { key: 'n', screen: 'notes',     label: 'Notes' },
  { key: 'm', screen: 'messages',  label: 'Messages' },
  { key: '/', screen: 'search',    label: 'Search' },
];

interface NavProps {
  current: Screen;
}

export function Nav({ current }: NavProps) {
  return (
    <Box borderStyle="single" borderBottom borderColor="gray" paddingX={1}>
      <Text bold color="cyan">gerber </Text>
      <Text dimColor> │ </Text>
      {TABS.map((tab, idx) => (
        <React.Fragment key={tab.key}>
          {idx > 0 && <Text dimColor>  </Text>}
          <Text
            {...(current === tab.screen ? { color: 'cyan', bold: true } : { dimColor: true })}
          >
            [{tab.key}] {tab.label}
          </Text>
        </React.Fragment>
      ))}
      <Text dimColor>  │ [q] Quit</Text>
    </Box>
  );
}
