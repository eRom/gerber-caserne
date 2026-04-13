import React, { useState } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { MainNav, ProjectNav, type GlobalScreen, type ProjectScreen } from './components/nav.js';
import { Home, type ActiveProject } from './screens/home.js';
import { Tasks } from './screens/tasks.js';
import { Issues } from './screens/issues.js';
import { Notes } from './screens/notes.js';
import { Search } from './screens/search.js';

export function App() {
  const { exit } = useApp();
  const [globalScreen, setGlobalScreen] = useState<GlobalScreen>('home');
  const [activeProject, setActiveProject] = useState<ActiveProject | null>(null);
  const [projectScreen, setProjectScreen] = useState<ProjectScreen>('tasks');

  useInput((input, key) => {
    // Search screens capture all input — only Escape exits
    const inSearch = activeProject ? projectScreen === 'search' : globalScreen === 'search';
    if (inSearch) {
      if (key.escape) {
        if (activeProject) setProjectScreen('tasks');
        else setGlobalScreen('home');
      }
      return;
    }

    // Note detail view captures input — let it handle escape/b
    // (handled inside the Notes component)

    // Global shortcuts (always available)
    if (input === 'q') { exit(); return; }
    if (input === 'h') {
      setActiveProject(null);
      setGlobalScreen('home');
      return;
    }

    // Inside a project context
    if (activeProject) {
      switch (input) {
        case 't': setProjectScreen('tasks'); return;
        case 'i': setProjectScreen('issues'); return;
        case 'n': setProjectScreen('notes'); return;
        case '/': setProjectScreen('search'); return;
        case 'w': setActiveProject(null); setGlobalScreen('home'); return;
      }
      // Esc is reserved for screens (e.g. note detail → list)
      // Use [w] or [h] to leave project context
      return;
    }

    // Global level (no project)
    if (input === '/') { setGlobalScreen('search'); return; }
  });

  const handleOpenProject = (project: ActiveProject) => {
    setActiveProject(project);
    setProjectScreen('tasks');
  };

  return (
    <Box flexDirection="column" width="100%">
      {/* Main nav — always visible */}
      <MainNav current={globalScreen} hasProject={activeProject !== null} />

      {/* Separator */}
      <Box paddingX={1}>
        <Text dimColor>{'─'.repeat(80)}</Text>
      </Box>

      {/* Project sub-nav — only when inside a project */}
      {activeProject && (
        <>
          <ProjectNav
            projectName={activeProject.name}
            projectColor={activeProject.color}
            current={projectScreen}
          />
          <Box paddingX={1}>
            <Text dimColor>{'─'.repeat(80)}</Text>
          </Box>
        </>
      )}

      {/* Content area */}
      <Box flexDirection="column" marginTop={1}>
        {activeProject ? (
          // Project context screens
          <>
            {projectScreen === 'tasks' && <Tasks projectId={activeProject.id} />}
            {projectScreen === 'issues' && <Issues projectId={activeProject.id} />}
            {projectScreen === 'notes' && <Notes projectId={activeProject.id} />}
            {projectScreen === 'search' && <Search projectId={activeProject.id} />}
          </>
        ) : (
          // Global screens
          <>
            {globalScreen === 'home' && <Home onOpenProject={handleOpenProject} />}
            {globalScreen === 'search' && <Search />}
          </>
        )}
      </Box>
    </Box>
  );
}
