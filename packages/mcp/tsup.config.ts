import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/scripts/restore.ts', 'src/scripts/reindex.ts'],
  format: ['esm'],
  dts: true,
  shims: true,
  clean: true,
  banner: ({ entryPoint }) =>
    entryPoint === 'src/index.ts' ? { js: '#!/usr/bin/env node' } : undefined,
});
