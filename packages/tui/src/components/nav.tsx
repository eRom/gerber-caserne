import React from 'react';
import { Box, Text } from 'ink';

// ---- Main navigation (always visible) ----

export type GlobalScreen = 'home' | 'search';

interface MainNavProps {
  current: GlobalScreen;
  hasProject: boolean;
}

export function MainNav({ current, hasProject }: MainNavProps) {
  return (
    <Box paddingX={1}>
      <Text bold color="cyan">gerber</Text>
      <Text dimColor> | </Text>
      <Text {...(current === 'home' && !hasProject ? { color: 'cyan', bold: true } : { dimColor: true })}>
        [h] Home
      </Text>
      <Text dimColor>    </Text>
      <Text {...(current === 'search' && !hasProject ? { color: 'cyan', bold: true } : { dimColor: true })}>
        [/] Search
      </Text>
      <Text dimColor> | [q] Quit</Text>
    </Box>
  );
}

// ---- Project sub-navigation (visible when inside a project) ----

export type ProjectScreen = 'tasks' | 'issues' | 'notes' | 'search';

interface ProjectNavProps {
  projectName: string;
  projectColor?: string | undefined;
  current: ProjectScreen;
}

export function ProjectNav({ projectName, current }: ProjectNavProps) {
  return (
    <Box paddingX={1}>
      <Text bold color="yellow">{projectName}</Text>
      <Text dimColor> | </Text>
      <Text {...(current === 'tasks' ? { color: 'cyan', bold: true } : { dimColor: true })}>
        [t] Tasks
      </Text>
      <Text dimColor>    </Text>
      <Text {...(current === 'issues' ? { color: 'cyan', bold: true } : { dimColor: true })}>
        [i] Issues
      </Text>
      <Text dimColor>    </Text>
      <Text {...(current === 'notes' ? { color: 'cyan', bold: true } : { dimColor: true })}>
        [n] Notes
      </Text>
      <Text dimColor>    </Text>
      <Text {...(current === 'search' ? { color: 'cyan', bold: true } : { dimColor: true })}>
        [/] Search
      </Text>
      <Text dimColor> | [w] Close</Text>
    </Box>
  );
}
