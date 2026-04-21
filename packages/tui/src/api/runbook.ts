import { mcpCall } from '../client.js';

export interface RunbookData {
  run_cmd: string | null;
  run_cwd: string | null;
  url: string | null;
  env: Record<string, string> | null;
  is_running: boolean;
  pid?: number;
  started_at?: number;
  log_path?: string;
}

export function getRunbook(projectId: string) {
  return mcpCall<RunbookData>('project_get_runbook', { project_id: projectId });
}

export function setRunbook(
  projectId: string,
  fields: Partial<Pick<RunbookData, 'run_cmd' | 'run_cwd' | 'url' | 'env'>>,
) {
  return mcpCall<{ ok: true }>('project_set_runbook', { project_id: projectId, ...fields });
}

export function runProject(projectId: string) {
  return mcpCall<{ ok: true; pid: number; log_path: string; url: string | null }>(
    'project_run',
    { project_id: projectId },
  );
}

export function stopProject(projectId: string, force = false) {
  return mcpCall<{ ok: true }>('project_stop', { project_id: projectId, force });
}

export function tailLogs(projectId: string, lines = 100) {
  return mcpCall<{ lines: string[]; path: string | null }>('project_tail_logs', {
    project_id: projectId,
    lines,
  });
}
