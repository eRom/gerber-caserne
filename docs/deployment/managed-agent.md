# Managed Agent (Streamable HTTP)

Gerber supports the **official MCP Streamable HTTP transport**, which enables it to run as a remotely-hosted MCP server that Claude can reach autonomously — a **Claude Managed Agent**.

This is one of Gerber's key differentiators: your personal knowledge base, tasks, and issues become a first-class tool available to any Claude session, without manual copy-paste or context injection.

## What are Claude Managed Agents?

Claude Managed Agents are MCP servers hosted at a stable HTTPS URL. Claude connects to them directly over the network, allowing it to use your tools across sessions, projects, and even from Claude.ai in the browser.

Official documentation: https://docs.anthropic.com/en/docs/agents-and-tools/managed-agents

## Streamable HTTP Transport

Enable the Streamable HTTP transport by combining the `--ui` and `--stream` flags:

```bash
node packages/mcp/dist/index.js --ui --stream
```

This exposes **two distinct endpoints** on port 4000:

| Endpoint | Purpose |
|----------|---------|
| `/mcp` | JSON-RPC bridge — Web UI only |
| `/mcp/stream` | Streamable HTTP — Managed Agents (Bearer auth required) |

> **Do not confuse these two endpoints.** `/mcp` is a custom bridge for the browser interface. `/mcp/stream` is the official MCP Streamable HTTP transport for remote agents. They are completely separate code paths.

## Authentication

All requests to `/mcp/stream` require a **Bearer token**.

The token is auto-generated on first run and persisted to disk:

- **Location:** `~/.config/gerber/config.json` (file mode `600`)
- **Display current token:**
  ```bash
  pnpm mcp:token
  ```
- **Rotate token:**
  ```bash
  pnpm mcp:token --rotate
  ```

> **After rotating**, you must update the Bearer token in your Anthropic Vault credential. The old token is immediately invalidated.

## Launch

```bash
node packages/mcp/dist/index.js --ui --stream
# Exposes:
#   /mcp        → JSON-RPC bridge (Web UI)
#   /mcp/stream → Streamable HTTP (Managed Agents, Bearer auth)
```

## Cloudflare Tunnel Setup

Anthropic's Vault stores your `mcp_server_url` as an **immutable credential**. This means the tunnel URL you register cannot change after the fact.

> **Critical:** You MUST use a **named tunnel** with a stable, reserved domain. Never use a Cloudflare quick tunnel (`cloudflared tunnel --url ...`) — quick tunnel URLs are ephemeral and will break your Managed Agent credential permanently.

### Step 1 — Authenticate

```bash
cloudflared tunnel login
```

This opens a browser window. Authorize the Cloudflare account that manages your domain.

### Step 2 — Create a named tunnel

```bash
cloudflared tunnel create gerber
# Creates ~/.cloudflared/<uuid>.json
```

Note the UUID printed by this command — you will need it in the config file.

### Step 3 — Route DNS

```bash
cloudflared tunnel route dns gerber gerber.yourdomain.com
```

This creates a `CNAME` record in your Cloudflare DNS pointing `gerber.yourdomain.com` to the tunnel.

### Step 4 — Configure

Create `~/.cloudflared/config.yml`:

```yaml
tunnel: <uuid>
credentials-file: /home/<user>/.cloudflared/<uuid>.json
ingress:
  - hostname: gerber.yourdomain.com
    service: http://localhost:4000
  - service: http_status:404
```

Replace `<uuid>` and `<user>` with the values from Step 2.

### Step 5 — Run

```bash
cloudflared tunnel run gerber
```

Your Streamable HTTP endpoint is now live at:

```
https://gerber.yourdomain.com/mcp/stream
```

### Run as a service (optional)

```bash
# macOS
sudo cloudflared service install
sudo launchctl start com.cloudflare.cloudflared

# Linux (systemd)
sudo cloudflared service install
sudo systemctl start cloudflared
```

## Alternatives to Cloudflare

If you do not use Cloudflare, two alternatives can provide a stable public HTTPS URL:

- **Tailscale Funnel** — exposes a local port to the public internet via your Tailscale node:
  ```bash
  tailscale funnel 4000
  # Accessible at https://<machine>.ts.net/mcp/stream
  ```
  The URL is stable as long as your machine name does not change.

- **ngrok reserved domain** — requires an ngrok paid plan. Free ngrok tunnels use ephemeral URLs and are **not suitable** for Managed Agent credentials.

## Registering in Anthropic Console

Once your tunnel is live:

1. Go to [Anthropic Console](https://console.anthropic.com) → **Managed Agents** → **Add credential**
2. Set the server URL to `https://gerber.yourdomain.com/mcp/stream`
3. Set auth type to **Bearer token**
4. Paste the token from `pnpm mcp:token`

The URL is stored immutably. If it ever changes (e.g., domain migration), you must delete and recreate the credential.

## Verification

Test the full chain end-to-end before registering in the Console:

```bash
# 1. Confirm the endpoint responds
curl -H "Authorization: Bearer $(pnpm mcp:token --quiet)" \
     https://gerber.yourdomain.com/mcp/stream

# 2. Confirm tools are listed (MCP initialize + tools/list)
curl -s -X POST \
     -H "Authorization: Bearer $(pnpm mcp:token --quiet)" \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"0"}}}' \
     https://gerber.yourdomain.com/mcp/stream
```

A successful response to the second command returns the server's capabilities object, confirming that authentication, tunneling, and the MCP transport are all working correctly.
