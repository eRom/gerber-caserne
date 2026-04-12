import express from "express";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Database } from "better-sqlite3";
import { handleJsonRpc } from "./jsonrpc.js";
import type { Server } from "node:http";

let embedderReady = false;

export async function startHttpServer(
  server: McpServer,
  db: Database,
  options: { port?: number; preloadEmbedder?: boolean } = {},
): Promise<{ httpServer: Server }> {
  const app = express();
  app.use(express.json());

  app.post("/mcp", async (req, res) => {
    const result = await handleJsonRpc(server, req.body);
    res.json(result);
  });

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
