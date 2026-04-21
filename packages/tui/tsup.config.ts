import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.tsx'],
  format: 'esm',
  target: 'node20',
  outDir: 'dist',
  clean: true,
  noExternal: [/^@agent-brain\//],
  banner: { js: '#!/usr/bin/env node' },
});
