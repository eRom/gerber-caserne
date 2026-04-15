<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/gerber-logo-dark.png">
    <source media="(prefers-color-scheme: light)" srcset="assets/gerber-logo-light.png">
    <img alt="Gerber" src="assets/gerber-logo-light.png" width="200">
  </picture>
</p>

<h1 align="center">Gerber</h1>
<p align="center">Cross-project memory & orchestration MCP server for AI coding agents.<br>Notes, tasks, issues, inter-session messages — with semantic & full-text search.<br>One brain, every agent.</p>

## Principe

![Tasks](assets/principe.png)

## Architecture

- `packages/shared/` — Constants, Drizzle schema, Zod schemas, TypeScript types
- `packages/mcp/` — MCP server (stdio + HTTP + Streamable), SQLite database, E5 embeddings, AST chunker
- `packages/ui/` — React 19 + Tailwind CSS 4 + shadcn/ui frontend
- `packages/admin/` — Rust TUI (ratatui) — manage MCP server + Cloudflare tunnel from one place

## Screenshots

### Web UI

| Tasks kanban | Task detail |
|:---:|:---:|
| ![Tasks](assets/screenshot-tasks.png) | ![Task detail](assets/screenshot-task-info.png) |

| Issues board | Memory |
|:---:|:---:|
| ![Issues](assets/screenshot-issues.png) | ![Memory](assets/screenshot-memory.png) |

### TUI  

| Home Screen | Projet view |
|:---:|:---:|
| ![Homescreen](assets/tui-home.png) | ![Project](assets/tui-projet.png) |

### Web UI


| Admin + Streamable MCP + Tunnel |
|:---:|
| ![Homescreen](assets/admin.png) |

## Installation

### Claude Code

Add to `~/.claude/mcp.json` or project `.mcp.json`:

```json
{
  "mcpServers": {
    "gerber": {
      "type": "stdio",
      "command": "node",
      "args": ["<path-to-folder>/packages/mcp/dist/index.js"]
    }
  }
}
```

