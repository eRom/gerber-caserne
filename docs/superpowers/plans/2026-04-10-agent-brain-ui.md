# agent-brain UI Implementation Plan (Plan B)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `@agent-brain/ui` — a React SPA consuming the MCP backend (Plan A) via HTTP JSON-RPC, with dark-first design, ⌘K command palette, chunk-by-chunk document rendering, and Apple Notes import flow.

**Architecture:** Vite SPA in `packages/ui/`, talks to `packages/mcp/` via `POST /mcp` JSON-RPC on `127.0.0.1:4000`. Shared types imported from `@agent-brain/shared`. TanStack Query for server state, React Router 7 for navigation. Express in `packages/mcp/` serves the built UI assets in `--ui` mode.

**Tech Stack:** React 19, Vite 6, Tailwind CSS 4, TanStack Query v5, React Router 7, shadcn/ui, lucide-react, react-markdown, remark-gfm, rehype-highlight, Geist Sans/Mono fonts.

**Spec reference:** `docs/superpowers/specs/2026-04-08-agent-brain-mvp-design.md` § 5.

**Depends on:** Plan A fully merged on `main` (all 12 MCP tools operational via `POST /mcp`).

---

## File structure (Plan B scope)

```
packages/ui/
├── package.json                          @agent-brain/ui
├── tsconfig.json
├── vite.config.ts
├── index.html
├── postcss.config.js                     (Tailwind 4)
├── tailwind.config.ts
├── src/
│   ├── main.tsx                          React root + providers
│   ├── app.tsx                           Router + layout
│   ├── globals.css                       Tailwind directives + dark theme vars
│   ├── lib/
│   │   └── utils.ts                      cn() helper (shadcn convention)
│   ├── api/
│   │   ├── mcp-client.ts                 fetch POST /mcp, typed JSON-RPC wrapper
│   │   ├── tools/
│   │   │   ├── projects.ts               project_create/list/update/delete
│   │   │   ├── notes.ts                  note_create/get/update/delete/list
│   │   │   ├── search.ts                 search tool wrapper
│   │   │   └── maintenance.ts            backup_brain/get_stats wrappers
│   │   └── hooks/
│   │       ├── use-projects.ts           useQuery + useMutation
│   │       ├── use-notes.ts              useQuery + useMutation
│   │       ├── use-search.ts             debounced search hook
│   │       └── use-stats.ts              useQuery for stats
│   ├── components/
│   │   ├── ui/                           shadcn/ui primitives (auto-generated)
│   │   ├── sidebar.tsx                   260px collapsible sidebar
│   │   ├── command-palette.tsx           ⌘K search dialog
│   │   ├── note-card.tsx                 note list item
│   │   ├── note-editor.tsx              textarea + preview tabs
│   │   ├── markdown-view.tsx            react-markdown config
│   │   ├── search-hit.tsx               search result row
│   │   ├── import-zone.tsx              paste + drag-drop import
│   │   ├── empty-state.tsx              generic empty placeholder
│   │   ├── tag-chip.tsx                 clickable tag badge
│   │   ├── kind-badge.tsx              atom/doc badge
│   │   ├── status-badge.tsx            status color badge
│   │   ├── source-badge.tsx            ai/human/import badge
│   │   └── project-badge.tsx           project name + color dot
│   └── pages/
│       ├── dashboard.tsx                activité + top tags + stats
│       ├── project-view.tsx             note list + filters + import
│       ├── note-detail.tsx              chunk-by-chunk read + edit toggle
│       ├── note-new.tsx                 create form
│       ├── search-results.tsx           full search page
│       └── settings.tsx                 stats + backup UI
└── components.json                       shadcn/ui config
```

---

## Conventions

- **No tests in Plan B**: UI is integration-tested via the backend's test suite + manual smoke. Playwright e2e would be Plan C.
- **Commits**: one per task. Prefix: `feat(ui):`, `chore(ui):`.
- **Types**: import `Project`, `Note`, `Chunk`, `SearchHit`, `Stats` from `@agent-brain/shared`.
- **API calls**: all go through `mcpCall(method, params)` — never raw `fetch`.
- **Colors**: oklch zinc/neutral palette, single accent. Dark-first, no light mode.
- **shadcn/ui**: use `bunx shadcn@latest add <component>` to install components.

---

## Task 0: Vite + React scaffold

**Files:**
- Create: `packages/ui/package.json`
- Create: `packages/ui/tsconfig.json`
- Create: `packages/ui/vite.config.ts`
- Create: `packages/ui/index.html`
- Create: `packages/ui/src/main.tsx`
- Create: `packages/ui/src/globals.css`
- Create: `packages/ui/src/lib/utils.ts`

- [ ] **Step 1:** Create `packages/ui/package.json`:

```json
{
  "name": "@agent-brain/ui",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@agent-brain/shared": "workspace:*",
    "@tanstack/react-query": "^5.60.0",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "lucide-react": "^0.460.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-markdown": "^9.0.1",
    "react-router": "^7.0.0",
    "rehype-highlight": "^7.0.1",
    "remark-gfm": "^4.0.0",
    "tailwind-merge": "^2.6.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.4",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.49",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.6.0",
    "vite": "^6.0.0"
  }
}
```

- [ ] **Step 2:** Create `packages/ui/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "rootDir": "./src",
    "outDir": "./dist",
    "noEmit": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"]
}
```

- [ ] **Step 3:** Create `packages/ui/vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/mcp': 'http://127.0.0.1:4000',
      '/health': 'http://127.0.0.1:4000',
    },
  },
  build: {
    outDir: 'dist',
  },
});
```

- [ ] **Step 4:** Create `packages/ui/index.html`:

```html
<!DOCTYPE html>
<html lang="en" class="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>agent-brain</title>
  </head>
  <body class="min-h-screen bg-zinc-950 text-zinc-50 antialiased">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5:** Create `packages/ui/src/lib/utils.ts`:

```ts
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 6:** Create `packages/ui/src/globals.css`:

```css
@import 'tailwindcss';

@theme {
  --color-background: oklch(0.145 0 0);
  --color-foreground: oklch(0.985 0 0);
  --color-card: oklch(0.178 0 0);
  --color-card-foreground: oklch(0.985 0 0);
  --color-muted: oklch(0.269 0 0);
  --color-muted-foreground: oklch(0.708 0 0);
  --color-border: oklch(0.269 0 0);
  --color-accent: oklch(0.65 0.15 250);
  --color-accent-foreground: oklch(0.985 0 0);
  --color-destructive: oklch(0.55 0.2 27);
  --color-ring: oklch(0.65 0.15 250);
  --radius: 0.5rem;
  --font-sans: 'Geist', system-ui, sans-serif;
  --font-mono: 'Geist Mono', ui-monospace, monospace;
}

body {
  font-family: var(--font-sans);
}
```

- [ ] **Step 7:** Create `packages/ui/src/main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './globals.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <div className="flex items-center justify-center min-h-screen">
      <h1 className="text-2xl font-bold text-zinc-50">agent-brain</h1>
    </div>
  </StrictMode>,
);
```

- [ ] **Step 8:** Run `pnpm install` and `pnpm --filter @agent-brain/ui dev` — verify app boots on `http://localhost:5173`.

- [ ] **Step 9:** Commit: `chore(ui): Vite + React 19 scaffold`

---

## Task 1: Tailwind 4 + Geist fonts

