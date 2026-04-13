import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { Spinner } from '../components/spinner.js';
import { StatusBadge } from '../components/status-badge.js';
import { useData } from '../hooks/use-data.js';
import { search, type SearchResponse } from '../api/search.js';
import type { SearchHit } from '@agent-brain/shared';

export function Search() {
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [selected, setSelected] = useState(0);
  const [mode, setMode] = useState<string>('hybrid');

  const results = useData<SearchResponse>(
    () => submitted ? search({ query: submitted, mode, limit: 20 }) : Promise.resolve({ hits: [], total: 0, mode }),
    [submitted, mode],
  );

  const hits = results.data?.hits ?? [];

  useInput((input, key) => {
    if (key.return) {
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

    // Tab to cycle search mode
    if (key.tab) {
      setMode((m) => m === 'hybrid' ? 'semantic' : m === 'semantic' ? 'fulltext' : 'hybrid');
      return;
    }

    // Only add printable characters
    if (input && !key.ctrl && !key.meta) {
      setQuery((q) => q + input);
    }
  });

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">{'─── Search '}</Text>
        <Text dimColor>{'─'.repeat(51)}</Text>
      </Box>

      {/* Search input */}
      <Box marginBottom={1}>
        <Text color="cyan" bold>{'❯ '}</Text>
        <Text>{query}</Text>
        <Text color="cyan">{'█'}</Text>
        <Text dimColor>  ({mode}) [Tab] cycle mode</Text>
      </Box>

      {/* Results */}
      {submitted && results.loading ? (
        <Spinner label="Searching…" />
      ) : submitted && results.error ? (
        <Text color="red">Error: {results.error.message}</Text>
      ) : submitted && hits.length === 0 ? (
        <Text dimColor italic>  No results for "{submitted}"</Text>
      ) : submitted ? (
        <Box flexDirection="column">
          <Text dimColor>{results.data?.total ?? 0} results ({results.data?.mode})</Text>
          <Text> </Text>
          {hits.map((hit: SearchHit, i: number) => (
            <Box key={hit.ownerId + i} flexDirection="column" marginBottom={1}>
              <Box>
                {selected === i && <Text color="cyan" bold>{'▸ '}</Text>}
                {selected !== i && <Text>{'  '}</Text>}
                <StatusBadge type="kind" value={hit.parent.kind} />
                <Text> </Text>
                <Text bold>{hit.parent.title}</Text>
                <Text dimColor> (score: {hit.score.toFixed(3)})</Text>
              </Box>
              {selected === i && (
                <Box paddingLeft={4} flexDirection="column">
                  <Text>{hit.snippet.slice(0, 200)}{hit.snippet.length > 200 ? '…' : ''}</Text>
                  {hit.parent.tags.length > 0 && (
                    <Text dimColor>tags: {hit.parent.tags.join(', ')}</Text>
                  )}
                </Box>
              )}
            </Box>
          ))}
        </Box>
      ) : (
        <Text dimColor italic>  Type a query and press Enter</Text>
      )}
    </Box>
  );
}
