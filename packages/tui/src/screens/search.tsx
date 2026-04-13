import React, { useState, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { Spinner } from '../components/spinner.js';
import { StatusBadge } from '../components/status-badge.js';
import { useData } from '../hooks/use-data.js';
import { search, type SearchResponse } from '../api/search.js';
import { listProjects } from '../api/projects.js';
import { getNote } from '../api/notes.js';
import type { SearchHit, Note, Project } from '@agent-brain/shared';

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

interface GroupedHit {
  hit: SearchHit;
  flatIndex: number;
}

interface ProjectGroup {
  projectName: string;
  items: GroupedHit[];
}

/** Group hits by project, sorted alphabetically */
function groupByProject(hits: SearchHit[], projectMap: Map<string, string>): ProjectGroup[] {
  const groups = new Map<string, GroupedHit[]>();
  hits.forEach((hit, flatIndex) => {
    const pid = hit.parent.projectId;
    if (!groups.has(pid)) groups.set(pid, []);
    groups.get(pid)!.push({ hit, flatIndex });
  });

  const result: ProjectGroup[] = [];
  for (const [pid, items] of groups) {
    result.push({ projectName: projectMap.get(pid) ?? pid.slice(0, 8), items });
  }
  result.sort((a, b) => a.projectName.localeCompare(b.projectName));
  return result;
}

export function Search({ projectId }: SearchProps) {
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [selected, setSelected] = useState(0);
  const [mode, setMode] = useState<string>('hybrid');
  const [detail, setDetail] = useState<Note | null>(null);
  const isGlobal = projectId === undefined;

  const projects = useData(() => listProjects({ limit: 200 }));
  const projectMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of projects.data?.items ?? []) m.set(p.id, p.name);
    return m;
  }, [projects.data]);

  const results = useData<SearchResponse>(
    () => submitted
      ? search({ query: submitted, mode, limit: 30, ...(projectId !== undefined && { projectId }) })
      : Promise.resolve({ hits: [], total: 0, mode }),
    [submitted, mode, projectId],
  );

  const hits = useMemo(() => dedup(results.data?.hits ?? []), [results.data]);
  const grouped = useMemo(() => isGlobal ? groupByProject(hits, projectMap) : null, [isGlobal, hits, projectMap]);

  useInput((input, key) => {
    if (detail) {
      if (key.escape) { setDetail(null); return; }
      return;
    }

    if (key.return) {
      if (hits.length > 0 && submitted) {
        const hit = hits[selected];
        if (hit) {
          void getNote(hit.parent.noteId).then((r) => setDetail(r.item));
          return;
        }
      }
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

    if (input && !key.ctrl && !key.meta) {
      setQuery((q) => q + input);
      if (submitted) setSubmitted('');
    }
  });

  // ─── Note detail ───
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

  // ─── Render a single hit row ───
  const renderHit = (hit: SearchHit, flatIndex: number) => {
    const isSel = selected === flatIndex;
    return (
      <Box key={hit.parent.noteId} flexDirection="column" {...(isSel ? { marginBottom: 1 } : {})}>
        <Box>
          {isSel ? <Text color="cyan" bold>{'> '}</Text> : <Text>{'  '}</Text>}
          <StatusBadge type="kind" value={hit.parent.kind} />
          <Text> </Text>
          <Text bold>{hit.parent.title}</Text>
          <Text dimColor> ({hit.score.toFixed(3)})</Text>
        </Box>
        {isSel && (
          <Box paddingLeft={4} flexDirection="column">
            <Text>{hit.snippet.slice(0, 200)}{hit.snippet.length > 200 ? '...' : ''}</Text>
            {hit.parent.tags.length > 0 && (
              <Text dimColor>tags: {hit.parent.tags.join(', ')}</Text>
            )}
          </Box>
        )}
      </Box>
    );
  };

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Search input */}
      <Box marginBottom={1}>
        <Text color="cyan" bold>{'> '}</Text>
        <Text>{query}</Text>
        <Text color="cyan">{'_'}</Text>
        <Text dimColor>  ({mode}) [Tab] cycle{isGlobal ? ' (global)' : ''}</Text>
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

          {/* Global mode: grouped by project */}
          {grouped ? (
            grouped.map((group) => (
              <Box key={group.projectName} flexDirection="column" marginBottom={1}>
                <Box marginBottom={1}>
                  <Text bold color="cyan">--- {group.projectName} </Text>
                  <Text dimColor>{'-'.repeat(Math.max(0, 60 - group.projectName.length))}</Text>
                </Box>
                {group.items.map(({ hit, flatIndex }) => renderHit(hit, flatIndex))}
              </Box>
            ))
          ) : (
            /* Project mode: flat list */
            hits.map((hit, i) => renderHit(hit, i))
          )}

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