### Claude Desktop - Cowork

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "gerber": {
      "command": "node",
      "args": ["<path-to-folder>/packages/mcp/dist/index.js"]
    }
  },
}
```

### OpenAI Codex CLI

Codex uses `~/.codex/config.toml` (TOML format):

```toml
[mcp_servers.gerber]
command = "node"
args = ["<path-to-folder>/packages/mcp/dist/index.js"]
enabled = true
startup_timeout_sec = 30
tool_timeout_sec = 60
```

### Google Gemini CLI

Add to `~/.gemini/settings.json` under `mcpServers`:

```json
{
  "mcpServers": {
    "gerber": {
      "command": "node",
      "args": [
        "<path-to-folder>/packages/mcp/dist/index.js"
      ]
    }
  }
}
```

### OpenCode

Add to `opencode.json` (or `opencode.jsonc`) — note the single `command` array:

```json
{
  "mcp": {
    "gerber": {
      "type": "local",
      "command": [
        "node",
        "<path-to-folder>/packages/mcp/dist/index.js"
      ],
      "enabled": true
    }
  }
}
```

### Kilo Code

Add to `~/.config/kilo/kilo.json` (global) or `./kilo.json` (project):

```json
{
  "mcpServers": {
    "gerber": {
      "type": "stdio",
      "command": "node",
      "args": [
        "<path-to-folder>/packages/mcp/dist/index.js"
      ],
      "disabled": false
    }
  }
}
```

### Cline

Edit `cline_mcp_settings.json` (VSCode → MCP Servers → Configure):

```json
{
  "mcpServers": {
    "gerber": {
      "type": "stdio",
      "command": "node",
      "args": [
        "<path-to-folder>/packages/mcp/dist/index.js"
      ]
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

## Claude Managed Agent (Streamable HTTP + Cloudflare Tunnel)

Pour connecter Gerber a un [Claude Managed Agent](https://platform.claude.com/docs/en/managed-agents/overview), il faut exposer l'adaptateur **Streamable HTTP** via un tunnel qui fournit une URL HTTPS stable.

### 1. Lancer le MCP avec l'endpoint Streamable

```bash
node packages/mcp/dist/index.js --ui --stream
# Expose /mcp/stream sur http://127.0.0.1:4000 (auth Bearer obligatoire)
```

Le token Bearer est genere et persiste sur disque a la premiere execution :
- Emplacement : `~/.config/gerber/config.json` (mode 600)
- Affichage : `pnpm mcp:token`
- Rotation : `pnpm mcp:token --rotate` (il faut ensuite mettre a jour la credential du Vault)

### 2. Exposer via Cloudflare Tunnel (URL stable requise)

> **Important :** l'URL du tunnel est **immutable** cote credential Vault Anthropic. Utiliser un **named tunnel** Cloudflare, pas un quick tunnel.

```bash
# Auth (ouvre le browser, selectionne ton domaine)
cloudflared tunnel login

# Cree un tunnel nomme
cloudflared tunnel create gerber
# → ecrit ~/.cloudflared/<uuid>.json

# Route DNS vers ton sous-domaine
cloudflared tunnel route dns gerber gerber.<hostname>
```

`~/.cloudflared/config.yml` :

```yaml
tunnel: <uuid>
credentials-file: /home/<user>/.cloudflared/<uuid>.json
ingress:
  - hostname: <hostname>
    service: http://localhost:4000
  - service: http_status:404
```

```bash
cloudflared tunnel run gerber
# https://gerber.<hostname>/mcp/stream est mappe sur localhost:4000
```>

Alternatives : tailscale funnel (URL `https://<machine>.ts.net`), ngrok reserved domain (plan payant).

## Admin TUI

Rust-based admin panel to manage MCP server + Cloudflare tunnel from a single interface.

```bash
pnpm admin
```

| Key | Action |
|-----|--------|
| `S` | Start/Stop MCP server + tunnel together |
| `B` | Build MCP package |
| `Tab` | Switch focus between log panes |
| `1` / `2` | Direct focus on MCP / Tunnel pane |
| `C` | Clear both log panes |
| `W` | Open Web UI in default browser |
| `Q` | Quit (graceful kill of both processes) |
| `Up` / `Down` | Scroll logs in focused pane |

Features:
- Split-pane layout: MCP logs (left) + tunnel logs (right)
- Color-coded structured logs: tool calls (cyan), results OK/Error (green/red), session lifecycle, auth failures
- Status bar with process states, build status, and MCP version

```bash
# Build the admin binary (release)
pnpm admin:build
```

## Database

- Location: `~/.agent-brain/brain.db` (SQLite)
- Override: `--db-path /path/to/brain.db`

## Scripts

```bash
pnpm install                    # Install all dependencies
pnpm build                      # Build all packages (shared + mcp + ui + tui)
pnpm test                       # Run all tests
pnpm typecheck                  # Type-check all packages

# Per-package builds
pnpm --filter @agent-brain/mcp build    # Build MCP server
pnpm --filter @agent-brain/ui build     # Build Web UI (React)
pnpm --filter @agent-brain/tui build    # Build Terminal UI (Ink)

# Dev mode
pnpm --filter @agent-brain/mcp dev -- --ui --db-path ~/.agent-brain/brain.db  # MCP + HTTP on :4000
pnpm --filter @agent-brain/ui dev       # Vite dev server on :5173 (proxy /mcp -> :4000)
pnpm tui                                # Launch Terminal UI
pnpm admin                              # Launch Admin TUI (MCP + tunnel control)

# Maintenance
pnpm mcp:restore <backup-path>  # Restore DB from backup
pnpm mcp:reindex                # Re-chunk all documents
pnpm mcp:token                  # Print the Streamable HTTP bearer token
```

## Plugin Claude Code

**Gerber** is available as a Claude Code plugin. It bundles the MCP server, 12 skills, 2 agents, and a startup hook in a single install.

### Install

```bash
# 1. Add the marketplace (once)
/plugin marketplace add eRom/erom-marketplace

# 2. Install the plugin
/plugin install gerber@erom-marketplace
```

### What's included

| Component | Count | Description |
|-----------|-------|-------------|
| Skills | 13 | `/gerber:onboarding`, `/gerber:capture`, `/gerber:recall`, `/gerber:archive`, `/gerber:session-complete`, `/gerber:review`, `/gerber:import`, `/gerber:inbox`, `/gerber:send`, `/gerber:task`, `/gerber:issue`, `/gerber:status`, `/gerber:vault` |
| Agents | 2 | `gerber:agent-status` (dashboard), `gerber:agent-vault` (git archive) |
| Hook | 1 | `SessionStart` — polls pending messages and inbox tasks on session start |

> **Prerequisite:** The MCP server must be configured separately (see [Installation](#installation)). The plugin provides the skills, agents, and hook that interact with it.

### Verify

After install, reload and check:

```bash
/reload-plugins         # Should list gerber in the loaded plugins
/gerber:status          # Dashboard of the current project
```

### Update

```bash
/plugin update gerber@erom-marketplace
```

> **Note:** The plugin requires the `gerber` MCP server to be running. Make sure it's configured in your `.mcp.json` (see [Installation](#installation)) before using the skills.

## Skills

**Gerber** ships with 13 slash-command skills. 

| Skill | Description |
|-------|-------------|
| `/gerber:onboarding` | Initialize a project in Gerber and configure the repo's CLAUDE.md |
| `/gerber:capture` | Quick-capture a knowledge atom (gotcha, pattern, decision) mid-session |
| `/gerber:recall` | Semantic + fulltext search across all projects |
| `/gerber:archive` | Extract and archive session learnings at session end |
| `/gerber:session-complete` | End-of-session cartography — persists `.cave/` files and chains to archive |
| `/gerber:review` | Weekly maintenance — stats, stale notes, drafts, duplicates |
| `/gerber:import` | One-shot migration from `.cave/` / `_internal/` directories |
| `/gerber:inbox` | Check pending inter-session messages |
| `/gerber:send` | Send a context or reminder message to another project |
| `/gerber:task` | Manage project tasks (kanban: inbox → done) |
| `/gerber:issue` | Manage project issues (inbox → closed) |
| `/gerber:status` | Dashboard of current project — metadata, notebook, notes/tasks/issues counts |
| `/gerber:vault` | Git-based archive vault (archive, search, status, index) — delegates to Sonnet sub-agent |

A startup hook (`hooks/gerber-poll.sh`) polls pending messages and tasks on session start. See `hooks/hooks.json` for the hook config.

> Compatible with **Claude Desktop - Cowork**

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

## Agents

Gerber includes specialized sub-agents in `agents/` that handle delegated tasks with minimal token overhead.

| Agent | Model | Description |
|-------|-------|-------------|
| `gerber:agent-vault` | Sonnet | Git-based vault archival. Copies files, generates INDEX.md, commits and pushes. Used by `/gerber:vault` skill. |

Agents are defined as markdown files with frontmatter (name, model, tools) and a system prompt. They receive a minimal prompt from the parent skill and execute autonomously.

## License

MIT
