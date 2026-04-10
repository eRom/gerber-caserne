import type { Database } from 'better-sqlite3';
import { fulltextSearch, type FulltextSearchInput } from './fulltext.js';
import { semanticSearch, type SemanticSearchInput } from './semantic.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HybridHit {
  ownerType: 'note' | 'chunk';
  ownerId: string;
  score: number;
  scoreFts: number;
  scoreSem: number;
  snippet: string;
}

export interface HybridSearchInput {
  query: string;
  limit?: number;
  projectId?: string;
  tags_any?: string[];
  tags_all?: string[];
  kind?: string;
  status?: string;
  source?: string;
}

// ---------------------------------------------------------------------------
// RRF constant — k=60 is the standard default
// ---------------------------------------------------------------------------

const RRF_K = 60;

// ---------------------------------------------------------------------------
// hybridSearch — Reciprocal Rank Fusion of FTS5 + semantic results
// ---------------------------------------------------------------------------

export async function hybridSearch(
  db: Database,
  input: HybridSearchInput,
): Promise<HybridHit[]> {
  const limit = input.limit ?? 20;

  const sharedInput: FulltextSearchInput & SemanticSearchInput = {
    query: input.query,
    limit: Math.max(limit * 3, 60), // fetch more candidates for fusion
    projectId: input.projectId,
    tags_any: input.tags_any,
    tags_all: input.tags_all,
    kind: input.kind,
    status: input.status,
    source: input.source,
  };

  const [ftsHits, semHits] = await Promise.all([
    fulltextSearch(db, sharedInput),
    semanticSearch(db, sharedInput),
  ]);

  // Build score map: ownerId -> accumulated RRF scores
  interface ScoreEntry {
    ownerType: 'note' | 'chunk';
    ownerId: string;
    scoreFts: number;
    scoreSem: number;
    rrfScore: number;
    snippet: string;
  }

  const scoreMap = new Map<string, ScoreEntry>();

  ftsHits.forEach((hit, rank) => {
    const entry: ScoreEntry = scoreMap.get(hit.ownerId) ?? {
      ownerType: hit.ownerType,
      ownerId: hit.ownerId,
      scoreFts: 0,
      scoreSem: 0,
      rrfScore: 0,
      snippet: hit.snippet,
    };
    entry.scoreFts = 1 / (RRF_K + rank + 1);
    entry.rrfScore += entry.scoreFts;
    scoreMap.set(hit.ownerId, entry);
  });

  semHits.forEach((hit, rank) => {
    const entry: ScoreEntry = scoreMap.get(hit.ownerId) ?? {
      ownerType: hit.ownerType,
      ownerId: hit.ownerId,
      scoreFts: 0,
      scoreSem: 0,
      rrfScore: 0,
      snippet: hit.snippet,
    };
    entry.scoreSem = 1 / (RRF_K + rank + 1);
    entry.rrfScore += entry.scoreSem;
    // Prefer the semantic snippet if FTS didn't set one
    if (!entry.snippet) entry.snippet = hit.snippet;
    scoreMap.set(hit.ownerId, entry);
  });

  const merged = [...scoreMap.values()]
    .sort((a, b) => b.rrfScore - a.rrfScore)
    .slice(0, limit);

  return merged.map((e) => ({
    ownerType: e.ownerType,
    ownerId: e.ownerId,
    score: e.rrfScore,
    scoreFts: e.scoreFts,
    scoreSem: e.scoreSem,
    snippet: e.snippet,
  }));
}