**Files:**
- Create: `packages/ui/postcss.config.js`
- Create: `packages/ui/tailwind.config.ts`
- Modify: `packages/ui/index.html` (add font links)

- [ ] **Step 1:** Create `packages/ui/postcss.config.js`:

```js
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
```

Note: Tailwind 4 uses `@tailwindcss/postcss` instead of the legacy `tailwindcss` plugin. Install it: add `"@tailwindcss/postcss": "^4.0.0"` to devDependencies.

- [ ] **Step 2:** Create `packages/ui/tailwind.config.ts`:

```ts
import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Geist', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        accent: 'var(--color-accent)',
        'accent-foreground': 'var(--color-accent-foreground)',
      },
    },
  },
} satisfies Config;
```

- [ ] **Step 3:** Add Geist font CDN links to `index.html` `<head>`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet" />
```

Note: Geist is available on Google Fonts. If not, use `@fontsource/geist-sans` and `@fontsource/geist-mono` npm packages instead.

- [ ] **Step 4:** Verify dark theme: `pnpm --filter @agent-brain/ui dev` — background should be near-black (`zinc-950`), text white.

- [ ] **Step 5:** Commit: `chore(ui): Tailwind 4 dark theme + Geist fonts`

---

## Task 2: shadcn/ui init + base components

**Files:**
- Create: `packages/ui/components.json`
- Create: `packages/ui/src/components/ui/` (multiple auto-generated files)

- [ ] **Step 1:** Create `packages/ui/components.json`:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/globals.css",
    "baseColor": "zinc",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/api/hooks"
  }
}
```

- [ ] **Step 2:** Install the shadcn components needed by the spec:

```bash
cd packages/ui
bunx shadcn@latest add button card input dialog sheet badge scroll-area command tabs textarea separator skeleton tooltip
```

This generates files under `src/components/ui/`. Accept all defaults.

- [ ] **Step 3:** Verify: `ls packages/ui/src/components/ui/` — should have `button.tsx`, `card.tsx`, `input.tsx`, `dialog.tsx`, `sheet.tsx`, `badge.tsx`, `scroll-area.tsx`, `command.tsx`, `tabs.tsx`, `textarea.tsx`, `separator.tsx`, `skeleton.tsx`, `tooltip.tsx`.

- [ ] **Step 4:** Verify build: `pnpm --filter @agent-brain/ui dev` — no errors.

- [ ] **Step 5:** Commit: `chore(ui): shadcn/ui components init`

---

## Task 3: API layer — mcp-client + tool wrappers

**Files:**
- Create: `packages/ui/src/api/mcp-client.ts`
- Create: `packages/ui/src/api/tools/projects.ts`
- Create: `packages/ui/src/api/tools/notes.ts`
- Create: `packages/ui/src/api/tools/search.ts`
- Create: `packages/ui/src/api/tools/maintenance.ts`

- [ ] **Step 1:** Create `packages/ui/src/api/mcp-client.ts`:

```ts
let rpcId = 0;

export class McpError extends Error {
  constructor(
    public code: number,
    message: string,
  ) {
    super(message);
    this.name = 'McpError';
  }
}

export async function mcpCall<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch('/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method, params }),
  });

  if (!res.ok) {
    throw new McpError(-1, `HTTP ${res.status}: ${res.statusText}`);
  }

  const body = await res.json();

  if (body.error) {
    throw new McpError(body.error.code, body.error.message);
  }

  return body.result as T;
}
```

- [ ] **Step 2:** Create `packages/ui/src/api/tools/projects.ts`:

```ts
import { mcpCall } from '../mcp-client.js';
import type { Project } from '@agent-brain/shared';

interface ListResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

interface MutationResponse<T> {
  ok: true;
  id: string;
  item?: T;
}

export function listProjects(params: { limit?: number; offset?: number } = {}) {
  return mcpCall<ListResponse<Project>>('project_list', params);
}

export function createProject(params: { slug: string; name: string; description?: string; color?: string }) {
  return mcpCall<MutationResponse<Project>>('project_create', params);
}

export function updateProject(params: { id: string; slug?: string; name?: string; description?: string; color?: string }) {
  return mcpCall<MutationResponse<Project>>('project_update', params);
}

export function deleteProject(params: { id: string }) {
  return mcpCall<MutationResponse<never> & { reassigned_count: number }>('project_delete', params);
}
```

- [ ] **Step 3:** Create `packages/ui/src/api/tools/notes.ts`:

```ts
import { mcpCall } from '../mcp-client.js';
import type { Note, Chunk } from '@agent-brain/shared';

interface ListResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

interface MutationResponse<T> {
  ok: true;
  id: string;
  item?: T;
}

export type NoteWithChunks = Note & { chunks?: Chunk[] };

export function getNote(params: { id: string }) {
  return mcpCall<{ item: NoteWithChunks }>('note_get', params);
}

export function createNote(params: {
  kind: string;
  title: string;
  content: string;
  tags?: string[];
  source: string;
  projectId?: string;
}) {
  return mcpCall<MutationResponse<Note>>('note_create', params);
}

export function updateNote(params: {
  id: string;
  title?: string;
  content?: string;
  tags?: string[];
  status?: string;
}) {
  return mcpCall<MutationResponse<Note>>('note_update', params);
}

export function deleteNote(params: { id: string }) {
  return mcpCall<MutationResponse<never>>('note_delete', params);
}

export function listNotes(params: {
  projectId?: string;
  kind?: string;
  status?: string;
  source?: string;
  tags_any?: string[];
  tags_all?: string[];
  sort?: string;
  limit?: number;
  offset?: number;
} = {}) {
  return mcpCall<ListResponse<Note>>('note_list', params);
}
```

- [ ] **Step 4:** Create `packages/ui/src/api/tools/search.ts`:

```ts
import { mcpCall } from '../mcp-client.js';
import type { SearchHit } from '@agent-brain/shared';

interface SearchResponse {
  hits: SearchHit[];
  total: number;
  mode: string;
}

export function search(params: {
  query: string;
  mode?: string;
  limit?: number;
  projectId?: string;
  kind?: string;
  status?: string;
  tags_any?: string[];
  tags_all?: string[];
  neighbors?: number;
}) {
  return mcpCall<SearchResponse>('search', params);
}
```

- [ ] **Step 5:** Create `packages/ui/src/api/tools/maintenance.ts`:

```ts
import { mcpCall } from '../mcp-client.js';
import type { Stats } from '@agent-brain/shared';

export function getStats(params: { projectId?: string } = {}) {
  return mcpCall<Stats>('get_stats', params);
}

export function backupBrain(params: { label?: string } = {}) {
  return mcpCall<{ ok: true; id: string; path: string; sizeBytes: number }>('backup_brain', params);
}
```

- [ ] **Step 6:** Typecheck: `pnpm --filter @agent-brain/ui typecheck` — passes.

- [ ] **Step 7:** Commit: `feat(ui): API layer — mcp-client + typed tool wrappers`

---

## Task 4: TanStack Query hooks

**Files:**
- Create: `packages/ui/src/api/hooks/use-projects.ts`
- Create: `packages/ui/src/api/hooks/use-notes.ts`
- Create: `packages/ui/src/api/hooks/use-search.ts`
- Create: `packages/ui/src/api/hooks/use-stats.ts`

