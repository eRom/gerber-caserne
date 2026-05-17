import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Database } from 'better-sqlite3';
import { z } from 'zod';
import { projectCreate, projectList, projectUpdate, projectDelete } from './projects.js';
import {
  projectGetRunbook,
  projectSetRunbook,
  projectRun,
  projectStop,
  projectTailLogs,
} from './runbook.js';
import { ragTool, ragOnboardTool } from './rag.js';
import { backupBrain, getStats } from './maintenance.js';
import { messageCreate, messageList, messageUpdate } from './messages.js';

export function registerAllTools(server: McpServer, db: Database) {
  // Project tools
  server.tool(
    'project_create',
    'Create a new project',
    {
      slug: z.string(),
      name: z.string(),
      description: z.string().optional(),
      repoPath: z.string().optional(),
      color: z.string().optional(),
    },
    async ({ slug, name, description, repoPath, color }) => {
      const result = projectCreate(db, { slug, name, description, repoPath, color });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  server.tool(
    'project_list',
    'List all projects',
    {
      limit: z.number().optional(),
      offset: z.number().optional(),
    },
    async (params) => {
      const result = projectList(db, params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  server.tool(
    'project_update',
    'Update a project',
    {
      id: z.string(),
      slug: z.string().optional(),
      name: z.string().optional(),
      description: z.string().optional(),
      repoPath: z.string().optional(),
      color: z.string().optional(),
    },
    async (params) => {
      const result = projectUpdate(db, params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  server.tool(
    'project_delete',
    'Delete a project',
    { id: z.string() },
    async ({ id }) => {
      const result = projectDelete(db, { id });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  server.tool(
    'project_get_runbook',
    'Get the runbook (run_cmd, url, env, is_running) for a project',
    { project_id: z.string() },
    async (params) => {
      const result = projectGetRunbook(db, params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  server.tool(
    'project_set_runbook',
    'Set or clear runbook fields (pass null to clear a field)',
    {
      project_id: z.string(),
      run_cmd: z.string().nullable().optional(),
      run_cwd: z.string().nullable().optional(),
      url: z.string().nullable().optional(),
      env: z.record(z.string(), z.string()).nullable().optional(),
    },
    async (params) => {
      const result = projectSetRunbook(db, params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  server.tool(
    'project_run',
    'Launch the project runbook as a detached process',
    { project_id: z.string() },
    async (params) => {
      const result = projectRun(db, params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  server.tool(
    'project_stop',
    'Stop the running process for a project (SIGTERM, SIGKILL if force=true)',
    { project_id: z.string(), force: z.boolean().optional() },
    async (params) => {
      const result = projectStop(db, params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  server.tool(
    'project_tail_logs',
    'Return the last N lines of the project run log',
    { project_id: z.string(), lines: z.number().optional() },
    async (params) => {
      const result = projectTailLogs(db, params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  // Vault RAG cross-projets (Gemini FileSearchStore + fetch GitHub)
  server.tool(
    'rag',
    'Recherche sémantique cross-projets dans le vault Gemini (FileSearchStore) puis fetch GitHub des docs cités. Retourne un Markdown structuré avec sources + contenu intégral, prêt à être synthétisé. Idéal pour interroger specs, plans, .cave, docs/superpowers de tous les projets indexés.',
    {
      question: z.string().min(1).max(500),
      repo: z.string().optional(),
    },
    async (params) => {
      const markdown = await ragTool(params);
      return { content: [{ type: 'text' as const, text: markdown }] };
    },
  );

  // Onboard un satellite dans le vault gerber (PUT sources.yml)
  server.tool(
    'rag_onboard',
    "Enregistre un repo GitHub dans le vault gerber (eRom/gerber-vault/sources.yml). Idempotent : skip si déjà présent. Le pipeline pull-sources.yml indexera les paths whitelistés au prochain cron (15min) puis sync-rag.yml les push dans Gemini. Utilise GERBER_VAULT_HUB côté serveur, l'utilisateur n'a pas à passer de token.",
    {
      repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/, 'repo must be "owner/name"'),
      paths: z.array(z.string()).optional(),
    },
    async (params) => {
      const result = await ragOnboardTool(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  // Maintenance
  server.tool(
    'backup_brain',
    'Create a database backup',
    { label: z.string().optional() },
    async (params) => {
      const result = backupBrain(db, params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  server.tool(
    'get_stats',
    'Get brain statistics',
    { projectId: z.string().optional() },
    async (params) => {
      const result = getStats(db, params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  // Message tools (inter-session bus — context + reminder only)
  server.tool(
    'message_create',
    'Create an inter-session message (context or reminder) targeting a project',
    {
      projectSlug: z.string(),
      type: z.enum(['context', 'reminder']),
      title: z.string(),
      content: z.string(),
      metadata: z
        .object({
          source: z.string().optional(),
          sourceProject: z.string().optional(),
        })
        .passthrough()
        .optional(),
    },
    async (params) => {
      const result = messageCreate(db, params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  server.tool(
    'message_list',
    'List inter-session messages with optional filters',
    {
      projectSlug: z.string().optional(),
      type: z.enum(['context', 'reminder']).optional(),
      status: z.enum(['pending', 'done']).optional(),
      since: z.number().optional(),
      limit: z.number().optional(),
    },
    async (params) => {
      const result = messageList(db, params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  server.tool(
    'message_update',
    'Update an inter-session message (status, content, or metadata)',
    {
      id: z.string(),
      status: z.enum(['pending', 'done']).optional(),
      content: z.string().optional(),
      metadata: z
        .object({
          source: z.string().optional(),
          sourceProject: z.string().optional(),
        })
        .passthrough()
        .optional(),
    },
    async (params) => {
      const result = messageUpdate(db, params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

}
