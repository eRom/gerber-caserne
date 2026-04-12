import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Database } from 'better-sqlite3';
import { z } from 'zod';
import { projectCreate, projectList, projectUpdate, projectDelete } from './projects.js';
import { noteCreate, noteGet, noteDelete, noteList, noteUpdate } from './notes.js';
import { searchTool } from './search.js';
import { backupBrain, getStats } from './maintenance.js';
import { messageCreate, messageList, messageUpdate } from './messages.js';
import { taskCreate, taskList, taskGet, taskUpdate, taskDelete, taskReorder } from './tasks.js';
import { issueCreate, issueList, issueGet, issueUpdate, issueClose } from './issues.js';

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

  // Task tools
  server.tool(
    'task_create',
    'Create a task in a project',
    {
      projectSlug: z.string(),
      title: z.string(),
      description: z.string().optional(),
      status: z.enum(['active', 'waiting', 'someday', 'done']).optional(),
      priority: z.enum(['low', 'normal', 'high']).optional(),
      assignee: z.string().optional(),
      tags: z.array(z.string()).optional(),
      dueDate: z.number().optional(),
      waitingOn: z.string().optional(),
      parentId: z.string().optional(),
      metadata: z.object({
        source: z.string().optional(),
        relatedNoteIds: z.array(z.string()).optional(),
      }).passthrough().optional(),
    },
    async (params) => {
      const result = taskCreate(db, params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  server.tool(
    'task_list',
    'List tasks with optional filters. Excludes subtasks by default.',
    {
      projectSlug: z.string().optional(),
      status: z.enum(['active', 'waiting', 'someday', 'done']).optional(),
      priority: z.enum(['low', 'normal', 'high']).optional(),
      tags_any: z.array(z.string()).optional(),
      parentId: z.string().optional(),
      sort: z.enum(['position', 'created_at', 'updated_at', 'due_date']).optional(),
      limit: z.number().optional(),
      offset: z.number().optional(),
    },
    async (params) => {
      const result = taskList(db, params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  server.tool(
    'task_get',
    'Get a task by ID with its subtasks',
    { id: z.string() },
    async ({ id }) => {
      const result = taskGet(db, { id });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  server.tool(
    'task_update',
    'Update a task. Sets completedAt automatically when status changes to/from done.',
    {
      id: z.string(),
      title: z.string().optional(),
      description: z.string().optional(),
      status: z.enum(['active', 'waiting', 'someday', 'done']).optional(),
      priority: z.enum(['low', 'normal', 'high']).optional(),
      assignee: z.string().nullable().optional(),
      tags: z.array(z.string()).optional(),
      dueDate: z.number().nullable().optional(),
      waitingOn: z.string().nullable().optional(),
      metadata: z.object({
        source: z.string().optional(),
        relatedNoteIds: z.array(z.string()).optional(),
      }).passthrough().optional(),
    },
    async (params) => {
      const result = taskUpdate(db, params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  server.tool(
    'task_delete',
    'Delete a task and its subtasks',
    { id: z.string() },
    async ({ id }) => {
      const result = taskDelete(db, { id });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  server.tool(
    'task_reorder',
    'Reorder tasks by setting position from array order',
    { ids: z.array(z.string()) },
    async ({ ids }) => {
      const result = taskReorder(db, { ids });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  // Issue tools
  server.tool(
    'issue_create',
    'Create an issue in a project',
    {
      projectSlug: z.string(),
      title: z.string(),
      description: z.string().optional(),
      severity: z.enum(['bug', 'regression', 'warning', 'enhancement']).optional(),
      priority: z.enum(['low', 'normal', 'high', 'critical']).optional(),
      assignee: z.string().optional(),
      tags: z.array(z.string()).optional(),
      metadata: z.object({
        source: z.string().optional(),
        reporter: z.string().optional(),
        relatedNoteIds: z.array(z.string()).optional(),
      }).passthrough().optional(),
    },
    async (params) => {
      const result = issueCreate(db, params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  server.tool(
    'issue_list',
    'List issues with optional filters',
    {
      projectSlug: z.string().optional(),
      status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(),
      severity: z.enum(['bug', 'regression', 'warning', 'enhancement']).optional(),
      priority: z.enum(['low', 'normal', 'high', 'critical']).optional(),
      tags_any: z.array(z.string()).optional(),
      limit: z.number().optional(),
      offset: z.number().optional(),
    },
    async (params) => {
      const result = issueList(db, params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  server.tool(
    'issue_get',
    'Get an issue by ID',
    { id: z.string() },
    async ({ id }) => {
      const result = issueGet(db, { id });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  server.tool(
    'issue_update',
    'Update an issue',
    {
      id: z.string(),
      title: z.string().optional(),
      description: z.string().optional(),
      status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(),
      severity: z.enum(['bug', 'regression', 'warning', 'enhancement']).optional(),
      priority: z.enum(['low', 'normal', 'high', 'critical']).optional(),
      assignee: z.string().nullable().optional(),
      tags: z.array(z.string()).optional(),
      relatedTaskId: z.string().nullable().optional(),
      metadata: z.object({
        source: z.string().optional(),
        reporter: z.string().optional(),
        relatedNoteIds: z.array(z.string()).optional(),
      }).passthrough().optional(),
    },
    async (params) => {
      const result = issueUpdate(db, params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  server.tool(
    'issue_close',
    'Close an issue (shorthand for setting status to closed)',
    { id: z.string() },
    async ({ id }) => {
      const result = issueClose(db, { id });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );
}
