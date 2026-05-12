import express from "express";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  mcpAuthRouter,
  getOAuthProtectedResourceMetadataUrl,
} from "@modelcontextprotocol/sdk/server/auth/router.js";
import type { Database } from "better-sqlite3";
import { handleJsonRpc } from "./jsonrpc.js";
import { mountStreamableHttp } from "./streamable.js";
import { SingleUserOAuthProvider } from "./oauth-provider.js";
import { getOAuthClient, getPublicUrl } from "../config/user-config.js";
import { registerAllTools } from "../tools/index.js";
import type { Server } from "node:http";

let embedderReady = false;

// Minimal permissive CORS — required for claude.ai to call /mcp/stream,
// /.well-known/* and /authorize from the browser.
const corsMiddleware: express.RequestHandler = (req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Authorization, Content-Type, mcp-session-id, mcp-protocol-version",
  );
  res.setHeader("Access-Control-Expose-Headers", "WWW-Authenticate, mcp-session-id");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
};

export async function startHttpServer(
  server: McpServer,
  db: Database,
  options: {
    port?: number;
    preloadEmbedder?: boolean;
    exposeStream?: boolean;
    streamToken?: string;
  } = {},
): Promise<{ httpServer: Server }> {
  const app = express();
  app.use(corsMiddleware);
  app.use(express.json());

  // JSON-RPC bridge — same bearer-auth protection as /mcp/stream when a
  // token is configured. Without auth, the bridge would expose every
  // gerber tool (notes, search, project_*) on the public internet once
  // the server is fronted by a reverse proxy.
  app.post("/mcp", async (req, res) => {
    if (options.streamToken) {
      const header = req.header("authorization") ?? "";
      if (header !== `Bearer ${options.streamToken}`) {
        res.status(401).json({
          jsonrpc: "2.0",
          id: null,
          error: { code: -32001, message: "Unauthorized" },
        });
        return;
      }
    }
    const result = await handleJsonRpc(server, req.body);
    res.json(result);
  });

  // Healthcheck — declared BEFORE mcpAuthRouter so it isn't intercepted
  // by the OAuth router's catch-all responses (mcpAuthRouter exposes its
  // own schema responses on a few paths and will swallow /health if mounted
  // first). Needed for Docker HEALTHCHECK + Traefik probes from outside.
  app.get("/health", (_req, res) => {
    try {
      db.prepare('SELECT 1 AS ok').get();
      res.json({ ok: true, embedderReady, dbPath: db.name });
    } catch (err) {
      res.status(503).json({ ok: false, embedderReady, error: (err as Error).message });
    }
  });

  // When OAuth is enabled (publicUrl configured + streamable transport exposed),
  // mount the MCP OAuth authorization server at the root BEFORE the SPA
  // fallback. claude.ai's custom connector uses this flow. If publicUrl is
  // missing, OAuth is silently skipped and only Managed Agents (Vault Bearer)
  // can reach /mcp/stream.
  const publicUrl = getPublicUrl();
  let resourceMetadataUrl: string | undefined;
  if (options.exposeStream && publicUrl && options.streamToken) {
    const { clientId, clientSecret } = getOAuthClient();
    const provider = new SingleUserOAuthProvider({
      clientId,
      clientSecret,
      accessToken: options.streamToken,
    });
    const issuerUrl = new URL(publicUrl);
    app.use(
      mcpAuthRouter({
        provider,
        issuerUrl,
        resourceServerUrl: issuerUrl,
        scopesSupported: ["mcp"],
        resourceName: "gerber",
      }),
    );
    resourceMetadataUrl = getOAuthProtectedResourceMetadataUrl(issuerUrl);
    console.log(
      `OAuth authorization server mounted (issuer: ${issuerUrl.href}, client_id: ${clientId})`,
    );
  }

  if (options.exposeStream) {
    const streamOpts: { token?: string; resourceMetadataUrl?: string } = {};
    if (options.streamToken !== undefined) streamOpts.token = options.streamToken;
    if (resourceMetadataUrl !== undefined) streamOpts.resourceMetadataUrl = resourceMetadataUrl;
    // Factory: each Streamable HTTP session gets its own McpServer because
    // the SDK only allows one transport per Protocol instance.
    const serverFactory = () => {
      const s = new McpServer({ name: 'gerber', version: '0.1.0' });
      registerAllTools(s, db);
      return s;
    };
    mountStreamableHttp(app, serverFactory, streamOpts);
  }

  // Serve UI static files (built by packages/ui)
  const uiDistPath = resolve(import.meta.dirname ?? __dirname, "../../ui/dist");
  if (existsSync(uiDistPath)) {
    app.use(express.static(uiDistPath));
    // SPA fallback: serve index.html for all non-API routes
    app.get("/{*path}", (_req, res) => {
      res.sendFile(resolve(uiDistPath, "index.html"));
    });
  } else {
    app.get("/", (_req, res) => {
      res.send(
        "<html><body><h1>gerber</h1><p>UI not built. Run: pnpm --filter @gerber-caserne/ui build</p></body></html>",
      );
    });
  }

  const port = options.port ?? (Number(process.env.PORT) || 4000);
  const bindHost = process.env.GERBER_BIND_HOST ?? "127.0.0.1";

  return new Promise((resolve) => {
    const httpServer = app.listen(port, bindHost, () => {
      if (port !== 0) {
        console.log(
          `gerber HTTP server listening on http://${bindHost}:${port}`,
        );
      }

      // After listen, fire-and-forget embedder preload
      if (options.preloadEmbedder !== false) {
        import("../embeddings/pipeline.js").then(({ getEmbeddingPipeline }) => {
          getEmbeddingPipeline()
            .then(() => {
              embedderReady = true;
              console.log("Embedder preloaded and ready");
            })
            .catch((err) => {
              console.error("Embedder preload failed:", err.message);
            });
        });
      }

      resolve({ httpServer });
    });
  });
}

export function setEmbedderReady(ready: boolean) {
  embedderReady = ready;
}
