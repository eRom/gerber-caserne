# Admin TUI

The admin TUI is a Rust-based terminal panel built with [ratatui](https://github.com/ratatui-org/ratatui). It manages the MCP server and Cloudflare tunnel from a single interface, with color-coded structured logs and real-time status.

## Launching

```bash
pnpm admin
```

## Layout

Split-pane terminal view:

- **Left pane** — MCP server logs (structured, color-coded)
- **Right pane** — Cloudflare tunnel logs

A status bar at the bottom shows process states, build status, and the running MCP version.

## Keybindings

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

## Log Colors

Structured MCP logs are color-coded for fast scanning:

| Color | Meaning |
|-------|---------|
| Cyan | Tool calls |
| Green | Results OK |
| Red | Errors |
| Default | Session lifecycle events, auth failures |

## Screenshot

![Admin TUI](../assets/admin.png)

## Building the Release Binary

```bash
pnpm admin:build
```

Compiles an optimized release binary via `cargo build --release` inside `packages/gerber-admin/`.
