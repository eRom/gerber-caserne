import React, { useState } from 'react';
import { Box, useInput, useApp } from 'ink';
import { Nav, type Screen } from './components/nav.js';
import { Dashboard } from './screens/dashboard.js';
import { Tasks } from './screens/tasks.js';
import { Issues } from './screens/issues.js';
import { Notes } from './screens/notes.js';
import { Messages } from './screens/messages.js';
import { Search } from './screens/search.js';

export function App() {
  const { exit } = useApp();
  const [screen, setScreen] = useState<Screen>('dashboard');

  useInput((input, key) => {
    // Global navigation — only when not in search mode (search captures all input)
    if (screen === 'search') return;

    switch (input) {
      case 'd': setScreen('dashboard'); break;
      case 't': setScreen('tasks'); break;
      case 'i': setScreen('issues'); break;
      case 'n': setScreen('notes'); break;
      case 'm': setScreen('messages'); break;
      case '/': setScreen('search'); break;
      case 'q': exit(); break;
    }

    // Escape from any screen goes to dashboard
    if (key.escape) setScreen('dashboard');
  });

  return (
    <Box flexDirection="column" width="100%">
      <Nav current={screen} />
      <Box flexDirection="column" marginTop={1}>
        {screen === 'dashboard' && <Dashboard />}
        {screen === 'tasks' && <Tasks />}
        {screen === 'issues' && <Issues />}
        {screen === 'notes' && <Notes />}
        {screen === 'messages' && <Messages />}
        {screen === 'search' && <Search />}
      </Box>
    </Box>
  );
}
