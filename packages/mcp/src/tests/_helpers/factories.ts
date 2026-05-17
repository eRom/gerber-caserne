// ---------------------------------------------------------------------------
// Deterministic UUID counter
// GLOBAL_PROJECT_ID uses ...000, so we start from 1.
// ---------------------------------------------------------------------------
let _counter = 0;

function nextId(): string {
  _counter += 1;
  return `00000000-0000-0000-0000-${String(_counter).padStart(12, '0')}`;
}

/** Reset the counter between test files if needed. */
export function resetFactoryCounter(): void {
  _counter = 0;
}

// ---------------------------------------------------------------------------
// makeProject
// ---------------------------------------------------------------------------
export interface ProjectRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  repo_path: string | null;
  color: string | null;
  created_at: number;
  updated_at: number;
}

export function makeProject(overrides: Partial<ProjectRow> = {}): ProjectRow {
  const now = Date.now();
  return {
    id: nextId(),
    slug: 'test-project',
    name: 'Test Project',
    description: null,
    repo_path: null,
    color: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}
