import React, { useCallback, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { spawn } from 'node:child_process';
import { Spinner } from '../components/spinner.js';
import { useData } from '../hooks/use-data.js';
import { getRunbook, runProject, stopProject, type RunbookData } from '../api/runbook.js';
import { getEditorCmd } from '../api/config.js';

interface Props {
  projectId: string;
  repoPath: string | null;
}

export function Runbook({ projectId, repoPath }: Props) {
  const rb = useData<RunbookData>(() => getRunbook(projectId));
  const [error, setError] = useState<string | null>(null);

  const openEditor = useCallback(() => {
    if (!repoPath) return;
    const cmd = getEditorCmd();
    spawn('sh', ['-c', cmd], { cwd: repoPath, detached: true, stdio: 'ignore' }).unref();
  }, [repoPath]);

  const doRun = useCallback(async () => {
    try {
      await runProject(projectId);
      setError(null);
      rb.refetch();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [projectId, rb]);

  const doStop = useCallback(async () => {
    try {
      await stopProject(projectId);
      setError(null);
      rb.refetch();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [projectId, rb]);

  const copyUrl = useCallback(() => {
    if (!rb.data?.url) return;
    const p = spawn('pbcopy');
    p.stdin.write(rb.data.url);
    p.stdin.end();
  }, [rb.data?.url]);

  const openWeb = useCallback(() => {
    if (!rb.data?.url) return;
    spawn('open', [rb.data.url], { detached: true, stdio: 'ignore' }).unref();
  }, [rb.data?.url]);

  useInput((input) => {
    if (input === 'o') openEditor();
    else if (input === 'g') void doRun();
    else if (input === '.') void doStop();
    else if (input === 'c') copyUrl();
    else if (input === 'w') openWeb();
  });

  if (rb.loading) return <Spinner label="Loading runbook..." />;
  if (rb.error) return <Text color="red">Error: {rb.error.message}</Text>;
  const data = rb.data!;

  if (!data.run_cmd) {
    return (
      <Box flexDirection="column" paddingX={2}>
        <Text dimColor>No runbook configured.</Text>
        <Text dimColor>Run /gerber:runbook in Claude Code, or press [E] to add manually.</Text>
        <Box marginTop={1}><Text>  [O]pen in editor    [E]dit</Text></Box>
        {error && <Text color="red">{error}</Text>}
      </Box>
    );
  }

  const status = data.is_running
    ? <Text color="green">running (PID {data.pid})</Text>
    : <Text dimColor>stopped</Text>;

  return (
    <Box flexDirection="column" paddingX={2}>
      <Box><Text bold>  Status    </Text>{status}</Box>
      {data.url && <Box><Text bold>  URL       </Text><Text color="cyan">{data.url}</Text></Box>}
      <Box><Text bold>  Command   </Text><Text>{data.run_cmd}</Text></Box>
      <Box><Text bold>  CWD       </Text><Text dimColor>{data.run_cwd ?? '(repo root)'}</Text></Box>
      {data.env && Object.keys(data.env).length > 0 && (
        <Box><Text bold>  Env       </Text><Text dimColor>{Object.entries(data.env).map(([k, v]) => `${k}=${v}`).join(' ')}</Text></Box>
      )}
      <Box marginTop={1}>
        <Text dimColor>  [O]pen   [g]o/run   [.]stop   [C]opy URL   [W]eb   [L]ogs   [E]dit</Text>
      </Box>
      {error && <Text color="red">Error: {error}</Text>}
    </Box>
  );
}
