import { describe, it, expect, beforeEach } from 'vitest';
import { getStreamToken, getOAuthClient, getPublicUrl } from '../../config/user-config.js';

describe('user-config env vars priority', () => {
  beforeEach(() => {
    delete process.env.GERBER_BEARER_TOKEN;
    delete process.env.GERBER_OAUTH_CLIENT_ID;
    delete process.env.GERBER_OAUTH_CLIENT_SECRET;
    delete process.env.GERBER_PUBLIC_URL;
  });

  it('getStreamToken reads GERBER_BEARER_TOKEN when set', () => {
    process.env.GERBER_BEARER_TOKEN = 'env-token-xyz';
    expect(getStreamToken()).toBe('env-token-xyz');
  });

  it('getOAuthClient reads env vars when both set', () => {
    process.env.GERBER_OAUTH_CLIENT_ID = 'env-id';
    process.env.GERBER_OAUTH_CLIENT_SECRET = 'env-secret';
    const c = getOAuthClient();
    expect(c.clientId).toBe('env-id');
    expect(c.clientSecret).toBe('env-secret');
  });

  it('getPublicUrl reads GERBER_PUBLIC_URL when set', () => {
    process.env.GERBER_PUBLIC_URL = 'https://test.example.com';
    expect(getPublicUrl()).toBe('https://test.example.com');
  });
});
