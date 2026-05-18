import { GerberMcp } from './mcp-agent.js';
import {
  handleAuthorize,
  handleToken,
  authServerMetadata,
  protectedResourceMetadata,
} from './oauth.js';

// Augment the global Cloudflare.Env so McpAgent (which expects
// `Env extends Cloudflare.Env`) sees our bindings + secrets.
declare global {
  namespace Cloudflare {
    interface Env {
      MCP_OBJECT: DurableObjectNamespace<GerberMcp>;
      OAUTH_KV: KVNamespace;
      STREAM_TOKEN: string;
      OAUTH_CLIENT_ID: string;
      OAUTH_CLIENT_SECRET: string;
      VAULT_EMBED_API_KEY: string;
      VAULT_CORPUS_NAME: string;
      VAULT_GERBER_PAT: string;
      VAULT_GERBER_HUB: string;
    }
  }
}

export type Env = Cloudflare.Env;

export { GerberMcp };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, DELETE',
  'Access-Control-Allow-Headers':
    'Authorization, Content-Type, mcp-session-id, mcp-protocol-version',
  'Access-Control-Expose-Headers': 'WWW-Authenticate, mcp-session-id',
};

function withCors(res: Response): Response {
  const h = new Headers(res.headers);
  for (const [k, v] of Object.entries(CORS)) h.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}

function unauthorized(origin: string): Response {
  return withCors(
    new Response('unauthorized', {
      status: 401,
      headers: {
        'WWW-Authenticate': `Bearer realm="gerber", resource_metadata="${origin}/.well-known/oauth-protected-resource"`,
      },
    }),
  );
}

const mcpFetch = GerberMcp.serve('/mcp/stream').fetch;

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    switch (url.pathname) {
      case '/health':
        return withCors(Response.json({ ok: true }));

      case '/.well-known/oauth-authorization-server':
        return withCors(authServerMetadata(url.origin));

      case '/.well-known/oauth-protected-resource':
        return withCors(protectedResourceMetadata(url.origin));

      case '/authorize':
        return withCors(await handleAuthorize(request, env));

      case '/token':
        return withCors(await handleToken(request, env));

      case '/mcp/stream': {
        if (request.headers.get('Authorization') !== `Bearer ${env.STREAM_TOKEN}`) {
          return unauthorized(url.origin);
        }
        const res = await mcpFetch(request, env, ctx);
        return withCors(res);
      }

      default:
        return withCors(new Response('not_found', { status: 404 }));
    }
  },
} satisfies ExportedHandler<Env>;
