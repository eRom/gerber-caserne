import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { setRunbook, type RunbookData } from '../api/runbook.js';

interface Props {
  projectId: string;
  initial: RunbookData;
  onDone: () => void;
}

type Field = 'run_cmd' | 'url' | 'run_cwd' | 'env';

export function RunbookEdit({ projectId, initial, onDone }: Props) {
  const [field, setField] = useState<Field>('run_cmd');
  const [runCmd, setRunCmd] = useState(initial.run_cmd ?? '');
  const [url, setUrl] = useState(initial.url ?? '');
  const [runCwd, setRunCwd] = useState(initial.run_cwd ?? '');
  const [env, setEnv] = useState(
    initial.env ? Object.entries(initial.env).map(([k, v]) => `${k}=${v}`).join('\n') : '',
  );
  const [error, setError] = useState<string | null>(null);

  useInput(async (input, key) => {
    if (key.escape) { onDone(); return; }
    if (key.tab) {
      const order: Field[] = ['run_cmd', 'url', 'run_cwd', 'env'];
      setField(order[(order.indexOf(field) + 1) % order.length]);
      return;
    }
    if (key.ctrl && input === 's') {
      try {
        const envObj: Record<string, string> = {};
        for (const line of env.split('\n').filter((l) => l.trim())) {
          const [k, ...rest] = line.split('=');
          if (!k) continue;
          envObj[k.trim()] = rest.join('=').trim();
        }
        await setRunbook(projectId, {
          run_cmd: runCmd || null,
          url: url || null,
          run_cwd: runCwd || null,
          env: Object.keys(envObj).length ? envObj : null,
        });
        onDone();
      } catch (e: any) {
        setError(e.message ?? String(e));
      }
    }
  });

  return (
    <Box flexDirection="column" paddingX={2}>
      <Text bold>Edit runbook (Tab = next field, Ctrl+S = save, Esc = cancel)</Text>
      <Box marginTop={1} flexDirection="column">
        <Box>
          <Text color={field === 'run_cmd' ? 'cyan' : undefined}>Command  </Text>
          {field === 'run_cmd' ? <TextInput value={runCmd} onChange={setRunCmd} /> : <Text>{runCmd}</Text>}
        </Box>
        <Box>
          <Text color={field === 'url' ? 'cyan' : undefined}>URL      </Text>
          {field === 'url' ? <TextInput value={url} onChange={setUrl} /> : <Text>{url}</Text>}
        </Box>
        <Box>
          <Text color={field === 'run_cwd' ? 'cyan' : undefined}>CWD      </Text>
          {field === 'run_cwd' ? <TextInput value={runCwd} onChange={setRunCwd} /> : <Text>{runCwd}</Text>}
        </Box>
        <Box>
          <Text color={field === 'env' ? 'cyan' : undefined}>Env      </Text>
          {field === 'env' ? <TextInput value={env} onChange={setEnv} /> : <Text>{env}</Text>}
        </Box>
      </Box>
      {error && <Text color="red">Error: {error}</Text>}
    </Box>
  );
}
