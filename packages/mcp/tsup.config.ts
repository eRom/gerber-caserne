import { defineConfig } from 'tsup';
import { cpSync } from 'node:fs';

export default defineConfig({
  onSuccess: async () => {
    cpSync('src/db/migrations', 'dist/migrations', { recursive: true });
  },
  entry: ['src/index.ts', 'src/scripts/restore.ts', 'src/scripts/reindex.ts', 'src/scripts/print-token.ts', 'src/scripts/set-public-url.ts', 'src/scripts/prefetch-model.ts'],
  format: ['esm'],
  // DTS build uses rollup-plugin-dts which can lose the inherited `module`
  // setting from tsconfig.base.json when running inside certain containers
  // (e.g. node:22-bookworm-slim) — symptom: TS1378 "Top-level 'await'
  // expressions are only allowed when 'module' is set to esnext/es2022/...".
  // Force the compiler option explicitly so the DTS pass works everywhere.
  dts: {
    compilerOptions: {
      module: 'esnext',
      moduleResolution: 'bundler',
    },
  },
  shims: true,
  clean: true,
  noExternal: ['@gerber-caserne/shared'],
  banner: ({ entryPoint }) =>
    entryPoint === 'src/index.ts' ? { js: '#!/usr/bin/env node' } : undefined,
});
