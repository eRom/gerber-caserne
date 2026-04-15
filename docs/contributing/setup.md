# Developer Setup

## Prerequisites

- **Node.js 20+**
- **pnpm 9+** — `npm install -g pnpm`
- **Rust toolchain** (admin TUI only) — `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`

## Clone and Install

```bash
git clone https://github.com/eRom/agent-brain.git
cd agent-brain
pnpm install
```

> `.npmrc` includes `shamefully-hoist=true`, which is required for some native dependencies. Do not remove it.

## Build All Packages

```bash
pnpm build
```

## Dev Mode

| Package | Command | Port |
|---------|---------|------|
| MCP server | `pnpm --filter @agent-brain/mcp dev -- --ui --db-path ~/.agent-brain/brain.db` | 4000 |
| Web UI | `pnpm --filter @agent-brain/ui dev` | 5173 (proxies `/mcp` → `:4000`) |
| Terminal UI | `pnpm tui` | — |
| Admin TUI | `pnpm admin` | — |

## Tests and Type Checks

```bash
pnpm test        # Run all tests
pnpm typecheck   # Type-check all packages
```

## Per-Package Builds

```bash
pnpm --filter @agent-brain/mcp build
pnpm --filter @agent-brain/ui build
pnpm --filter @agent-brain/tui build
```

## Project Structure

| Package | Path | Description |
|---------|------|-------------|
| shared | `packages/shared/` | Drizzle schema, Zod schemas, TypeScript types, constants |
| mcp | `packages/mcp/` | MCP server, SQLite DB, E5 embeddings, Express 5 HTTP |
| ui | `packages/ui/` | React 19 + Tailwind 4 + shadcn/ui web frontend |
| tui | `packages/tui/` | Ink-based terminal UI |
| admin | `packages/admin/` | Rust TUI (ratatui) for server management |
