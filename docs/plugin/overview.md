# Plugin Overview

The Gerber plugin for Claude Code bundles everything needed to use Gerber from your editor in a single install: 13 slash commands, 2 sub-agents, and a `SessionStart` hook that surfaces pending messages and tasks automatically.

## Prerequisites

The MCP server must be running and configured before installing the plugin. See the [Installation](../installation/) section.

## Installation

```bash
# Add the marketplace (once)
/plugin marketplace add eRom/erom-marketplace

# Install the plugin
/plugin install gerber@erom-marketplace
```

## Verify

```bash
/reload-plugins         # Should list gerber
/gerber:status          # Dashboard of the current project
```

## Update

```bash
/plugin update gerber@erom-marketplace
```

## Compatibility

Compatible with Claude Desktop Cowork.

## What's Included

| Component | Count | Description |
|-----------|-------|-------------|
| Skills | 13 | Slash commands for common workflows |
| Agents | 2 | Specialized sub-agents for dashboard and vault archival |
| Hook | 1 | SessionStart — polls pending messages and inbox tasks |

The `SessionStart` hook runs automatically at the start of every Claude Code session. If the current project is registered in Gerber, it checks for pending messages, inbox tasks, and inbox issues, then prints a summary so you don't miss anything before diving into work.
