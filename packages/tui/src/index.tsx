import React from 'react';
import { render } from 'ink';
import { App } from './app.js';

// Enter alternate screen + clear — prevents resize ghost lines
process.stdout.write('\x1b[?1049h\x1b[2J\x1b[H');

const instance = render(<App />, { exitOnCtrlC: true });

// On resize: clear alternate screen so Ink re-paints cleanly
process.stdout.on('resize', () => {
  process.stdout.write('\x1b[2J\x1b[H');
});

instance.waitUntilExit().then(() => {
  // Restore main screen on exit
  process.stdout.write('\x1b[?1049l');
});
