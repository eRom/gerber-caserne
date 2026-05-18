<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/gerber-logo-dark.png">
    <source media="(prefers-color-scheme: light)" srcset="assets/gerber-logo-light.png">
    <img alt="Gerber" src="assets/gerber-logo-light.png" width="200">
  </picture>
</p>

<h1 align="center">Gerber</h1>
<p align="center">Cross-project orchestration MCP server for AI coding agents.<br>Tasks, issues, inter-session messages, handoffs, runbooks.<br>Knowledge memory delegated to the Gemini vault RAG.<br>One brain, every agent.</p>

---

## Features

- **Tasks** — 7-column kanban (inbox → done) with subtasks, priorities, due dates
- **Issues** — Bug tracking with severity levels and 4-column workflow
- **Messages** — Inter-session bus for context and reminders between projects
- **Handoffs** — Session context transfer between Claude environments (CLI, Desktop, claude.ai, mobile)
- **Runbooks** — Per-project `run_cmd`/`url`/`env` with detached process tracking
- **Vault RAG** — Cross-project knowledge search via Gemini FileSearchStore + GitHub ground-truth (`rag` tool)
- **Multi-client** — Claude Code, Claude Desktop, Gemini CLI, Codex, OpenCode, Kilo Code, Cline

## Screenshots

| Tasks kanban | Issues board |
|:---:|:---:|
| ![Tasks](assets/screenshot-tasks.png) | ![Issues](assets/screenshot-issues.png) |

## Quick Install (Claude Code)

Starting with v2.0.0, gerber ships as a **remote MCP** hosted on a private VPS — no local install, no `pnpm build`.

```
/plugin install gerber@erom-marketplace
/reload-plugins
/gerber:onboarding
```

`/gerber:onboarding` will prompt for a bearer token (single-user, single-instance) and persist it in `~/.claude/settings.local.json` so the bundled `.mcp.json` can authenticate against `https://gerber.romain-ecarnot.com/mcp/stream`.

If you want to run the MCP server locally instead, clone the repo and follow the legacy stdio pattern from v1.x — but the plugin's `.mcp.json` is now hard-wired to the remote URL.

## Documentation

**[Read the full documentation →](https://docs-gerber.romain-ecarnot.com)**

Covers installation for all clients, tools reference (31 MCP tools), plugin setup (skills, agents), deployment (HTTP, Claude Managed Agent), architecture, and contributing guide.

## License

MIT
