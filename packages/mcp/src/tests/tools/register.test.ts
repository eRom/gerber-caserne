import { describe, it, expect } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { freshDb } from '../_helpers/fresh-db.js';
import { registerAllTools } from '../../tools/index.js';

const EXPECTED_TOOLS = [
  'project_create',
  'project_list',
  'project_update',
  'project_delete',
  'note_create',
  'note_get',
  'note_update',
  'note_delete',
  'note_list',
  'search',
  'backup_brain',
  'get_stats',
  'message_create',
  'message_list',
  'message_update',
  'task_create',
  'task_list',
  'task_get',
  'task_update',
  'task_delete',
  'task_reorder',
  'issue_create',
  'issue_list',
  'issue_get',
  'issue_update',
  'issue_close',
  'project_get_runbook',
  'project_set_runbook',
  'project_run',
  'project_stop',
  'project_tail_logs',
  'handoff_create',
  'handoff_list',
  'handoff_get',
  'handoff_close',
];

describe('registerAllTools', () => {
  it('registers 35 tools without throwing', () => {
    const { db, close } = freshDb();
    try {
      const server = new McpServer({ name: 'test', version: '0.0.1' });
      expect(() => registerAllTools(server, db)).not.toThrow();

      // Access _registeredTools via runtime property (private in TS but present at runtime)
      const registeredTools = (server as unknown as { _registeredTools: Record<string, unknown> })._registeredTools;
      const toolNames = Object.keys(registeredTools);

      expect(toolNames).toHaveLength(35);

      for (const name of EXPECTED_TOOLS) {
        expect(toolNames, `expected tool "${name}" to be registered`).toContain(name);
      }
    } finally {
      close();
    }
  });
});
