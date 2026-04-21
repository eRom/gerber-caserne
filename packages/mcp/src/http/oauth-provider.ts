import type { Response } from 'express';
import { randomBytes } from 'node:crypto';
import type { OAuthServerProvider, AuthorizationParams } from '@modelcontextprotocol/sdk/server/auth/provider.js';
import type { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js';
import type { OAuthClientInformationFull, OAuthTokens } from '@modelcontextprotocol/sdk/shared/auth.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';

/**
 * Single-user OAuth 2.1 provider for gerber.
 *
 * Designed for the claude.ai custom connector UI, where the user manually
 * pre-registers one (client_id, client_secret) pair. Dynamic Client
 * Registration is intentionally not implemented. Consent UI is also skipped
 * (the single user authorizes themselves implicitly).
 *
 * The access token returned by `/token` is the same static `streamToken`
 * already used by Managed Agents (persisted in ~/.config/gerber/config.json),
 * so the existing Bearer check on /mcp/stream keeps working unchanged.
 */

interface CodeRecord {
  codeChallenge: string;
  redirectUri: string;
  resource?: URL;
  expiresAt: number;
}

const CODE_TTL_MS = 2 * 60 * 1000; // 2 minutes
const TOKEN_TTL_SECONDS = 365 * 24 * 3600; // effectively never expires

export interface SingleUserProviderOptions {
  /** Pre-registered client_id (from ~/.config/gerber/config.json). */
  clientId: string;
  /** Pre-registered client_secret. */
  clientSecret: string;
  /** Access token handed out on successful code exchange. Reused across sessions. */
  accessToken: string;
  /**
   * Redirect URIs whitelisted for this client. claude.ai uses
   * `https://claude.ai/api/mcp/auth_callback`; we also accept the desktop
   * variant and a loopback for local testing.
   */
  redirectUris?: string[];
}

export class SingleUserOAuthProvider implements OAuthServerProvider {
  private readonly client: OAuthClientInformationFull;
  private readonly accessToken: string;
  private readonly codes = new Map<string, CodeRecord>();

  constructor(opts: SingleUserProviderOptions) {
    this.accessToken = opts.accessToken;
    this.client = {
      client_id: opts.clientId,
      client_secret: opts.clientSecret,
      redirect_uris: opts.redirectUris ?? [
        'https://claude.ai/api/mcp/auth_callback',
        'https://claude.com/api/mcp/auth_callback',
      ],
      grant_types: ['authorization_code'],
      response_types: ['code'],
      token_endpoint_auth_method: 'client_secret_post',
      client_name: 'claude.ai (gerber connector)',
    };
  }

  get clientsStore(): OAuthRegisteredClientsStore {
    const client = this.client;
    return {
      async getClient(clientId: string) {
        return clientId === client.client_id ? client : undefined;
      },
      // `registerClient` intentionally omitted — DCR is not supported.
    };
  }

  async authorize(
    _client: OAuthClientInformationFull,
    params: AuthorizationParams,
    res: Response,
  ): Promise<void> {
    // Single-user server: no consent UI. Issue the code immediately.
    this.pruneExpired();
    const code = randomBytes(24).toString('hex');
    const record: CodeRecord = {
      codeChallenge: params.codeChallenge,
      redirectUri: params.redirectUri,
      expiresAt: Date.now() + CODE_TTL_MS,
    };
    if (params.resource) record.resource = params.resource;
    this.codes.set(code, record);

    const target = new URL(params.redirectUri);
    target.searchParams.set('code', code);
    if (params.state) target.searchParams.set('state', params.state);
    res.redirect(302, target.href);
  }

  async challengeForAuthorizationCode(
    _client: OAuthClientInformationFull,
    authorizationCode: string,
  ): Promise<string> {
    const record = this.codes.get(authorizationCode);
    if (!record || record.expiresAt < Date.now()) {
      throw new Error('Authorization code invalid or expired');
    }
    return record.codeChallenge;
  }

  async exchangeAuthorizationCode(
    _client: OAuthClientInformationFull,
    authorizationCode: string,
    _codeVerifier?: string,
    redirectUri?: string,
    _resource?: URL,
  ): Promise<OAuthTokens> {
    const record = this.codes.get(authorizationCode);
    if (!record || record.expiresAt < Date.now()) {
      this.codes.delete(authorizationCode);
      throw new Error('Authorization code invalid or expired');
    }
    if (redirectUri !== undefined && redirectUri !== record.redirectUri) {
      throw new Error('redirect_uri mismatch');
    }
    this.codes.delete(authorizationCode);

    return {
      access_token: this.accessToken,
      token_type: 'Bearer',
      expires_in: TOKEN_TTL_SECONDS,
      scope: 'mcp',
    };
  }

  async exchangeRefreshToken(): Promise<OAuthTokens> {
    throw new Error('refresh_token grant not supported');
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    if (token !== this.accessToken) {
      throw new Error('Invalid access token');
    }
    return {
      token,
      clientId: this.client.client_id,
      scopes: ['mcp'],
      expiresAt: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
    };
  }

  private pruneExpired(): void {
    const now = Date.now();
    for (const [code, rec] of this.codes) {
      if (rec.expiresAt < now) this.codes.delete(code);
    }
  }
}
