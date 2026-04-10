import express from 'express';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Database } from 'better-sqlite3';
import { handleJsonRpc } from './jsonrpc.js';
import type { Server } from 'node:http';

let embedderReady = false;

export async function startHttpServer(
  server: McpServer,
  db: Database,
  options: { port?: number; preloadEmbedder?: boolean } = {},
): Promise<{ httpServer: Server }> {
  const app = express();
  app.use(express.json());

  app.post('/mcp', async (req, res) => {
    const result = await handleJsonRpc(server, req.body);
    res.json(result);
  });

  app.get('/health', (_req, res) => {
    res.json({ embedderReady, dbPath: db.name });
  });

  // Stub for UI (Plan B)
  app.get('/', (_req, res) => {
    res.send('<html><body><h1>agent-brain</h1><p>UI not built — run Plan B</p></body></html>');
  });

  const port = options.port ?? (Number(process.env.PORT) || 4000);

  return new Promise((resolve) => {
    const httpServer = app.listen(port, '127.0.0.1', () => {
      if (port !== 0) {
        console.log(`agent-brain HTTP server listening on http://127.0.0.1:${port}`);
      }

      // After listen, fire-and-forget embedder preload
      if (options.preloadEmbedder !== false) {
        import('../embeddings/pipeline.js').then(({ getEmbeddingPipeline }) => {
          getEmbeddingPipeline().then(() => {
            embedderReady = true;
            console.log('Embedder preloaded and ready');
          }).catch(err => {
            console.error('Embedder preload failed:', err.message);
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
