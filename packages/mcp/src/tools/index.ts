import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Database } from 'better-sqlite3';
import { z } from 'zod';
import { projectCreate, projectList, projectUpdate, projectDelete } from './projects.js';
import { noteCreate, noteGet, noteDelete, noteList, noteUpdate } from './notes.js';
import { searchTool } from './search.js';
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
    'Delete a project (reassigns notes to global)',
    { id: z.string() },
    async ({ id }) => {
      const result = projectDelete(db, { id });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  // Note tools
  server.tool(
    'note_create',
    'Create a note (atom or document). Use projectSlug OR projectId to assign to a project.',
    {
      kind: z.string(),
      title: z.string(),
      content: z.string(),
      tags: z.array(z.string()).optional(),
      source: z.string(),
      projectId: z.string().optional(),
      projectSlug: z.string().optional(),
    },
    async (params) => {
      const result = await noteCreate(db, params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  server.tool(
    'note_get',
    'Get a note by ID',
    { id: z.string() },
    async ({ id }) => {
      const result = noteGet(db, { id });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  server.tool(
    'note_update',
    'Update a note. Use projectSlug OR projectId to move to another project.',
    {
      id: z.string(),
      title: z.string().optional(),
      content: z.string().optional(),
      tags: z.array(z.string()).optional(),
      status: z.string().optional(),
      projectId: z.string().optional(),
      projectSlug: z.string().optional(),
    },
    async (params) => {
      const result = await noteUpdate(db, params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  server.tool(
    'note_delete',
    'Delete a note',
    { id: z.string() },
    async ({ id }) => {
      const result = noteDelete(db, { id });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  server.tool(
    'note_list',
    'List notes with filters. Use projectSlug OR projectId to filter by project.',
    {
      kind: z.string().optional(),
      status: z.string().optional(),
      source: z.string().optional(),
      projectId: z.string().optional(),
      projectSlug: z.string().optional(),
      tags_any: z.array(z.string()).optional(),
      tags_all: z.array(z.string()).optional(),
      sort: z.string().optional(),
      limit: z.number().optional(),
      offset: z.number().optional(),
    },
    async (params) => {
      const result = noteList(db, params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  // Search
  server.tool(
    'search',
    'Search notes and chunks',
    {
      query: z.string(),
      mode: z.string().optional(),
      limit: z.number().optional(),
      projectId: z.string().optional(),
      kind: z.string().optional(),
      status: z.string().optional(),
      source: z.string().optional(),
      tags_any: z.array(z.string()).optional(),
      tags_all: z.array(z.string()).optional(),
      neighbors: z.number().optional(),
    },
    async (params) => {
      const result = await searchTool(db, params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
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

  // Message tools (inter-session bus)
  server.tool(
    'message_create',
    'Create an inter-session message (issue, context, or task) targeting a project',
    {
      projectSlug: z.string(),
      type: z.enum(['issue', 'context', 'task']),
      title: z.string(),
      content: z.string(),
      priority: z.enum(['low', 'normal', 'high']).optional(),
      metadata: z
        .object({
          severity: z.enum(['bug', 'regression', 'warning']).optional(),
          assignee: z.string().optional(),
          source: z.string().optional(),
          sourceProject: z.string().optional(),
          relatedNoteIds: z.array(z.string()).optional(),
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
      type: z.enum(['issue', 'context', 'task']).optional(),
      status: z.enum(['pending', 'ack', 'done', 'dismissed']).optional(),
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
      status: z.enum(['pending', 'ack', 'done', 'dismissed']).optional(),
      content: z.string().optional(),
      metadata: z
        .object({
          severity: z.enum(['bug', 'regression', 'warning']).optional(),
          assignee: z.string().optional(),
          source: z.string().optional(),
          sourceProject: z.string().optional(),
          relatedNoteIds: z.array(z.string()).optional(),
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
