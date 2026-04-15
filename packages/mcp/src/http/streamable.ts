import type express from 'express';
import { randomUUID } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';

/**
 * Mount the MCP Streamable HTTP transport on the provided Express app.
 *
 * This is the endpoint consumed by Anthropic Managed Agents (`type: "url"`
 * in the `mcp_servers` array). It is SEPARATE from the JSON-RPC bridge on
 * `/mcp` that the UI uses. Do not merge the two paths.
 *
 * Auth: if `token` is set, every request must carry
 * `Authorization: Bearer <token>`. For Managed Agents, that token is injected
 * by the Vault credential (`static_bearer`) bound to the exact
 * `mcp_server_url` of this endpoint.
 *
 * Stateful mode only: every `initialize` spawns a new transport stored by
 * `mcp-session-id`. The session id is generated with `randomUUID`.
 */
export interface MountStreamableOptions {
  /** Path for the streamable endpoint (default `/mcp/stream`). */
  path?: string;
  /** Bearer token. When set, requests without a matching `Authorization` header are rejected with 401. */
  token?: string;
}

export function mountStreamableHttp(
  app: express.Express,
  server: McpServer,
  opts: MountStreamableOptions = {},
): { path: string; transports: Record<string, StreamableHTTPServerTransport> } {
  const path = opts.path ?? '/mcp/stream';
  const transports: Record<string, StreamableHTTPServerTransport> = {};

  const auth: express.RequestHandler = (req, res, next) => {
    if (!opts.token) return next();
    const header = req.header('authorization') ?? '';
    if (header !== `Bearer ${opts.token}`) {
      res.status(401).json({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32001, message: 'Unauthorized' },
      });
      return;
    }
    next();
  };

  app.post(path, auth, async (req, res) => {
    try {
      const sessionId = req.header('mcp-session-id');
      let transport: StreamableHTTPServerTransport;

      if (sessionId && transports[sessionId]) {
        transport = transports[sessionId];
      } else if (!sessionId && isInitializeRequest(req.body)) {
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (id: string) => {
            transports[id] = transport;
          },
        });
        transport.onclose = () => {
          const sid = transport.sessionId;
          if (sid && transports[sid]) delete transports[sid];
        };
        // `StreamableHTTPServerTransport` declares callbacks with an explicit
        // `| undefined` union; the `Transport` interface uses truly optional
        // properties. Under `exactOptionalPropertyTypes`, this requires a cast.
        await server.connect(transport as Transport);
      } else {
        res.status(400).json({
          jsonrpc: '2.0',
          id: null,
          error: { code: -32000, message: 'Bad Request: No valid session id or initialize request' },
        });
        return;
      }

      await transport.handleRequest(req, res, req.body);
    } catch (err: any) {
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          id: null,
          error: { code: -32603, message: err?.message ?? 'Internal error' },
        });
      }
    }
  });

  app.get(path, auth, async (req, res) => {
    const sessionId = req.header('mcp-session-id');
    if (!sessionId || !transports[sessionId]) {
      res.status(400).send('Invalid or missing session id');
      return;
    }
    try {
      await transports[sessionId]!.handleRequest(req, res);
    } catch (err: any) {
      if (!res.headersSent) res.status(500).send(err?.message ?? 'Internal error');
    }
  });

  app.delete(path, auth, async (req, res) => {
    const sessionId = req.header('mcp-session-id');
    if (!sessionId || !transports[sessionId]) {
      res.status(400).send('Invalid or missing session id');
      return;
    }
    try {
      await transports[sessionId]!.handleRequest(req, res);
    } catch (err: any) {
      if (!res.headersSent) res.status(500).send(err?.message ?? 'Internal error');
    }
  });

  return { path, transports };
}
