// Single-user OAuth 2.1 + PKCE flow.
// Same shape as the legacy SingleUserOAuthProvider (packages/mcp/src/http/oauth-provider.ts):
//   - one pre-registered (clientId, clientSecret), no DCR
//   - access_token issued at /token is the static STREAM_TOKEN (so Bearer
//     verification is identical for Managed Agents and claude.ai)
//   - authorization codes stored in KV with 2 min TTL (one-time use)

export interface OAuthEnv {
  OAUTH_KV: KVNamespace;
  STREAM_TOKEN: string;
  OAUTH_CLIENT_ID: string;
  OAUTH_CLIENT_SECRET: string;
}

const CODE_TTL_SECONDS = 120;
const TOKEN_TTL_SECONDS = 365 * 24 * 3600;

// Allowed redirect URI patterns. claude.ai/claude.com for the web/mobile
// connector, localhost/127.0.0.1 for Claude Code CLI/Desktop which use
// ephemeral local ports (http://localhost:<random>/oauth/callback).
const ALLOWED_REDIRECT_PATTERNS: RegExp[] = [
  /^https:\/\/claude\.ai\//,
  /^https:\/\/claude\.com\//,
  /^http:\/\/localhost(:\d+)?\//,
  /^http:\/\/127\.0\.0\.1(:\d+)?\//,
];

function isAllowedRedirect(uri: string): boolean {
  return ALLOWED_REDIRECT_PATTERNS.some((re) => re.test(uri));
}

interface StoredCode {
  codeChallenge: string;
  codeChallengeMethod: 'plain' | 'S256';
  redirectUri: string;
}

export async function handleAuthorize(req: Request, env: OAuthEnv): Promise<Response> {
  const u = new URL(req.url);
  const p = u.searchParams;

  if (p.get('response_type') !== 'code') {
    return Response.json({ error: 'unsupported_response_type' }, { status: 400 });
  }
  if (p.get('client_id') !== env.OAUTH_CLIENT_ID) {
    return Response.json({ error: 'invalid_client' }, { status: 400 });
  }

  const redirectUri = p.get('redirect_uri') ?? '';
  if (!isAllowedRedirect(redirectUri)) {
    return Response.json({ error: 'invalid_redirect_uri', got: redirectUri }, { status: 400 });
  }

  const codeChallenge = p.get('code_challenge');
  if (!codeChallenge) {
    return Response.json({ error: 'missing_code_challenge' }, { status: 400 });
  }
  const methodRaw = p.get('code_challenge_method') ?? 'plain';
  if (methodRaw !== 'plain' && methodRaw !== 'S256') {
    return Response.json({ error: 'invalid_code_challenge_method' }, { status: 400 });
  }

  const code = randomHex(24);
  const stored: StoredCode = {
    codeChallenge,
    codeChallengeMethod: methodRaw,
    redirectUri,
  };
  await env.OAUTH_KV.put(`code:${code}`, JSON.stringify(stored), {
    expirationTtl: CODE_TTL_SECONDS,
  });

  const target = new URL(redirectUri);
  target.searchParams.set('code', code);
  const state = p.get('state');
  if (state) target.searchParams.set('state', state);
  return Response.redirect(target.href, 302);
}

export async function handleToken(req: Request, env: OAuthEnv): Promise<Response> {
  if (req.method !== 'POST') {
    return Response.json({ error: 'method_not_allowed' }, { status: 405 });
  }

  const form = await req.formData();
  if (form.get('grant_type') !== 'authorization_code') {
    return Response.json({ error: 'unsupported_grant_type' }, { status: 400 });
  }

  const code = String(form.get('code') ?? '');
  const codeVerifier = String(form.get('code_verifier') ?? '');
  const clientId = String(form.get('client_id') ?? '');
  const clientSecret = String(form.get('client_secret') ?? '');
  const redirectUri = String(form.get('redirect_uri') ?? '');

  if (clientId !== env.OAUTH_CLIENT_ID || clientSecret !== env.OAUTH_CLIENT_SECRET) {
    return Response.json({ error: 'invalid_client' }, { status: 401 });
  }

  const raw = await env.OAUTH_KV.get(`code:${code}`);
  if (!raw) {
    return Response.json({ error: 'invalid_grant' }, { status: 400 });
  }
  await env.OAUTH_KV.delete(`code:${code}`);
  const stored = JSON.parse(raw) as StoredCode;

  if (stored.redirectUri !== redirectUri) {
    return Response.json({ error: 'invalid_grant', detail: 'redirect_uri mismatch' }, { status: 400 });
  }

  const expected =
    stored.codeChallengeMethod === 'S256' ? await sha256base64url(codeVerifier) : codeVerifier;
  if (expected !== stored.codeChallenge) {
    return Response.json({ error: 'invalid_grant', detail: 'pkce_failed' }, { status: 400 });
  }

  console.log(
    `[/token] issuing access_token (prefix=${env.STREAM_TOKEN.substring(0, 8)}..., len=${env.STREAM_TOKEN.length})`,
  );
  return Response.json({
    access_token: env.STREAM_TOKEN,
    token_type: 'Bearer',
    expires_in: TOKEN_TTL_SECONDS,
    scope: 'mcp',
  });
}

export function authServerMetadata(origin: string): Response {
  return Response.json({
    issuer: origin + '/',
    authorization_endpoint: `${origin}/authorize`,
    token_endpoint: `${origin}/token`,
    registration_endpoint: `${origin}/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    code_challenge_methods_supported: ['plain', 'S256'],
    token_endpoint_auth_methods_supported: ['client_secret_post'],
    scopes_supported: ['mcp'],
  });
}

// Dynamic Client Registration (RFC 7591) — single-user pseudo-DCR.
// We don't actually create a new client; we just return the single static
// (clientId, clientSecret) we already know about. Whatever the caller asked
// for (redirect_uris, etc.) is ignored. Any subsequent /token call with this
// clientId/clientSecret will work.
export function handleRegister(_req: Request, env: OAuthEnv): Response {
  return Response.json(
    {
      client_id: env.OAUTH_CLIENT_ID,
      client_secret: env.OAUTH_CLIENT_SECRET,
      // We don't restrict redirect_uris at registration time; the actual check
      // happens in /authorize against ALLOWED_REDIRECT_PATTERNS. Reflect the
      // client's requested URIs to keep DCR clients happy.
      redirect_uris: ['https://claude.ai/api/mcp/auth_callback'],
      grant_types: ['authorization_code'],
      response_types: ['code'],
      token_endpoint_auth_method: 'client_secret_post',
      client_id_issued_at: Math.floor(Date.now() / 1000),
    },
    { status: 201 },
  );
}

export function protectedResourceMetadata(origin: string): Response {
  return Response.json({
    resource: origin + '/',
    authorization_servers: [origin + '/'],
    scopes_supported: ['mcp'],
    bearer_methods_supported: ['header'],
    resource_name: 'gerber',
  });
}

function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256base64url(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(digest);
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
