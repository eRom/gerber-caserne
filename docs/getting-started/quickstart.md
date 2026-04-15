# Quickstart

Get Gerber running and connected to Claude Code in under 5 minutes.

## Prerequisites

- Node.js 20+
- pnpm 9+

## Install

```bash
git clone https://github.com/eRom/agent-brain.git
cd agent-brain
pnpm install
pnpm build
```

The build compiles the MCP server to `packages/mcp/dist/index.js`.

## Configure Claude Code

Add Gerber to your `.mcp.json` file (at the root of your project or globally in `~/.config/claude/`):

```json
{
  "mcpServers": {
    "gerber": {
      "type": "stdio",
      "command": "node",
      "args": ["<path-to-agent-brain>/packages/mcp/dist/index.js"]
    }
  }
}
```

Replace `<path-to-agent-brain>` with the absolute path where you cloned the repo. For example: `/Users/yourname/dev/agent-brain`.

Restart Claude Code. You should see `gerber` listed in the active MCP servers.

## First Use

### 1. Create a project

Every note, task, and issue belongs to a project. Create one for your codebase:

```
Tool: project_create
Input:
  slug: "my-app"
  name: "My App"
```

Response:
```json
{
  "id": "a1b2c3d4-...",
  "slug": "my-app",
  "name": "My App",
  "createdAt": 1712345678
}
```

The `slug` is what you'll use in all subsequent tool calls — short, URL-safe, memorable.

### 2. Create a note

Capture a piece of knowledge:

```
Tool: note_create
Input:
  projectSlug: "my-app"
  kind: "atom"
  title: "Auth tokens expire after 15 minutes"
  content: "The /auth/refresh endpoint must be called before expiry. Silent refresh is handled by the axios interceptor in src/lib/api.ts."
  source: "human"
  tags: ["auth", "gotcha"]
```

Response:
```json
{
  "id": "f9e8d7c6-...",
  "projectSlug": "my-app",
  "kind": "atom",
  "title": "Auth tokens expire after 15 minutes",
  "status": "active",
  "tags": ["auth", "gotcha"],
  "createdAt": 1712345700
}
```

### 3. Search

Retrieve relevant context with a natural-language query:

```
Tool: search
Input:
  query: "token expiration auth refresh"
  projectSlug: "my-app"
```

Response:
```json
{
  "results": [
    {
      "noteId": "f9e8d7c6-...",
      "title": "Auth tokens expire after 15 minutes",
      "score": 0.91,
      "excerpt": "The /auth/refresh endpoint must be called before expiry...",
      "kind": "atom",
      "tags": ["auth", "gotcha"]
    }
  ],
  "mode": "hybrid",
  "total": 1
}
```

The default `hybrid` mode combines semantic similarity and fulltext ranking. No need to know exactly how the note was phrased.

## What's Next

- [Concepts](concepts.md) — understand projects, notes, tasks, issues, and messages in depth
- [Tools Reference](../tools/projects.md) — full list of available MCP tools with parameters
- [Plugin](../plugin/overview.md) — automatic session hooks, inbox polling, and skill integration for Claude Code
