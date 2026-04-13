import React, { useState } from 'react';
import { Box, useInput, useApp } from 'ink';
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
  const [inSearch, setInSearch] = useState(false);

  useInput((input, key) => {
    // Search mode captures all input — only Escape exits
    if (inSearch) {
      if (key.escape) { setInSearch(false); }
      return;
    }

    // Global shortcuts (always available)
    if (input === 'q') { exit(); return; }
    if (input === 'h') {
      setActiveProject(null);
      setGlobalScreen('home');
      return;
    }
    // "/" always opens search — scoped to project if one is open
    if (input === '/') {
      setInSearch(true);
      return;
    }

    // Inside a project context
    if (activeProject) {
      switch (input) {
        case 't': setProjectScreen('tasks'); return;
        case 'i': setProjectScreen('issues'); return;
        case 'n': setProjectScreen('notes'); return;
        case 'w': setActiveProject(null); setGlobalScreen('home'); return;
      }
      return;
    }
  });

  const handleOpenProject = (project: ActiveProject) => {
    setActiveProject(project);
    setProjectScreen('tasks');
  };

  return (
    <Box flexDirection="column" width="100%">
      {/* Main nav — always visible */}
      <MainNav current={globalScreen} inSearch={inSearch} />

      {/* Project sub-nav — only when inside a project and not in search */}
      {activeProject && !inSearch && (
        <ProjectNav
          projectName={activeProject.name}
          projectColor={activeProject.color}
          current={projectScreen}
        />
      )}

      {/* Content area */}
      <Box flexDirection="column" marginTop={1}>
        {inSearch ? (
          // Search — scoped to project if one is open
          <Search projectId={activeProject?.id} />
        ) : activeProject ? (
          // Project context screens
          <>
            {projectScreen === 'tasks' && <Tasks projectId={activeProject.id} />}
            {projectScreen === 'issues' && <Issues projectId={activeProject.id} />}
            {projectScreen === 'notes' && <Notes projectId={activeProject.id} />}
          </>
        ) : (
          // Home
          <>{globalScreen === 'home' && <Home onOpenProject={handleOpenProject} />}</>
        )}
      </Box>
    </Box>
  );
}
