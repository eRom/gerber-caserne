import { defineConfig } from 'tsup';
import { cpSync } from 'node:fs';

export default defineConfig({
  onSuccess: async () => {
    cpSync('src/db/migrations', 'dist/migrations', { recursive: true });
  },
  entry: ['src/index.ts', 'src/scripts/restore.ts', 'src/scripts/reindex.ts'],
  format: ['esm'],
  dts: true,
  shims: true,
  clean: true,
  noExternal: ['@agent-brain/shared'],
  banner: ({ entryPoint }) =>
    entryPoint === 'src/index.ts' ? { js: '#!/usr/bin/env node' } : undefined,
});
