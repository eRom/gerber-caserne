import React, { useCallback, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { spawn } from 'node:child_process';
import { Spinner } from '../components/spinner.js';
import { useData } from '../hooks/use-data.js';
import { getRunbook, runProject, stopProject, type RunbookData } from '../api/runbook.js';
import { getEditorCmd } from '../api/config.js';
import { RunbookEdit } from './runbook-edit.js';
import { RunbookLogs } from './runbook-logs.js';

interface Props {
  projectId: string;
  repoPath: string | null;
}

export function Runbook({ projectId, repoPath }: Props) {
  const rb = useData<RunbookData>(() => getRunbook(projectId));
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [viewingLogs, setViewingLogs] = useState(false);

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
    if (editing || viewingLogs) return;
    if (input === 'o') openEditor();
    else if (input === 'g') void doRun();
    else if (input === '.') void doStop();
    else if (input === 'c') copyUrl();
    else if (input === 'w') openWeb();
    else if (input === 'l') setViewingLogs(true);
    else if (input === 'e') setEditing(true);
  });

  if (viewingLogs) {
    return <RunbookLogs projectId={projectId} onClose={() => setViewingLogs(false)} />;
  }

  if (editing && rb.data) {
    return <RunbookEdit projectId={projectId} initial={rb.data} onDone={() => { setEditing(false); rb.refetch(); }} />;
  }

  if (rb.loading) return <Spinner label="Loading runbook..." />;
  if (rb.error) return <Text color="red">Error: {rb.error.message}</Text>;
  const data = rb.data!;

  const hasRunbook = !!data.run_cmd;
  const status = !hasRunbook
    ? <Text dimColor>not configured</Text>
    : data.is_running
      ? <Text color="green">running (PID {data.pid})</Text>
      : <Text dimColor>stopped</Text>;

  const none = <Text dimColor>None</Text>;
  const envDisplay = data.env && Object.keys(data.env).length > 0
    ? Object.entries(data.env).map(([k, v]) => `${k}=${v}`).join(' ')
    : null;

  return (
    <Box flexDirection="column" paddingX={2}>
      <Box><Text bold>  Status    </Text>{status}</Box>
      <Box><Text bold>  Path      </Text>{repoPath ? <Text dimColor>{repoPath}</Text> : none}</Box>
      <Box><Text bold>  URL       </Text>{data.url ? <Text color="cyan">{data.url}</Text> : none}</Box>
      <Box><Text bold>  Command   </Text>{data.run_cmd ? <Text>{data.run_cmd}</Text> : none}</Box>
      <Box><Text bold>  CWD       </Text><Text dimColor>{data.run_cwd ?? '(repo root)'}</Text></Box>
      <Box><Text bold>  Env       </Text>{envDisplay ? <Text dimColor>{envDisplay}</Text> : none}</Box>
      <Box marginTop={1}>
        {hasRunbook ? (
          <Text dimColor>  [O]pen   [g]o/run   [.]stop   [C]opy URL   [W]eb   [L]ogs   [E]dit</Text>
        ) : (
          <Text dimColor>  [O]pen in editor   [E]dit   (or /gerber:runbook in Claude Code)</Text>
        )}
      </Box>
      {error && <Text color="red">Error: {error}</Text>}
    </Box>
  );
}
