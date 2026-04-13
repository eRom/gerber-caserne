import React from 'react';
import { Box, Text, useStdout } from 'ink';

function Sep() {
  const { stdout } = useStdout();
  const cols = stdout.columns ?? 80;
  return (
    <Box>
      <Text dimColor>{'─'.repeat(cols)}</Text>
    </Box>
  );
}

// ---- Main navigation (always visible) ----

export type GlobalScreen = 'home' | 'search';

interface MainNavProps {
  current: GlobalScreen;
  inSearch: boolean;
}

export function MainNav({ current, inSearch }: MainNavProps) {
  return (
    <>
      <Sep />
      <Box paddingX={1} justifyContent="space-between">
        <Box>
          <Text bold color="cyan">gerber</Text>
          <Text dimColor> |</Text>
        </Box>
        <Box gap={1}>
          <Text {...(current === 'home' && !inSearch ? { color: 'cyan', bold: true, underline: true } : { dimColor: true })}>
            home
          </Text>
          <Text dimColor>|</Text>
          <Text {...(inSearch ? { color: 'cyan', bold: true, underline: true } : { dimColor: true })}>
            search
          </Text>
          <Text dimColor>|</Text>
          <Text dimColor underline>quit</Text>
        </Box>
      </Box>
      <Sep />
    </>
  );
}

// ---- Project sub-navigation (visible when inside a project) ----

export type ProjectScreen = 'tasks' | 'issues' | 'notes';

interface ProjectNavProps {
  projectName: string;
  projectColor?: string | undefined;
  current: ProjectScreen;
}

export function ProjectNav({ projectName, current }: ProjectNavProps) {
  return (
    <>
      <Box paddingX={1} justifyContent="space-between">
        <Box>
          <Text bold color="yellow">{projectName}</Text>
          <Text dimColor> |</Text>
        </Box>
        <Box gap={1}>
          <Text {...(current === 'tasks' ? { color: 'cyan', bold: true, underline: true } : { dimColor: true })}>
            tasks
          </Text>
          <Text dimColor>|</Text>
          <Text {...(current === 'issues' ? { color: 'cyan', bold: true, underline: true } : { dimColor: true })}>
            issues
          </Text>
          <Text dimColor>|</Text>
          <Text {...(current === 'notes' ? { color: 'cyan', bold: true, underline: true } : { dimColor: true })}>
            notes
          </Text>
          <Text dimColor>|</Text>
          <Text dimColor underline>close</Text>
        </Box>
      </Box>
      <Sep />
    </>
  );
}