- [ ] **Step 1:** Create `packages/ui/src/api/hooks/use-projects.ts`:

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listProjects, createProject, updateProject, deleteProject } from '../tools/projects.js';

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: () => listProjects({ limit: 200 }),
    refetchOnWindowFocus: true,
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createProject,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateProject,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteProject,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  });
}
```

- [ ] **Step 2:** Create `packages/ui/src/api/hooks/use-notes.ts`:

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getNote, listNotes, createNote, updateNote, deleteNote } from '../tools/notes.js';

export function useNotes(params: Parameters<typeof listNotes>[0] = {}) {
  return useQuery({
    queryKey: ['notes', params],
    queryFn: () => listNotes(params),
    refetchOnWindowFocus: true,
  });
}

export function useNote(id: string | undefined) {
  return useQuery({
    queryKey: ['notes', 'detail', id],
    queryFn: () => getNote({ id: id! }),
    enabled: !!id,
  });
}

export function useCreateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createNote,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notes'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}

export function useUpdateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateNote,
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['notes'] });
      qc.invalidateQueries({ queryKey: ['notes', 'detail', vars.id] });
      qc.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}

export function useDeleteNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteNote,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notes'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}
```

- [ ] **Step 3:** Create `packages/ui/src/api/hooks/use-search.ts`:

```ts
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { search } from '../tools/search.js';

export function useSearch(
  query: string,
  options: { mode?: string; limit?: number; projectId?: string; enabled?: boolean } = {},
) {
  const { mode = 'hybrid', limit = 20, projectId, enabled = true } = options;
  return useQuery({
    queryKey: ['search', query, mode, limit, projectId],
    queryFn: () => search({ query, mode, limit, projectId }),
    enabled: enabled && query.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}
```

- [ ] **Step 4:** Create `packages/ui/src/api/hooks/use-stats.ts`:

```ts
import { useQuery } from '@tanstack/react-query';
import { getStats } from '../tools/maintenance.js';

export function useStats(projectId?: string) {
  return useQuery({
    queryKey: ['stats', projectId],
    queryFn: () => getStats({ projectId }),
    refetchOnWindowFocus: true,
    staleTime: 60_000,
  });
}
```

- [ ] **Step 5:** Typecheck passes.

- [ ] **Step 6:** Commit: `feat(ui): TanStack Query hooks for projects, notes, search, stats`

---

## Task 5: Router + layout shell + Sidebar

**Files:**
- Create: `packages/ui/src/app.tsx`
- Create: `packages/ui/src/components/sidebar.tsx`
- Modify: `packages/ui/src/main.tsx`
- Create: `packages/ui/src/pages/dashboard.tsx` (placeholder)

- [ ] **Step 1:** Create `packages/ui/src/app.tsx`:

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { Sidebar } from '@/components/sidebar';
import { Dashboard } from '@/pages/dashboard';

