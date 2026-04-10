import type { Database } from 'better-sqlite3';
import { z } from 'zod';
import { SEARCH_MODES } from '@agent-brain/shared';
import { fulltextSearch } from '../search/fulltext.js';
import { semanticSearch } from '../search/semantic.js';
import { hybridSearch } from '../search/hybrid.js';
import { expandNeighbors } from '../search/neighbors.js';

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const SearchInput = z.object({
  query: z.string().min(1).max(500),
  mode: z.enum(SEARCH_MODES).default('hybrid'),
  limit: z.number().int().min(1).max(50).default(20),
  projectId: z.string().uuid().optional(),
  kind: z.enum(['atom', 'document']).optional(),
  status: z.enum(['draft', 'active', 'archived', 'deprecated']).optional(),
  source: z.enum(['ai', 'human', 'import']).optional(),
  tags_any: z.array(z.string()).optional(),
  tags_all: z.array(z.string()).optional(),
  neighbors: z.number().int().min(0).max(3).default(1),
}).refine(
  (d) => !(d.tags_any && d.tags_all),
  { message: 'tags_any and tags_all are mutually exclusive' },
);

type SearchInputType = z.input<typeof SearchInput>;

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export interface ParentMeta {
  noteId: string;
  title: string;
  kind: string;
  projectId: string | null;
  tags: string[];
  status: string;
}

export interface ChunkMeta {
  headingPath: string | null;
  position: number;
  neighbors?: Array<{ position: number; content: string }>;
}

export interface HydratedHit {
  ownerType: 'note' | 'chunk';
  ownerId: string;
  score: number;
  scoreFts?: number;
  scoreSem?: number;
  snippet: string;
  parent: ParentMeta;
  chunk?: ChunkMeta;
}

export interface SearchResult {
  hits: HydratedHit[];
  total: number;
  mode: string;
}

// ---------------------------------------------------------------------------
// searchTool
// ---------------------------------------------------------------------------

export async function searchTool(db: Database, rawInput: SearchInputType): Promise<SearchResult> {
  const input = SearchInput.parse(rawInput);

  // Dispatch to the appropriate search strategy
  let rawHits: Array<{
    ownerType: 'note' | 'chunk';
    ownerId: string;
    score: number;
    scoreFts?: number;
    scoreSem?: number;
    snippet: string;
  }>;

  switch (input.mode) {
    case 'fulltext':
      rawHits = await fulltextSearch(db, input);
      break;
    case 'semantic':
      rawHits = await semanticSearch(db, input);
      break;
    case 'hybrid':
      rawHits = await hybridSearch(db, input);
      break;
    default:
      throw new Error(`Unknown search mode: ${input.mode}`);
  }

  // Expand neighbors for chunk hits
  const withNeighbors = expandNeighbors(db, rawHits, input.neighbors);

  // Hydrate: for each hit, load parent note metadata
  interface NoteRow {
    id: string;
    title: string;
    kind: string;
    project_id: string | null;
    tags: string;
    status: string;
  }

  interface ChunkRow {
    note_id: string;
    heading_path: string | null;
    position: number;
  }

  const noteStmt = db.prepare<[string], NoteRow>(
    'SELECT id, title, kind, project_id, tags, status FROM notes WHERE id = ?',
  );

  const chunkStmt = db.prepare<[string], ChunkRow>(
    'SELECT note_id, heading_path, position FROM chunks WHERE id = ?',
  );

  const hydrated: HydratedHit[] = withNeighbors.map((hit) => {
    let noteId: string;
    let chunkMeta: ChunkMeta | undefined;

    if (hit.ownerType === 'note') {
      noteId = hit.ownerId;
    } else {
      // chunk → look up its note_id and metadata
      const chunkRow = chunkStmt.get(hit.ownerId);
      noteId = chunkRow?.note_id ?? hit.ownerId;
      chunkMeta = chunkRow
        ? {
            headingPath: chunkRow.heading_path,
            position: chunkRow.position,
            neighbors: (hit as typeof hit & { neighbors?: Array<{ position: number; content: string }> }).neighbors ?? [],
          }
        : undefined;
    }

    // Load parent note
    const note = noteStmt.get(noteId);

    const parent: ParentMeta = note
      ? {
          noteId: note.id,
          title: note.title,
          kind: note.kind,
          projectId: note.project_id,
          tags: JSON.parse(note.tags || '[]') as string[],
          status: note.status,
        }
      : {
          noteId,
          title: '',
          kind: '',
          projectId: null,
          tags: [],
          status: '',
        };

    const result: HydratedHit = {
      ownerType: hit.ownerType,
      ownerId: hit.ownerId,
      score: hit.score,
      snippet: hit.snippet,
      parent,
    };

    if (hit.scoreFts !== undefined) result.scoreFts = hit.scoreFts;
    if (hit.scoreSem !== undefined) result.scoreSem = hit.scoreSem;
    if (chunkMeta !== undefined) result.chunk = chunkMeta;

    return result;
  });

  return {
    hits: hydrated,
    total: hydrated.length,
    mode: input.mode,
  };
}
