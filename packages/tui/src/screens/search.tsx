import React, { useState, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { Spinner } from '../components/spinner.js';
import { StatusBadge } from '../components/status-badge.js';
import { useData } from '../hooks/use-data.js';
import { search, type SearchResponse } from '../api/search.js';
import { getNote } from '../api/notes.js';
import type { SearchHit, Note } from '@agent-brain/shared';

interface SearchProps {
  projectId?: string | undefined;
}

/** Deduplicate hits by noteId, keeping the best score per note */
function dedup(hits: SearchHit[]): SearchHit[] {
  const seen = new Map<string, SearchHit>();
  for (const hit of hits) {
    const noteId = hit.parent.noteId;
    const existing = seen.get(noteId);
    if (!existing || hit.score > existing.score) {
      seen.set(noteId, hit);
    }
  }
  return [...seen.values()];
}

export function Search({ projectId }: SearchProps) {
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [selected, setSelected] = useState(0);
  const [mode, setMode] = useState<string>('hybrid');
  const [detail, setDetail] = useState<Note | null>(null);

  const results = useData<SearchResponse>(
    () => submitted
      ? search({ query: submitted, mode, limit: 20, ...(projectId !== undefined && { projectId }) })
      : Promise.resolve({ hits: [], total: 0, mode }),
    [submitted, mode, projectId],
  );

  const hits = useMemo(() => dedup(results.data?.hits ?? []), [results.data]);

  useInput((input, key) => {
    // Detail view
    if (detail) {
      if (key.escape) { setDetail(null); return; }
      return;
    }

    if (key.return) {
      // If we have results and a selection, open the note
      if (hits.length > 0 && submitted) {
        const hit = hits[selected];
        if (hit) {
          void getNote(hit.parent.noteId).then((r) => setDetail(r.item));
          return;
        }
      }
      // Otherwise submit the query
      if (query.trim()) {
        setSubmitted(query.trim());
        setSelected(0);
      }
      return;
    }

    if (key.backspace || key.delete) {
      setQuery((q) => q.slice(0, -1));
      return;
    }

    if (key.upArrow) { setSelected((s) => Math.max(0, s - 1)); return; }
    if (key.downArrow) { setSelected((s) => Math.min(hits.length - 1, s + 1)); return; }

    if (key.tab) {
      setMode((m) => m === 'hybrid' ? 'semantic' : m === 'semantic' ? 'fulltext' : 'hybrid');
      return;
    }

    // Typing resets to search mode
    if (input && !key.ctrl && !key.meta) {
      setQuery((q) => q + input);
      // If user types new chars, clear submitted so Enter re-submits
      if (submitted) setSubmitted('');
    }
  });

  // ─── Note detail view ───
  if (detail) {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Box marginBottom={1}>
          <Text bold color="cyan">--- {detail.title} </Text>
        </Box>
        <Box gap={2} marginBottom={1}>
          <StatusBadge type="kind" value={detail.kind} />
          <StatusBadge type="note" value={detail.status} />
          <Text dimColor>source: {detail.source}</Text>
        </Box>
        {detail.tags.length > 0 && (
          <Box marginBottom={1}>
            <Text dimColor>tags: </Text>
            <Text color="cyan">{detail.tags.join(', ')}</Text>
          </Box>
        )}
        <Box flexDirection="column" marginTop={1}>
          <Text>{detail.content}</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>Esc back to results</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Search input */}
      <Box marginBottom={1}>
        <Text color="cyan" bold>{'> '}</Text>
        <Text>{query}</Text>
        <Text color="cyan">{'_'}</Text>
        <Text dimColor>  ({mode}) [Tab] cycle mode{projectId ? '' : ' (global)'}</Text>
      </Box>

      {submitted && results.loading ? (
        <Spinner label="Searching..." />
      ) : submitted && results.error ? (
        <Text color="red">Error: {results.error.message}</Text>
      ) : submitted && hits.length === 0 ? (
        <Text dimColor italic>  No results for "{submitted}"</Text>
      ) : submitted ? (
        <Box flexDirection="column">
          <Text dimColor>{hits.length} results ({results.data?.mode})</Text>
          <Text> </Text>
          {hits.map((hit: SearchHit, i: number) => (
            <Box key={hit.parent.noteId} flexDirection="column" marginBottom={1}>
              <Box>
                {selected === i && <Text color="cyan" bold>{'> '}</Text>}
                {selected !== i && <Text>{'  '}</Text>}
                <StatusBadge type="kind" value={hit.parent.kind} />
                <Text> </Text>
                <Text bold>{hit.parent.title}</Text>
                <Text dimColor> (score: {hit.score.toFixed(3)})</Text>
              </Box>
              {selected === i && (
                <Box paddingLeft={4} flexDirection="column">
                  <Text>{hit.snippet.slice(0, 200)}{hit.snippet.length > 200 ? '...' : ''}</Text>
                  {hit.parent.tags.length > 0 && (
                    <Text dimColor>tags: {hit.parent.tags.join(', ')}</Text>
                  )}
                </Box>
              )}
            </Box>
          ))}
          <Box marginTop={1}>
            <Text dimColor>↑↓ navigate  |  Enter open note  |  type to search again</Text>
          </Box>
        </Box>
      ) : (
        <Text dimColor italic>  Type a query and press Enter</Text>
      )}
    </Box>
  );
}
