import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ragTool, ragOnboardTool } from "./tools.js";
import type { Env } from "./index.js";

export class GerberMcp extends McpAgent<Env> {
  server = new McpServer({ name: "gerber", version: "0.1.0" });

  async init() {
    this.server.tool(
      "rag",
      "Recherche semantique cross-projets dans le vault Gemini (FileSearchStore) puis fetch GitHub des docs cites. Retourne un Markdown structure avec sources + contenu integral, pret a etre synthetise. Ideal pour interroger specs, plans, _gerber_, docs/superpowers de tous les projets indexes.",
      {
        question: z.string().min(1).max(500),
        repo: z.string().optional(),
      },
      async (params) => {
        const markdown = await ragTool(params, this.env);
        return { content: [{ type: "text" as const, text: markdown }] };
      },
    );

    this.server.tool(
      "rag_onboard",
      "Enregistre un repo GitHub dans le vault gerber (eRom/gerber-vault/sources.yml). Idempotent : skip si deja present. Le pipeline pull-sources.yml indexera les paths whitelistes au prochain cron (15min) puis sync-rag.yml les push dans Gemini. Utilise GERBER_VAULT_HUB cote serveur, l'utilisateur n'a pas a passer de token.",
      {
        repo: z
          .string()
          .regex(/^[\w.-]+\/[\w.-]+$/, 'repo must be "owner/name"'),
        paths: z.array(z.string()).optional(),
      },
      async (params) => {
        const result = await ragOnboardTool(params, this.env);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(result, null, 2) },
          ],
        };
      },
    );
  }
}
