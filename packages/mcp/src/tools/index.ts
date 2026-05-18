import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Database } from 'better-sqlite3';
import { z } from 'zod';
import { ragTool, ragOnboardTool } from './rag.js';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function registerAllTools(server: McpServer, _db: Database) {
  // Vault RAG cross-projets (Gemini FileSearchStore + fetch GitHub)
  server.tool(
    'rag',
    'Recherche sémantique cross-projets dans le vault Gemini (FileSearchStore) puis fetch GitHub des docs cités. Retourne un Markdown structuré avec sources + contenu intégral, prêt à être synthétisé. Idéal pour interroger specs, plans, .cave, docs/superpowers de tous les projets indexés.',
    {
      question: z.string().min(1).max(500),
      repo: z.string().optional(),
    },
    async (params) => {
      const markdown = await ragTool(params);
      return { content: [{ type: 'text' as const, text: markdown }] };
    },
  );

  // Onboard un satellite dans le vault gerber (PUT sources.yml)
  server.tool(
    'rag_onboard',
    "Enregistre un repo GitHub dans le vault gerber (eRom/gerber-vault/sources.yml). Idempotent : skip si déjà présent. Le pipeline pull-sources.yml indexera les paths whitelistés au prochain cron (15min) puis sync-rag.yml les push dans Gemini. Utilise GERBER_VAULT_HUB côté serveur, l'utilisateur n'a pas à passer de token.",
    {
      repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/, 'repo must be "owner/name"'),
      paths: z.array(z.string()).optional(),
    },
    async (params) => {
      const result = await ragOnboardTool(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

}
