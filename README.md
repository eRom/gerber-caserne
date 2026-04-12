<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/gerber-logo-dark.png">
    <source media="(prefers-color-scheme: light)" srcset="assets/gerber-logo-light.png">
    <img alt="Gerber" src="assets/gerber-logo-light.png" width="200">
  </picture>
</p>

<h1 align="center">Gerber</h1>
<p align="center">Cross-project memory orchestration for AI agents.<br>Store, search, and retrieve knowledge with full-text and semantic search.</p>

## Quick Start

```bash
pnpm install
pnpm build
```

## Development

```bash
pnpm dev          # Start MCP stdio + UI dev servers
pnpm test         # Run all tests
pnpm typecheck    # Type-check all packages
```

## Architecture

- `packages/shared/` — Constants, Drizzle schema, Zod schemas, TypeScript types
- `packages/mcp/` — MCP server (stdio + HTTP), SQLite database, E5 embeddings, AST chunker
- `packages/ui/` — React 19 + Tailwind CSS 4 + shadcn/ui frontend

## Screenshots

| Tasks kanban | Task detail |
|:---:|:---:|
| ![Tasks](assets/screenshot-tasks.png) | ![Task detail](assets/screenshot-task-info.png) |

| Issues board | Memory |
|:---:|:---:|
| ![Issues](assets/screenshot-issues.png) | ![Memory](assets/screenshot-memory.png) |

## Claude Code Integration (stdio)

Add to your Claude Code MCP config:

```json
{
  "mcpServers": {
    "agent-brain": {
      "command": "node",
      "args": ["<path-to-repo>/packages/mcp/dist/index.js"]
    }
  }
}
```

## HTTP Mode (for UI)

```bash
node packages/mcp/dist/index.js --ui
# Serves on http://127.0.0.1:4000
```

> **Note:** `--ui` et le mode stdio ne peuvent pas coexister sur le meme process. Pour utiliser les deux, lancer deux instances separees (une sans `--ui` pour Claude Code, une avec pour le navigateur).

## Database

- Location: `~/.agent-brain/brain.db` (SQLite)
- Override: `--db-path /path/to/brain.db`

## Scripts

```bash
pnpm mcp:restore <backup-path>  # Restore from backup
pnpm mcp:reindex                # Re-chunk all documents
```

## MCP Tools

### Projects

| Tool | Description | Parametres |
|------|-------------|------------|
| `project_create` | Creer un projet | `slug` (string), `name` (string), `description?`, `repoPath?`, `color?` |
| `project_list` | Lister tous les projets | `limit?` (number), `offset?` (number) |
| `project_update` | Mettre a jour un projet | `id` (string), `slug?`, `name?`, `description?`, `repoPath?`, `color?` |
| `project_delete` | Supprimer un projet (notes reassignees a global) | `id` (string) |

### Notes

| Tool | Description | Parametres |
|------|-------------|------------|
| `note_create` | Creer une note (atom ou document) | `kind` (string), `title` (string), `content` (string), `source` (string), `tags?` (string[]), `projectId?`, `projectSlug?` |
| `note_get` | Recuperer une note par ID | `id` (string) |
| `note_update` | Mettre a jour une note | `id` (string), `title?`, `content?`, `tags?` (string[]), `status?`, `projectId?`, `projectSlug?` |
| `note_delete` | Supprimer une note | `id` (string) |
| `note_list` | Lister les notes avec filtres | `kind?`, `status?`, `source?`, `projectId?`, `projectSlug?`, `tags_any?` (string[]), `tags_all?` (string[]), `sort?`, `limit?`, `offset?` |

### Search

| Tool | Description | Parametres |
|------|-------------|------------|
| `search` | Recherche hybride/semantique/fulltext | `query` (string), `mode?` (hybrid\|semantic\|fulltext), `limit?`, `projectId?`, `kind?`, `status?`, `source?`, `tags_any?`, `tags_all?`, `neighbors?` |

### Messages (Inter-session bus)

| Tool | Description | Parametres |
|------|-------------|------------|
| `message_create` | Creer un message inter-session | `projectSlug` (string), `type` (context\|reminder), `title` (string), `content` (string), `metadata?` |
| `message_list` | Lister les messages | `projectSlug?`, `type?` (context\|reminder), `status?` (pending\|done), `since?` (timestamp), `limit?` |
| `message_update` | Mettre a jour un message | `id` (string), `status?` (pending\|done), `content?`, `metadata?` |

### Tasks

| Tool | Description | Parametres |
|------|-------------|------------|
| `task_create` | Creer une tache | `projectSlug` (string), `title` (string), `description?`, `status?` (inbox\|brainstorming\|specification\|plan\|implementation\|test\|done), `priority?` (low\|normal\|high), `assignee?`, `tags?` (string[]), `dueDate?` (timestamp), `waitingOn?`, `parentId?` (UUID subtask) |
| `task_list` | Lister les taches | `projectSlug?`, `status?`, `priority?`, `tags_any?` (string[]), `parentId?` (UUID, filtre subtasks), `sort?`, `limit?`, `offset?` |
| `task_get` | Recuperer une tache + ses subtasks | `id` (string) |
| `task_update` | Mettre a jour une tache | `id` (string), `title?`, `description?`, `status?`, `priority?`, `assignee?`, `tags?`, `dueDate?`, `waitingOn?`, `metadata?` |
| `task_delete` | Supprimer une tache et ses subtasks | `id` (string) |
| `task_reorder` | Reordonner les taches | `ids` (string[]) — nouvelle ordre de position |

### Issues

| Tool | Description | Parametres |
|------|-------------|------------|
| `issue_create` | Creer une issue | `projectSlug` (string), `title` (string), `description?`, `status?` (inbox\|in_progress\|in_review\|closed), `severity?` (bug\|regression\|warning\|enhancement), `priority?` (low\|normal\|high\|critical), `assignee?`, `tags?` (string[]), `metadata?` |
| `issue_list` | Lister les issues | `projectSlug?`, `status?` (inbox\|in_progress\|in_review\|closed), `severity?`, `priority?`, `tags_any?` (string[]), `limit?`, `offset?` |
| `issue_get` | Recuperer une issue | `id` (string) |
| `issue_update` | Mettre a jour une issue | `id` (string), `title?`, `description?`, `status?`, `severity?`, `priority?`, `assignee?`, `tags?`, `relatedTaskId?`, `metadata?` |
| `issue_close` | Fermer une issue | `id` (string) |

### Maintenance

| Tool | Description | Parametres |
|------|-------------|------------|
| `backup_brain` | Creer un backup de la DB | `label?` (string) |
| `get_stats` | Statistiques du brain | `projectId?` (string) |

## Spec & Plan

- Design spec: `docs/superpowers/specs/2026-04-08-agent-brain-mvp-design.md`
- Implementation plan: `docs/superpowers/plans/2026-04-08-agent-brain-mcp-backend.md`