export function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
```

- [ ] **Step 2:** Create `packages/ui/src/components/sidebar.tsx`:

```tsx
import { Link, useLocation } from 'react-router';
import { Brain, Search, Settings, FolderOpen, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useProjects } from '@/api/hooks/use-projects';
import { useNotes } from '@/api/hooks/use-notes';
import { cn } from '@/lib/utils';
import { GLOBAL_PROJECT_ID } from '@agent-brain/shared';

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { data: projectsData } = useProjects();
  const { data: recentData } = useNotes({ limit: 5, sort: 'updated_desc' });

  const projects = projectsData?.items ?? [];
  const recentNotes = recentData?.items ?? [];

  return (
    <aside
      className={cn(
        'flex flex-col border-r border-border bg-zinc-950 transition-all duration-200',
        collapsed ? 'w-14' : 'w-[260px]',
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-4">
        {!collapsed && (
          <Link to="/dashboard" className="flex items-center gap-2 text-sm font-semibold">
            <Brain className="h-5 w-5 text-accent" />
            agent-brain
          </Link>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {!collapsed && (
        <>
          {/* Search trigger */}
          <div className="px-3 pb-2">
            <Button
              variant="outline"
              className="w-full justify-start gap-2 text-muted-foreground"
              onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
            >
              <Search className="h-4 w-4" />
              Search...
              <kbd className="ml-auto text-xs text-muted-foreground">⌘K</kbd>
            </Button>
          </div>

          <Separator />

          <ScrollArea className="flex-1 px-3 py-2">
            {/* Projects */}
            <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">Projects</p>
            <nav className="space-y-0.5">
              {projects
                .filter((p) => p.id !== GLOBAL_PROJECT_ID)
                .map((p) => (
                  <Link
                    key={p.id}
                    to={`/projects/${p.slug}`}
                    className={cn(
                      'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted',
                      location.pathname.startsWith(`/projects/${p.slug}`) && 'bg-muted',
                    )}
                  >
                    {p.color && (
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: p.color }}
                      />
                    )}
                    <FolderOpen className="h-4 w-4 text-muted-foreground" />
                    {p.name}
                  </Link>
                ))}
              {/* Global project */}
              <Link
                to="/projects/global"
                className={cn(
                  'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted',
                  location.pathname.startsWith('/projects/global') && 'bg-muted',
                )}
              >
                <FolderOpen className="h-4 w-4 text-muted-foreground" />
                Global
              </Link>
            </nav>

            <Separator className="my-3" />

            {/* Recent activity */}
            <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">Recent</p>
            <nav className="space-y-0.5">
              {recentNotes.map((n) => (
                <Link
                  key={n.id}
                  to={`/projects/global/notes/${n.id}`}
                  className="block truncate rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  {n.title}
                </Link>
              ))}
            </nav>
          </ScrollArea>

          <Separator />

          {/* Footer */}
          <div className="px-3 py-2">
            <Link
              to="/settings"
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted"
            >
              <Settings className="h-4 w-4" />
              Settings
            </Link>
          </div>
        </>
      )}
    </aside>
  );
}
```

- [ ] **Step 3:** Create placeholder `packages/ui/src/pages/dashboard.tsx`:

```tsx
export function Dashboard() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="mt-2 text-muted-foreground">Coming up...</p>
    </div>
  );
}
```

- [ ] **Step 4:** Update `packages/ui/src/main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './app';
import './globals.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
```

- [ ] **Step 5:** Verify: `pnpm --filter @agent-brain/ui dev` — sidebar renders with collapsed toggle, projects section (empty until backend runs), recent notes section.

- [ ] **Step 6:** Commit: `feat(ui): router + layout shell + sidebar`

---

## Task 6: Badge components

**Files:**
- Create: `packages/ui/src/components/kind-badge.tsx`
- Create: `packages/ui/src/components/status-badge.tsx`
- Create: `packages/ui/src/components/source-badge.tsx`
- Create: `packages/ui/src/components/project-badge.tsx`
- Create: `packages/ui/src/components/tag-chip.tsx`

- [ ] **Step 1:** Create `packages/ui/src/components/kind-badge.tsx`:

```tsx
import { Badge } from '@/components/ui/badge';
import { FileText, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

const config = {
  atom: { label: 'Atom', icon: FileText, className: 'bg-blue-500/15 text-blue-400 border-blue-500/25' },
  document: { label: 'Doc', icon: BookOpen, className: 'bg-purple-500/15 text-purple-400 border-purple-500/25' },
} as const;

export function KindBadge({ kind }: { kind: string }) {
  const c = config[kind as keyof typeof config] ?? config.atom;
  const Icon = c.icon;
  return (
    <Badge variant="outline" className={cn('gap-1 text-xs', c.className)}>
      <Icon className="h-3 w-3" />
      {c.label}
    </Badge>
  );
}
```

- [ ] **Step 2:** Create `packages/ui/src/components/status-badge.tsx`:

```tsx
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const config: Record<string, string> = {
  active: 'bg-green-500/15 text-green-400 border-green-500/25',
  draft: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25',
  archived: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/25',
  deprecated: 'bg-red-500/15 text-red-400 border-red-500/25',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={cn('text-xs', config[status])}>
      {status}
    </Badge>
  );
}
```

- [ ] **Step 3:** Create `packages/ui/src/components/source-badge.tsx`:

```tsx
import { Badge } from '@/components/ui/badge';
import { Bot, User, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

const config = {
  ai: { label: 'AI', icon: Bot, className: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/25' },
  human: { label: 'Human', icon: User, className: 'bg-amber-500/15 text-amber-400 border-amber-500/25' },
  import: { label: 'Import', icon: Download, className: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/25' },
} as const;

export function SourceBadge({ source }: { source: string }) {
  const c = config[source as keyof typeof config] ?? config.ai;
  const Icon = c.icon;
  return (
    <Badge variant="outline" className={cn('gap-1 text-xs', c.className)}>
      <Icon className="h-3 w-3" />
      {c.label}
    </Badge>
  );
}
```

- [ ] **Step 4:** Create `packages/ui/src/components/project-badge.tsx`:

```tsx
export function ProjectBadge({ name, color }: { name: string; color?: string | null }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      {color && (
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      )}
      {name}
    </span>
  );
}
```

- [ ] **Step 5:** Create `packages/ui/src/components/tag-chip.tsx`:

```tsx
import { Badge } from '@/components/ui/badge';
import { useSearchParams } from 'react-router';

export function TagChip({ tag }: { tag: string }) {
  const [searchParams, setSearchParams] = useSearchParams();

  const handleClick = () => {
    const params = new URLSearchParams(searchParams);
    params.set('q', tag);
    params.set('mode', 'fulltext');
    setSearchParams(params);
  };

  return (
    <Badge
      variant="secondary"
      className="cursor-pointer text-xs hover:bg-muted"
      onClick={handleClick}
    >
      {tag}
    </Badge>
  );
}
```

- [ ] **Step 6:** Commit: `feat(ui): badge components (kind, status, source, project, tag)`

---

## Task 7: MarkdownView + EmptyState

**Files:**
- Create: `packages/ui/src/components/markdown-view.tsx`
- Create: `packages/ui/src/components/empty-state.tsx`

- [ ] **Step 1:** Create `packages/ui/src/components/markdown-view.tsx`:

```tsx
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

export function MarkdownView({ source }: { source: string }) {
  return (
    <article className="prose prose-invert prose-zinc max-w-none prose-headings:text-zinc-100 prose-p:text-zinc-300 prose-a:text-accent prose-code:text-zinc-200 prose-pre:bg-zinc-900 prose-pre:border prose-pre:border-border">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
        {source}
      </ReactMarkdown>
    </article>
  );
}
```

Note: Install `@tailwindcss/typography` for `prose` classes: add to devDependencies and import in `tailwind.config.ts`.

- [ ] **Step 2:** Create `packages/ui/src/components/empty-state.tsx`:

```tsx
import type { LucideIcon } from 'lucide-react';

export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Icon className="h-12 w-12 text-muted-foreground/50" />
      <h3 className="mt-4 text-lg font-medium">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
```

- [ ] **Step 3:** Commit: `feat(ui): MarkdownView + EmptyState components`

---

## Task 8: NoteCard + SearchHit components

**Files:**
- Create: `packages/ui/src/components/note-card.tsx`
- Create: `packages/ui/src/components/search-hit.tsx`

- [ ] **Step 1:** Create `packages/ui/src/components/note-card.tsx`:

```tsx
import { Link } from 'react-router';
import type { Note } from '@agent-brain/shared';
import { KindBadge } from './kind-badge';
import { StatusBadge } from './status-badge';
import { SourceBadge } from './source-badge';
import { TagChip } from './tag-chip';

export function NoteCard({ note, projectSlug }: { note: Note; projectSlug: string }) {
  const timeAgo = formatRelative(note.updatedAt);

  return (
    <Link
      to={`/projects/${projectSlug}/notes/${note.id}`}
      className="block rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/50"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-medium leading-tight">{note.title}</h3>
        <span className="shrink-0 text-xs text-muted-foreground">{timeAgo}</span>
      </div>
      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
        {note.content.slice(0, 200)}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <KindBadge kind={note.kind} />
        <StatusBadge status={note.status} />
        <SourceBadge source={note.source} />
        {note.tags.map((t) => (
          <TagChip key={t} tag={t} />
        ))}
      </div>
    </Link>
  );
}

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
```

- [ ] **Step 2:** Create `packages/ui/src/components/search-hit.tsx`:

```tsx
import { Link } from 'react-router';
import type { SearchHit } from '@agent-brain/shared';
import { FileText, BookOpen, Puzzle } from 'lucide-react';
import { cn } from '@/lib/utils';

const iconMap = {
  atom: FileText,
  document: BookOpen,
  chunk: Puzzle,
} as const;

export function SearchHitCard({
  hit,
  projectSlug,
}: {
  hit: SearchHit;
  projectSlug?: string;
}) {
  const isChunk = hit.ownerType === 'chunk';
  const kind = isChunk ? 'chunk' : hit.parent.kind;
  const Icon = iconMap[kind as keyof typeof iconMap] ?? FileText;
  const slug = projectSlug ?? 'global';

  const href = isChunk
    ? `/projects/${slug}/notes/${hit.parent.noteId}#chunk-${hit.ownerId}`
    : `/projects/${slug}/notes/${hit.ownerId}`;

  return (
    <Link
      to={href}
      className="flex items-start gap-3 rounded-md px-3 py-2 hover:bg-muted"
    >
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', isChunk ? 'text-amber-400' : 'text-muted-foreground')} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{hit.parent.title}</p>
        {isChunk && hit.chunk && (
          <p className="truncate text-xs text-muted-foreground">{hit.chunk.headingPath}</p>
        )}
        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{hit.snippet}</p>
      </div>
      <span className="shrink-0 text-xs text-muted-foreground">
        {(hit.score * 100).toFixed(0)}%
      </span>
    </Link>
  );
}
```

- [ ] **Step 3:** Commit: `feat(ui): NoteCard + SearchHit components`

---

## Task 9: Dashboard page

**Files:**
- Modify: `packages/ui/src/pages/dashboard.tsx`

- [ ] **Step 1:** Replace placeholder `dashboard.tsx`:

```tsx
import { useStats } from '@/api/hooks/use-stats';
import { useNotes } from '@/api/hooks/use-notes';
import { Card } from '@/components/ui/card';
import { NoteCard } from '@/components/note-card';
import { TagChip } from '@/components/tag-chip';
import { EmptyState } from '@/components/empty-state';
import { Brain, FileText, Layers, Database } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useStats();
  const { data: recent, isLoading: notesLoading } = useNotes({ limit: 5 });

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Stats cards */}
      <div className="mt-6 grid grid-cols-4 gap-4">
        <StatCard icon={FileText} label="Notes" value={stats?.notes.total} loading={statsLoading} />
        <StatCard icon={Layers} label="Chunks" value={stats?.chunks.total} loading={statsLoading} />
        <StatCard icon={Brain} label="Embeddings" value={stats?.embeddings.total} loading={statsLoading} />
        <StatCard icon={Database} label="DB Size" value={stats ? formatBytes(stats.dbSizeBytes) : undefined} loading={statsLoading} />
      </div>

      {/* Top tags */}
      {stats && stats.topTags.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-medium text-muted-foreground">Top Tags</h2>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {stats.topTags.slice(0, 15).map((t) => (
              <TagChip key={t.tag} tag={t.tag} />
            ))}
          </div>
        </div>
      )}

      {/* Recent notes */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold">Recent Activity</h2>
        {notesLoading ? (
          <div className="mt-4 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        ) : recent && recent.items.length > 0 ? (
          <div className="mt-4 space-y-3">
            {recent.items.map((n) => (
              <NoteCard key={n.id} note={n} projectSlug="global" />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={FileText}
            title="No notes yet"
            description="Create your first note or import from Apple Notes"
          />
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  loading,
}: {
  icon: typeof FileText;
  label: string;
  value?: number | string;
  loading: boolean;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-xs">{label}</span>
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-7 w-16" />
      ) : (
        <p className="mt-2 text-xl font-bold">{value ?? 0}</p>
      )}
    </Card>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
```

- [ ] **Step 2:** Commit: `feat(ui): dashboard page with stats, tags, and recent activity`

---

## Task 10: ProjectView page

**Files:**
- Create: `packages/ui/src/pages/project-view.tsx`
- Modify: `packages/ui/src/app.tsx` (add route)

- [ ] **Step 1:** Create `packages/ui/src/pages/project-view.tsx`:

```tsx
import { useParams, useSearchParams, Link } from 'react-router';
import { useNotes } from '@/api/hooks/use-notes';
import { useProjects } from '@/api/hooks/use-projects';
import { NoteCard } from '@/components/note-card';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, FileText } from 'lucide-react';
import { GLOBAL_PROJECT_ID } from '@agent-brain/shared';

export function ProjectView() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: projectsData } = useProjects();

  const project = projectsData?.items.find((p) => p.slug === slug);
  const projectId = project?.id ?? (slug === 'global' ? GLOBAL_PROJECT_ID : undefined);

  const kindFilter = searchParams.get('kind') ?? undefined;
  const statusFilter = searchParams.get('status') ?? 'active';

  const { data, isLoading } = useNotes({
    projectId,
    kind: kindFilter,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    limit: 50,
  });

  const setFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value === 'all' || !value) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    setSearchParams(params);
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{project?.name ?? slug}</h1>
          {project?.description && (
            <p className="mt-1 text-sm text-muted-foreground">{project.description}</p>
          )}
        </div>
        <Link to={`/projects/${slug}/notes/new`}>
          <Button className="gap-1.5">
            <Plus className="h-4 w-4" />
            New Note
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="mt-4 flex items-center gap-4">
        <Tabs value={kindFilter ?? 'all'} onValueChange={(v) => setFilter('kind', v)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="atom">Atoms</TabsTrigger>
            <TabsTrigger value="document">Docs</TabsTrigger>
          </TabsList>
        </Tabs>
        <Tabs value={statusFilter} onValueChange={(v) => setFilter('status', v)}>
          <TabsList>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="draft">Draft</TabsTrigger>
            <TabsTrigger value="archived">Archived</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Note list */}
      <div className="mt-6 space-y-3">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))
        ) : data && data.items.length > 0 ? (
          data.items.map((n) => (
            <NoteCard key={n.id} note={n} projectSlug={slug!} />
          ))
        ) : (
          <EmptyState
            icon={FileText}
            title="No notes"
            description="Create a note or import from Apple Notes"
          >
            <Link to={`/projects/${slug}/notes/new`}>
              <Button variant="outline" className="gap-1.5">
                <Plus className="h-4 w-4" />
                New Note
              </Button>
            </Link>
          </EmptyState>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2:** Add route in `app.tsx`:

```tsx
import { ProjectView } from '@/pages/project-view';

// Inside Routes:
<Route path="/projects/:slug" element={<ProjectView />} />
```

- [ ] **Step 3:** Commit: `feat(ui): ProjectView page with kind/status filters`

---

## Task 11: NoteDetail page (chunk-by-chunk + edit toggle)

**Files:**
- Create: `packages/ui/src/pages/note-detail.tsx`
- Modify: `packages/ui/src/app.tsx` (add route)

- [ ] **Step 1:** Create `packages/ui/src/pages/note-detail.tsx`:

```tsx
import { useParams, useNavigate } from 'react-router';
import { useState, useEffect } from 'react';
import { useNote, useUpdateNote, useDeleteNote } from '@/api/hooks/use-notes';
import { MarkdownView } from '@/components/markdown-view';
import { KindBadge } from '@/components/kind-badge';
import { StatusBadge } from '@/components/status-badge';
import { SourceBadge } from '@/components/source-badge';
import { TagChip } from '@/components/tag-chip';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Pencil, X, Save, Trash2, ArrowLeft } from 'lucide-react';
import type { Chunk } from '@agent-brain/shared';

export function NoteDetail() {
  const { slug, id } = useParams<{ slug: string; id: string }>();
  const navigate = useNavigate();
  const { data, isLoading } = useNote(id);
  const updateMutation = useUpdateNote();
  const deleteMutation = useDeleteNote();

  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');

  const note = data?.item;

  useEffect(() => {
    if (note) setEditContent(note.content);
  }, [note]);

  // Scroll to chunk anchor on mount
  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      setTimeout(() => {
        document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [note]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-4 h-96 w-full" />
      </div>
    );
  }

  if (!note) return null;

  const handleSave = async () => {
    await updateMutation.mutateAsync({ id: note.id, content: editContent });
    setEditing(false);
  };

  const handleDelete = async () => {
    if (!confirm('Delete this note?')) return;
    await deleteMutation.mutateAsync({ id: note.id });
    navigate(`/projects/${slug}`);
  };

  return (
    <div className="mx-auto max-w-3xl p-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/projects/${slug}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">{note.title}</h1>
      </div>

      {/* Meta */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <KindBadge kind={note.kind} />
        <StatusBadge status={note.status} />
        <SourceBadge source={note.source} />
        {note.tags.map((t) => (
          <TagChip key={t} tag={t} />
        ))}
      </div>

      {/* Actions */}
      <div className="mt-4 flex items-center gap-2">
        {editing ? (
          <>
            <Button size="sm" className="gap-1" onClick={handleSave} disabled={updateMutation.isPending}>
              <Save className="h-3.5 w-3.5" />
              {updateMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              <X className="h-3.5 w-3.5" />
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" variant="outline" className="gap-1" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
            <Button size="sm" variant="ghost" className="text-destructive gap-1" onClick={handleDelete}>
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
          </>
        )}
      </div>

      {/* Content */}
      <div className="mt-6">
        {editing ? (
          <Textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="min-h-[400px] font-mono text-sm"
            onKeyDown={(e) => {
              if (e.key === 's' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSave();
              }
            }}
          />
        ) : note.kind === 'document' && note.chunks ? (
          <DocumentView chunks={note.chunks} />
        ) : (
          <MarkdownView source={note.content} />
        )}
      </div>
    </div>
  );
}

function DocumentView({ chunks }: { chunks: Chunk[] }) {
  const sorted = [...chunks].sort((a, b) => a.position - b.position);
  return (
    <article>
      {sorted.map((chunk) => (
        <section key={chunk.id} id={`chunk-${chunk.id}`} data-heading={chunk.headingPath}>
          <MarkdownView source={chunk.content} />
        </section>
      ))}
    </article>
  );
}
```

- [ ] **Step 2:** Add route in `app.tsx`:

```tsx
import { NoteDetail } from '@/pages/note-detail';

// Inside Routes:
<Route path="/projects/:slug/notes/:id" element={<NoteDetail />} />
```

- [ ] **Step 3:** Commit: `feat(ui): NoteDetail page with chunk-by-chunk rendering + inline editing`

---

## Task 12: NoteEditor page (create)

**Files:**
- Create: `packages/ui/src/pages/note-new.tsx`
- Modify: `packages/ui/src/app.tsx` (add route)

- [ ] **Step 1:** Create `packages/ui/src/pages/note-new.tsx`:

```tsx
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useCreateNote } from '@/api/hooks/use-notes';
import { useProjects } from '@/api/hooks/use-projects';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { MarkdownView } from '@/components/markdown-view';
import { GLOBAL_PROJECT_ID } from '@agent-brain/shared';

export function NoteNew() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const createMutation = useCreateNote();
  const { data: projectsData } = useProjects();

  const project = projectsData?.items.find((p) => p.slug === slug);
  const projectId = project?.id ?? GLOBAL_PROJECT_ID;

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [kind, setKind] = useState<'atom' | 'document'>('atom');
  const [tagsInput, setTagsInput] = useState('');
  const [tab, setTab] = useState('write');

  const handleSubmit = async () => {
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const result = await createMutation.mutateAsync({
      kind,
      title,
      content,
      tags,
      source: 'human',
      projectId,
    });
    navigate(`/projects/${slug}/notes/${result.id}`);
  };

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-bold">New Note</h1>

      <div className="mt-6 space-y-4">
        <Input
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <div className="flex items-center gap-4">
          <Tabs value={kind} onValueChange={(v) => setKind(v as 'atom' | 'document')}>
            <TabsList>
              <TabsTrigger value="atom">Atom</TabsTrigger>
              <TabsTrigger value="document">Document</TabsTrigger>
            </TabsList>
          </Tabs>

          <Input
            placeholder="Tags (comma-separated)"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            className="flex-1"
          />
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="write">Write</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>
          <TabsContent value="write">
            <Textarea
              placeholder="Content (Markdown)"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[400px] font-mono text-sm"
            />
          </TabsContent>
          <TabsContent value="preview">
            <div className="min-h-[400px] rounded-md border border-border p-4">
              <MarkdownView source={content || '*Nothing to preview*'} />
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => navigate(`/projects/${slug}`)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!title || !content || createMutation.isPending}
          >
            {createMutation.isPending ? 'Creating...' : 'Create'}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2:** Add route in `app.tsx`:

```tsx
import { NoteNew } from '@/pages/note-new';

// Inside Routes — BEFORE the :id route to avoid conflict:
<Route path="/projects/:slug/notes/new" element={<NoteNew />} />
<Route path="/projects/:slug/notes/:id" element={<NoteDetail />} />
```

- [ ] **Step 3:** Commit: `feat(ui): NoteEditor page with write/preview tabs`

---

## Task 13: Command palette (⌘K)

**Files:**
- Create: `packages/ui/src/components/command-palette.tsx`
- Modify: `packages/ui/src/app.tsx` (mount palette)

- [ ] **Step 1:** Create `packages/ui/src/components/command-palette.tsx`:

```tsx
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import { useSearch } from '@/api/hooks/use-search';
import { useProjects } from '@/api/hooks/use-projects';
import { FileText, BookOpen, Puzzle, Plus, BarChart3, FolderOpen } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const iconMap = { atom: FileText, document: BookOpen, chunk: Puzzle } as const;

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState('hybrid');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const navigate = useNavigate();
  const { data: projectsData } = useProjects();
  const { data: searchData, isFetching } = useSearch(debouncedQuery, { mode, limit: 8, enabled: open });

  // Debounce
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(timer);
  }, [query]);

  // ⌘K handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const go = useCallback(
    (path: string) => {
      setOpen(false);
      setQuery('');
      navigate(path);
    },
    [navigate],
  );

  const projects = projectsData?.items ?? [];
  const hits = searchData?.hits ?? [];

  const resolveSlug = (projectId: string) => {
    const p = projects.find((p) => p.id === projectId);
    return p?.slug ?? 'global';
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search notes..."
        value={query}
        onValueChange={setQuery}
      />

      {/* Mode tabs */}
      <div className="border-b border-border px-3 py-1.5">
        <Tabs value={mode} onValueChange={setMode}>
          <TabsList className="h-7">
            <TabsTrigger value="hybrid" className="text-xs">Hybrid</TabsTrigger>
            <TabsTrigger value="semantic" className="text-xs">Semantic</TabsTrigger>
            <TabsTrigger value="fulltext" className="text-xs">Fulltext</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <CommandList>
        <CommandEmpty>{isFetching ? 'Searching...' : 'No results'}</CommandEmpty>

        {/* Search results */}
        {hits.length > 0 && (
          <CommandGroup heading="Results">
            {hits.map((hit) => {
              const isChunk = hit.ownerType === 'chunk';
              const kind = isChunk ? 'chunk' : hit.parent.kind;
              const Icon = iconMap[kind as keyof typeof iconMap] ?? FileText;
              const slug = resolveSlug(hit.parent.projectId);
              const href = isChunk
                ? `/projects/${slug}/notes/${hit.parent.noteId}#chunk-${hit.ownerId}`
                : `/projects/${slug}/notes/${hit.ownerId}`;

              return (
                <CommandItem key={hit.ownerId} onSelect={() => go(href)}>
                  <Icon className="mr-2 h-4 w-4" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{hit.parent.title}</p>
                    {isChunk && hit.chunk && (
                      <p className="truncate text-xs text-muted-foreground">
                        {hit.chunk.headingPath}
                      </p>
                    )}
                  </div>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {/* Actions */}
        {!query && (
          <>
            <CommandGroup heading="Actions">
              <CommandItem onSelect={() => go('/projects/global/notes/new')}>
                <Plus className="mr-2 h-4 w-4" />
                New Note
              </CommandItem>
              <CommandItem onSelect={() => go('/settings')}>
                <BarChart3 className="mr-2 h-4 w-4" />
                Stats
              </CommandItem>
            </CommandGroup>

            <CommandGroup heading="Projects">
              {projects.map((p) => (
                <CommandItem key={p.id} onSelect={() => go(`/projects/${p.slug}`)}>
                  <FolderOpen className="mr-2 h-4 w-4" />
                  {p.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
```

- [ ] **Step 2:** Mount in `app.tsx` — add `<CommandPalette />` inside the `<BrowserRouter>` but outside `<Routes>`:

```tsx
import { CommandPalette } from '@/components/command-palette';

// Inside BrowserRouter, after <div className="flex ...">:
<CommandPalette />
```

- [ ] **Step 3:** Commit: `feat(ui): ⌘K command palette with hybrid/semantic/fulltext modes`

---

## Task 14: SearchResults page

**Files:**
- Create: `packages/ui/src/pages/search-results.tsx`
- Modify: `packages/ui/src/app.tsx` (add route)

- [ ] **Step 1:** Create `packages/ui/src/pages/search-results.tsx`:

```tsx
import { useSearchParams } from 'react-router';
import { useSearch } from '@/api/hooks/use-search';
import { useProjects } from '@/api/hooks/use-projects';
import { SearchHitCard } from '@/components/search-hit';
import { EmptyState } from '@/components/empty-state';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { useState, useEffect } from 'react';

export function SearchResults() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryParam = searchParams.get('q') ?? '';
  const modeParam = searchParams.get('mode') ?? 'hybrid';
  const [localQuery, setLocalQuery] = useState(queryParam);

  const { data, isLoading } = useSearch(queryParam, { mode: modeParam, limit: 30 });
  const { data: projectsData } = useProjects();

  useEffect(() => {
    setLocalQuery(queryParam);
  }, [queryParam]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams);
    params.set('q', localQuery);
    setSearchParams(params);
  };

  const setMode = (mode: string) => {
    const params = new URLSearchParams(searchParams);
    params.set('mode', mode);
    setSearchParams(params);
  };

  const resolveSlug = (projectId: string) => {
    const p = projectsData?.items.find((p) => p.id === projectId);
    return p?.slug ?? 'global';
  };

  return (
    <div className="mx-auto max-w-3xl p-6">
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            value={localQuery}
            onChange={(e) => setLocalQuery(e.target.value)}
            placeholder="Search..."
            className="pl-9"
          />
        </div>
      </form>

      <div className="mt-4">
        <Tabs value={modeParam} onValueChange={setMode}>
          <TabsList>
            <TabsTrigger value="hybrid">Hybrid</TabsTrigger>
            <TabsTrigger value="semantic">Semantic</TabsTrigger>
            <TabsTrigger value="fulltext">Fulltext</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="mt-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Searching...</p>
        ) : data && data.hits.length > 0 ? (
          <div className="space-y-1">
            <p className="mb-3 text-sm text-muted-foreground">
              {data.total} result{data.total !== 1 ? 's' : ''} ({data.mode})
            </p>
            {data.hits.map((hit) => (
              <SearchHitCard
                key={hit.ownerId}
                hit={hit}
                projectSlug={resolveSlug(hit.parent.projectId)}
              />
            ))}
          </div>
        ) : queryParam ? (
          <EmptyState icon={Search} title="No results" description={`Nothing found for "${queryParam}"`} />
        ) : null}
      </div>
    </div>
  );
}
```

- [ ] **Step 2:** Add route: `<Route path="/search" element={<SearchResults />} />`

- [ ] **Step 3:** Commit: `feat(ui): SearchResults page with mode tabs`

---

## Task 15: ImportZone component

**Files:**
- Create: `packages/ui/src/components/import-zone.tsx`
- Modify: `packages/ui/src/pages/project-view.tsx` (add import tab)

- [ ] **Step 1:** Create `packages/ui/src/components/import-zone.tsx`:

```tsx
import { useState, useCallback, useRef } from 'react';
import { useCreateNote } from '@/api/hooks/use-notes';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, FileText, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImportZoneProps {
  projectId: string;
}

export function ImportZone({ projectId }: ImportZoneProps) {
  const createMutation = useCreateNote();

  // Paste mode state
  const [pasteContent, setPasteContent] = useState('');
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<'atom' | 'document'>('atom');
  const [tagsInput, setTagsInput] = useState('');
  const [importing, setImporting] = useState(false);

  // Drop mode state
  const [dragOver, setDragOver] = useState(false);
  const [fileResults, setFileResults] = useState<{ name: string; status: 'ok' | 'error'; error?: string }[]>([]);
  const [processing, setProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Apple Notes heuristic: first line short + blank line → title = first line
  const handlePasteChange = (text: string) => {
    setPasteContent(text);
    const lines = text.split('\n');
    if (lines.length >= 2 && lines[0]!.length < 100 && lines[1]!.trim() === '') {
      setTitle(lines[0]!.trim());
    }
  };

  const handlePasteImport = async () => {
    if (!title || !pasteContent) return;
    setImporting(true);
    const tags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean);
    const content = pasteContent.startsWith(title)
      ? pasteContent.slice(title.length).replace(/^\n+/, '')
      : pasteContent;
    await createMutation.mutateAsync({
      kind,
      title,
      content,
      tags,
      source: 'import',
      projectId,
    });
    setPasteContent('');
    setTitle('');
    setTagsInput('');
    setImporting(false);
  };

  // File drop handler
  const handleFiles = useCallback(
    async (files: File[]) => {
      if (files.length > 10) {
        alert('Max 10 files at once. Use the paste zone for large dumps.');
        return;
      }
      setProcessing(true);
      setFileResults([]);
      const results: typeof fileResults = [];

      for (const file of files) {
        try {
          const text = await file.text();
          const name = file.name.replace(/\.md$/, '');
          await createMutation.mutateAsync({
            kind: 'document',
            title: name,
            content: text,
            tags: [],
            source: 'import',
            projectId,
          });
          results.push({ name: file.name, status: 'ok' });
        } catch (err: any) {
          results.push({ name: file.name, status: 'error', error: err.message });
        }
        setFileResults([...results]);
      }
      setProcessing(false);
    },
    [createMutation, projectId],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const files = Array.from(e.dataTransfer.files).filter((f) => f.name.endsWith('.md'));
      if (files.length > 0) handleFiles(files);
    },
    [handleFiles],
  );

  return (
    <div className="space-y-6">
      {/* Paste zone */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium">Paste Content</h3>
        <Textarea
          placeholder="Paste text here (Apple Notes, markdown...)"
          value={pasteContent}
          onChange={(e) => handlePasteChange(e.target.value)}
          className="min-h-[200px] font-mono text-sm"
        />
        {pasteContent && (
          <div className="flex items-center gap-3">
            <Input
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="flex-1"
            />
            <Tabs value={kind} onValueChange={(v) => setKind(v as 'atom' | 'document')}>
              <TabsList className="h-9">
                <TabsTrigger value="atom">Atom</TabsTrigger>
                <TabsTrigger value="document">Doc</TabsTrigger>
              </TabsList>
            </Tabs>
            <Input
              placeholder="Tags"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              className="w-40"
            />
            <Button onClick={handlePasteImport} disabled={importing || !title}>
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Index'}
            </Button>
          </div>
        )}
      </div>

      {/* Drop zone */}
      <div
        className={cn(
          'flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors',
          dragOver ? 'border-accent bg-accent/5' : 'border-border',
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="h-8 w-8 text-muted-foreground" />
        <p className="mt-2 text-sm text-muted-foreground">
          Drop .md files here or click to browse (max 10)
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".md"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length > 0) handleFiles(files);
          }}
        />
      </div>

      {/* File results */}
      {fileResults.length > 0 && (
        <div className="space-y-1">
          {fileResults.map((r, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              {r.status === 'ok' ? (
                <CheckCircle2 className="h-4 w-4 text-green-400" />
              ) : (
                <XCircle className="h-4 w-4 text-red-400" />
              )}
              <span>{r.name}</span>
              {r.error && <span className="text-xs text-red-400">{r.error}</span>}
            </div>
          ))}
          {processing && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2:** In `project-view.tsx`, add an "Import" tab toggle and render `<ImportZone>` when active. Add a state `showImport` and a button to toggle it:

```tsx
import { ImportZone } from '@/components/import-zone';

// Inside ProjectView, after the filter Tabs:
const [showImport, setShowImport] = useState(false);

// In the header buttons section:
<Button variant="outline" className="gap-1.5" onClick={() => setShowImport(!showImport)}>
  <Upload className="h-4 w-4" />
  {showImport ? 'Notes' : 'Import'}
</Button>

// Replace the note list section with:
{showImport ? (
  <div className="mt-6">
    <ImportZone projectId={projectId!} />
  </div>
) : (
  // ... existing note list ...
)}
```

- [ ] **Step 3:** Commit: `feat(ui): ImportZone with paste + drag-drop + Apple Notes heuristic`

---

## Task 16: Settings page (stats + backup)

**Files:**
- Create: `packages/ui/src/pages/settings.tsx`
- Modify: `packages/ui/src/app.tsx` (add route)

- [ ] **Step 1:** Create `packages/ui/src/pages/settings.tsx`:

```tsx
import { useStats } from '@/api/hooks/use-stats';
import { backupBrain } from '@/api/tools/maintenance';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useState } from 'react';
import { Database, Save, CheckCircle2 } from 'lucide-react';

export function Settings() {
  const { data: stats, isLoading } = useStats();
  const [backupResult, setBackupResult] = useState<string | null>(null);
  const [backing, setBacking] = useState(false);

  const handleBackup = async () => {
    setBacking(true);
    try {
      const result = await backupBrain({ label: 'manual' });
      setBackupResult(`Backup saved: ${result.path} (${formatBytes(result.sizeBytes)})`);
    } catch (err: any) {
      setBackupResult(`Error: ${err.message}`);
    }
    setBacking(false);
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <Skeleton className="mt-6 h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* Backup */}
      <Card className="mt-6 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-muted-foreground" />
            <div>
              <h3 className="font-medium">Database Backup</h3>
              <p className="text-sm text-muted-foreground">
                {stats ? formatBytes(stats.dbSizeBytes) : '...'} total
              </p>
            </div>
          </div>
          <Button onClick={handleBackup} disabled={backing} className="gap-1.5">
            <Save className="h-4 w-4" />
            {backing ? 'Backing up...' : 'Backup Now'}
          </Button>
        </div>
        {backupResult && (
          <p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-green-400" />
            {backupResult}
          </p>
        )}
      </Card>

      {/* Detailed stats */}
      {stats && (
        <div className="mt-6 space-y-4">
          <h2 className="text-lg font-semibold">Statistics</h2>

          <div className="grid grid-cols-2 gap-4">
            <Card className="p-4">
              <h3 className="text-sm text-muted-foreground">Notes</h3>
              <p className="text-2xl font-bold">{stats.notes.total}</p>
              <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                {Object.entries(stats.notes.byKind).map(([k, v]) => (
                  <p key={k}>{k}: {v}</p>
                ))}
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="text-sm text-muted-foreground">Chunks</h3>
              <p className="text-2xl font-bold">{stats.chunks.total}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                ~{stats.chunks.avgPerDoc.toFixed(1)} per doc
              </p>
            </Card>

            <Card className="p-4">
              <h3 className="text-sm text-muted-foreground">Embeddings</h3>
              <p className="text-2xl font-bold">{stats.embeddings.total}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                model: {stats.embeddings.model}
              </p>
            </Card>

            <Card className="p-4">
              <h3 className="text-sm text-muted-foreground">By Status</h3>
              <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                {Object.entries(stats.notes.byStatus).map(([k, v]) => (
                  <p key={k}>{k}: {v}</p>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
```

- [ ] **Step 2:** Add route: `<Route path="/settings" element={<Settings />} />`

- [ ] **Step 3:** Commit: `feat(ui): Settings page with stats + backup`

---

## Task 17: Express serves UI build

**Files:**
- Modify: `packages/mcp/src/http/server.ts`
- Modify: `packages/ui/vite.config.ts` (set outDir for MCP to find)

- [ ] **Step 1:** In `packages/mcp/src/http/server.ts`, replace the `GET /` stub with static file serving:

```ts
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Inside startHttpServer, AFTER the /health route:

// Serve UI static files (built by packages/ui)
const uiDistPath = resolve(import.meta.dirname ?? '.', '../../ui/dist');
if (existsSync(uiDistPath)) {
  app.use(express.static(uiDistPath));
  // SPA fallback: serve index.html for all non-API routes
  app.get('/{*path}', (_req, res) => {
    res.sendFile(resolve(uiDistPath, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => {
    res.send('<html><body><h1>agent-brain</h1><p>UI not built. Run: pnpm --filter @agent-brain/ui build</p></body></html>');
  });
}
```

Remove the old `GET /` stub.

- [ ] **Step 2:** Verify `packages/ui/vite.config.ts` has `build.outDir: 'dist'` (already set in Task 0).

- [ ] **Step 3:** Build and test:

```bash
pnpm --filter @agent-brain/ui build
node packages/mcp/dist/index.js --ui --db-path /tmp/brain-ui-test.db
# Open http://127.0.0.1:4000 → should serve the React app
```

- [ ] **Step 4:** Commit: `feat(mcp/http): serve UI static build in --ui mode`

---

## Task 18: Final integration + smoke test

**Files:**
- Modify: root `package.json` (update `dev` script)

- [ ] **Step 1:** Update root `package.json` dev script to start both:

```json
"dev": "concurrently -n mcp,ui -c blue,magenta \"pnpm --filter @agent-brain/mcp dev -- --ui\" \"pnpm --filter @agent-brain/ui dev\""
```

- [ ] **Step 2:** Full smoke test:

```bash
# Terminal 1: Start backend in --ui mode
node packages/mcp/src/index.ts --ui --db-path /tmp/brain-smoke.db

# Terminal 2: Start UI dev server
pnpm --filter @agent-brain/ui dev

# Open http://localhost:5173
# Verify:
# - Sidebar loads with Global project
# - Dashboard shows stats (all zeros on fresh DB)
# - Create a project via ⌘K → Actions → "New Note" (or navigate to /projects/global/notes/new)
# - Create an atom note
# - Create a document note with headers
# - View document in chunk-by-chunk mode
# - Edit the document (inline), Ctrl+S to save
# - Search via ⌘K
# - Import via paste zone
# - Check Settings page shows updated stats
# - Backup works
```

- [ ] **Step 3:** Commit: `chore(ui): final integration smoke test verified`

---

## Self-review

**Spec coverage check:**
- § 5.1 Layout → Task 5 (sidebar 260px, collapsible) ✅
- § 5.2 Routes → Tasks 5, 9, 10, 11, 12, 14, 16 ✅
- § 5.3 Command palette ⌘K → Task 13 (debounce, mode tabs, icons, actions group, projects group) ✅
- § 5.4 NoteDetail chunk-by-chunk → Task 11 (`DocumentView` renders sorted chunks with `#chunk-${id}` anchors) ✅
- § 5.4 Edit toggle → Task 11 (textarea, Ctrl+S) ✅
- § 5.5 Import zone → Task 15 (paste + drag-drop, Apple Notes heuristic, max 10, sequential, error per file) ✅
- § 5.6 Components → Tasks 6, 7, 8 ✅
- § 5.7 API layer → Tasks 3, 4 (mcp-client, tool wrappers, hooks with refetchOnWindowFocus) ✅
- § 5.8 Out of scope → not implemented ✅

**Placeholder scan:** No TBD, TODO, or "implement later". All code blocks are complete.

**Type consistency:** `Note`, `Chunk`, `SearchHit`, `Stats`, `Project` imported from `@agent-brain/shared` throughout. `mcpCall` signature consistent. `NoteWithChunks` type defined once in `tools/notes.ts`.

---

## Execution handoff

**Plan complete and saved to `docs/superpowers/plans/2026-04-10-agent-brain-ui.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
