import React from 'react';
import { Box, Text } from 'ink';

/** Full-width separator line — overflows and truncates, no width calc needed */
function Sep() {
  return (
    <Box width="100%">
      <Text dimColor wrap="truncate">{'─'.repeat(300)}</Text>
    </Box>
  );
}

interface NavItemProps {
  shortcut: string;
  label: string;
  active?: boolean;
}

/** Render a label with the shortcut letter underlined */
function NavItem({ shortcut, label, active }: NavItemProps) {
  const idx = label.toLowerCase().indexOf(shortcut.toLowerCase());
  const color = active ? 'cyan' : undefined;
  const bold = active;
  const dim = !active;

  if (idx >= 0) {
    const before = label.slice(0, idx);
    const key = label.slice(idx, idx + 1);
    const after = label.slice(idx + 1);
    return (
      <Text {...(dim ? { dimColor: true } : {})} {...(bold ? { bold: true } : {})} {...(color ? { color } : {})}>
        {before}<Text underline>{key}</Text>{after}
      </Text>
    );
  }

  return (
    <Text {...(dim ? { dimColor: true } : {})} {...(bold ? { bold: true } : {})} {...(color ? { color } : {})}>
      <Text underline>{shortcut}</Text> {label}
    </Text>
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
          <Text bold color="#f59e0b">gerber</Text>
          <Text dimColor> |</Text>
        </Box>
        <Box gap={1}>
          <NavItem shortcut="h" label="home" active={current === 'home' && !inSearch} />
          <Text dimColor>|</Text>
          <NavItem shortcut="e" label="search" active={inSearch} />
          <Text dimColor>|</Text>
          <NavItem shortcut="q" label="quit" />
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
          <Text bold color="cyan">{projectName}</Text>
          <Text dimColor> |</Text>
        </Box>
        <Box gap={1}>
          <NavItem shortcut="t" label="tasks" active={current === 'tasks'} />
          <Text dimColor>|</Text>
          <NavItem shortcut="i" label="issues" active={current === 'issues'} />
          <Text dimColor>|</Text>
          <NavItem shortcut="n" label="notes" active={current === 'notes'} />
        </Box>
      </Box>
      <Sep />
    </>
  );
}
