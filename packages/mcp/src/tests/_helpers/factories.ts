import { GLOBAL_PROJECT_ID } from '@agent-brain/shared';
import { sha256 } from '../../db/hash.js';

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

// ---------------------------------------------------------------------------
// makeNote
// ---------------------------------------------------------------------------
export interface NoteRow {
  id: string;
  project_id: string;
  kind: string;
  title: string;
  content: string;
  tags: string;
  status: string;
  source: string;
  content_hash: string;
  created_at: number;
  updated_at: number;
}

export function makeNote(overrides: Partial<NoteRow> = {}): NoteRow {
  const now = Date.now();
  const content = overrides.content ?? 'Test content';
  return {
    id: nextId(),
    project_id: GLOBAL_PROJECT_ID,
    kind: 'atom',
    title: 'Test Note',
    content,
    tags: '[]',
    status: 'active',
    source: 'ai',
    content_hash: sha256(content),
    created_at: now,
    updated_at: now,
    ...overrides,
    // Re-compute content_hash if content was overridden but content_hash was not
    ...(overrides.content && !overrides.content_hash
      ? { content_hash: sha256(overrides.content) }
      : {}),
  };
}

// ---------------------------------------------------------------------------
// makeChunk
// ---------------------------------------------------------------------------
export interface ChunkRow {
  id: string;
  note_id: string;
  position: number;
  heading_path: string | null;
  content: string;
  content_hash: string;
  created_at: number;
}

// Sentinel used as default note_id when makeChunk is called standalone
const SENTINEL_NOTE_ID = '00000000-0000-0000-0000-ffffffffffff';

export function makeChunk(overrides: Partial<ChunkRow> = {}): ChunkRow {
  const now = Date.now();
  const content = overrides.content ?? 'Test chunk content';
  return {
    id: nextId(),
    note_id: SENTINEL_NOTE_ID,
    position: 0,
    heading_path: 'Test',
    content,
    content_hash: sha256(content),
    created_at: now,
    ...overrides,
    // Re-compute content_hash if content was overridden but content_hash was not
    ...(overrides.content && !overrides.content_hash
      ? { content_hash: sha256(overrides.content) }
      : {}),
  };
}
