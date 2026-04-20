import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { tailLogs } from '../api/runbook.js';

interface Props {
  projectId: string;
  onClose: () => void;
}

export function RunbookLogs({ projectId, onClose }: Props) {
  const [lines, setLines] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await tailLogs(projectId, 200);
        if (!cancelled) setLines(res.lines);
      } catch (e: any) {
        if (!cancelled) setError(e.message ?? String(e));
      }
    };
    poll();
    const id = setInterval(poll, 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, [projectId]);

  useInput((_, key) => {
    if (key.escape) onClose();
  });

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold>Logs — Esc to close (refresh every 1s)</Text>
      {error && <Text color="red">Error: {error}</Text>}
      <Box flexDirection="column" marginTop={1}>
        {lines.map((l, i) => <Text key={i}>{l}</Text>)}
      </Box>
    </Box>
  );
}
