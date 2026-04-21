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

  app.post("/mcp", async (req, res) => {
    const result = await handleJsonRpc(server, req.body);
    res.json(result);
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

  app.get("/health", (_req, res) => {
    res.json({ embedderReady, dbPath: db.name, update: "Manuel" });
  });

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
        "<html><body><h1>gerber</h1><p>UI not built. Run: pnpm --filter @agent-brain/ui build</p></body></html>",
      );
    });
  }

  const port = options.port ?? (Number(process.env.PORT) || 4000);

  return new Promise((resolve) => {
    const httpServer = app.listen(port, "127.0.0.1", () => {
      if (port !== 0) {
        console.log(
          `gerber HTTP server listening on http://127.0.0.1:${port}`,
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
