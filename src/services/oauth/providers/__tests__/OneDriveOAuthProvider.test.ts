/**
 * Unit tests for OneDriveOAuthProvider
 * Tests OAuth provider interface compliance, URL building, token exchange,
 * token refresh, and token validation.
 *
 * Requirements: 2.2, 2.7, 2.9
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import * as fc from 'fast-check';
import { OneDriveOAuthProvider } from '../OneDriveOAuthProvider';
import type { OAuthTokens } from '../../interfaces';

// Mock global fetch
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

describe('OneDriveOAuthProvider', () => {
  let provider: OneDriveOAuthProvider;
  const testClientId = 'test-onedrive-client-id-12345';
  const testClientSecret = 'test-onedrive-client-secret-12345';

  beforeEach(() => {
    provider = new OneDriveOAuthProvider(testClientId, testClientSecret);
    mockFetch.mockReset();
  });

  describe('Provider properties', () => {
    test('has correct name and displayName', () => {
      expect(provider.name).toBe('onedrive');
      expect(provider.displayName).toBe('OneDrive');
    });

    test('has correct Microsoft OAuth endpoints', () => {
      expect(provider.authorizationUrl).toBe('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
      expect(provider.tokenUrl).toBe('https://login.microsoftonline.com/common/oauth2/v2.0/token');
    });

    test('has correct scopes including Files.ReadWrite.AppFolder and offline_access', () => {
      expect(Array.isArray(provider.scope)).toBe(true);
      expect(provider.scope).toContain('Files.ReadWrite.AppFolder');
      expect(provider.scope).toContain('offline_access');
    });

    test('stores clientId correctly', () => {
      expect(provider.clientId).toBe(testClientId);
    });

    test('constructor throws for empty client ID', () => {
      expect(() => new OneDriveOAuthProvider('')).toThrow('OneDrive OAuth client ID is required');
    });

    test('constructor accepts config object', () => {
      const config = {
        clientId: testClientId,
        clientSecret: testClientSecret,
        scope: ['Files.ReadWrite.AppFolder', 'offline_access'],
        enabled: true
      };
      const configProvider = new OneDriveOAuthProvider(config);
      expect(configProvider.clientId).toBe(testClientId);
      expect(configProvider.scope).toEqual(['Files.ReadWrite.AppFolder', 'offline_access']);
    });
  });

  describe('buildAuthUrl()', () => {
    test('produces correct URL with all required parameters', () => {
      const redirectUri = 'http://localhost:3024/onedrive-oauth-callback.html';
      const state = 'test-state-abc123';
      const codeChallenge = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';

      const authUrl = provider.buildAuthUrl(redirectUri, state, codeChallenge);
      const url = new URL(authUrl);

      expect(url.protocol).toBe('https:');
      expect(url.hostname).toBe('login.microsoftonline.com');
      expect(url.pathname).toBe('/common/oauth2/v2.0/authorize');

      const params = url.searchParams;
      expect(params.get('client_id')).toBe(testClientId);
      expect(params.get('redirect_uri')).toBe(redirectUri);
      expect(params.get('response_type')).toBe('code');
      expect(params.get('state')).toBe(state);
      expect(params.get('code_challenge')).toBe(codeChallenge);
      expect(params.get('code_challenge_method')).toBe('S256');
      expect(params.get('scope')).toBe('Files.ReadWrite.AppFolder offline_access');
    });

    test('property: buildAuthUrl generates valid URLs with arbitrary inputs', () => {
      fc.assert(
        fc.property(
          fc.webUrl(),
          fc.string({ minLength: 10, maxLength: 50 }),
          fc.string({ minLength: 43, maxLength: 128 }),
          (redirectUri, state, codeChallenge) => {
            const authUrl = provider.buildAuthUrl(redirectUri, state, codeChallenge);

            expect(typeof authUrl).toBe('string');
            expect(authUrl.length).toBeGreaterThan(0);

            const url = new URL(authUrl);
            expect(url.protocol).toBe('https:');
            expect(url.hostname).toBe('login.microsoftonline.com');
            expect(url.pathname).toBe('/common/oauth2/v2.0/authorize');

            const params = url.searchParams;
            expect(params.get('client_id')).toBe(testClientId);
            expect(params.get('redirect_uri')).toBe(redirectUri);
            expect(params.get('response_type')).toBe('code');
            expect(params.get('state')).toBe(state);
            expect(params.get('code_challenge')).toBe(codeChallenge);
            expect(params.get('code_challenge_method')).toBe('S256');
            expect(params.get('scope')).toContain('Files.ReadWrite.AppFolder');
            expect(params.get('scope')).toContain('offline_access');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('exchangeCodeForTokens()', () => {
    const code = 'test-auth-code';
    const redirectUri = 'http://localhost:3024/onedrive-oauth-callback.html';
    const codeVerifier = 'test-code-verifier-abc123';

    test('returns tokens on successful exchange', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 3600,
          token_type: 'Bearer',
          scope: 'Files.ReadWrite.AppFolder offline_access'
        })
      } as Response);

      const result = await provider.exchangeCodeForTokens(code, redirectUri, codeVerifier);

      expect(result.access_token).toBe('new-access-token');
      expect(result.refresh_token).toBe('new-refresh-token');
      expect(result.expires_in).toBe(3600);
      expect(result.token_type).toBe('Bearer');
      expect(result.scope).toBe('Files.ReadWrite.AppFolder offline_access');
      expect(result.error).toBeUndefined();
    });

    test('sends correct parameters in request body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'token',
          expires_in: 3600,
          token_type: 'Bearer'
        })
      } as Response);

      await provider.exchangeCodeForTokens(code, redirectUri, codeVerifier);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://login.microsoftonline.com/common/oauth2/v2.0/token');
      expect(options.method).toBe('POST');
      expect(options.headers).toEqual(expect.objectContaining({
        'Content-Type': 'application/x-www-form-urlencoded'
      }));

      const body = options.body as string;
      expect(body).toContain('grant_type=authorization_code');
      expect(body).toContain(`code=${encodeURIComponent(code)}`);
      expect(body).toContain(`redirect_uri=${encodeURIComponent(redirectUri)}`);
      expect(body).toContain(`code_verifier=${encodeURIComponent(codeVerifier)}`);
      expect(body).toContain(`client_id=${encodeURIComponent(testClientId)}`);
      expect(body).toContain(`client_secret=${encodeURIComponent(testClientSecret)}`);
      expect(body).toContain('scope=Files.ReadWrite.AppFolder%20offline_access');
    });

    test('returns error response on HTTP failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({
          error: 'invalid_grant',
          error_description: 'The authorization code has expired'
        })
      } as Response);

      const result = await provider.exchangeCodeForTokens(code, redirectUri, codeVerifier);

      expect(result.access_token).toBe('');
      expect(result.error).toBe('invalid_grant');
      expect(result.error_description).toBe('The authorization code has expired');
    });

    test('returns error on network failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network request failed'));

      const result = await provider.exchangeCodeForTokens(code, redirectUri, codeVerifier);

      expect(result.access_token).toBe('');
      expect(result.error).toBe('network_error');
      expect(result.error_description).toContain('Network request failed');
    });

    test('returns error on invalid JSON response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        statusText: 'OK',
        json: async () => { throw new Error('Invalid JSON'); }
      } as unknown as Response);

      const result = await provider.exchangeCodeForTokens(code, redirectUri, codeVerifier);

      expect(result.access_token).toBe('');
      expect(result.error).toBe('invalid_response');
    });

    test('returns error when access_token is missing from response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token_type: 'Bearer',
          expires_in: 3600
          // access_token is missing
        })
      } as Response);

      const result = await provider.exchangeCodeForTokens(code, redirectUri, codeVerifier);

      expect(result.access_token).toBe('');
      expect(result.error).toBe('invalid_response');
      expect(result.error_description).toContain('access_token');
    });
  });

  describe('refreshTokens()', () => {
    const refreshToken = 'test-refresh-token';

    test('returns new tokens on successful refresh', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'refreshed-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 3600,
          token_type: 'Bearer',
          scope: 'Files.ReadWrite.AppFolder offline_access'
        })
      } as Response);

      const result = await provider.refreshTokens(refreshToken);

      expect(result.access_token).toBe('refreshed-access-token');
      expect(result.refresh_token).toBe('new-refresh-token');
      expect(result.expires_in).toBe(3600);
      expect(result.token_type).toBe('Bearer');
      expect(result.error).toBeUndefined();
    });

    test('sends correct parameters in refresh request body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'token',
          expires_in: 3600,
          token_type: 'Bearer'
        })
      } as Response);

      await provider.refreshTokens(refreshToken);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://login.microsoftonline.com/common/oauth2/v2.0/token');
      expect(options.method).toBe('POST');

      const body = options.body as string;
      expect(body).toContain('grant_type=refresh_token');
      expect(body).toContain(`refresh_token=${encodeURIComponent(refreshToken)}`);
      expect(body).toContain(`client_id=${encodeURIComponent(testClientId)}`);
      expect(body).toContain(`client_secret=${encodeURIComponent(testClientSecret)}`);
      expect(body).toContain('scope=Files.ReadWrite.AppFolder%20offline_access');
    });

    test('returns error response on HTTP failure (expired refresh token)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({
          error: 'invalid_grant',
          error_description: 'The refresh token has expired due to inactivity'
        })
      } as Response);

      const result = await provider.refreshTokens(refreshToken);

      expect(result.access_token).toBe('');
      expect(result.error).toBe('invalid_grant');
      expect(result.error_description).toContain('refresh token has expired');
    });

    test('returns error on network failure during refresh', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ETIMEDOUT'));

      const result = await provider.refreshTokens(refreshToken);

      expect(result.access_token).toBe('');
      expect(result.error).toBe('timeout');
      expect(result.error_description).toContain('timed out');
    });

    test('handles DNS resolution failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('getaddrinfo ENOTFOUND login.microsoftonline.com'));

      const result = await provider.refreshTokens(refreshToken);

      expect(result.access_token).toBe('');
      expect(result.error).toBe('dns_error');
    });

    test('handles connection refused error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('connect ECONNREFUSED 127.0.0.1:443'));

      const result = await provider.refreshTokens(refreshToken);

      expect(result.access_token).toBe('');
      expect(result.error).toBe('connection_refused');
    });
  });

  describe('validateTokens()', () => {
    test('returns false for expired tokens (past expiresAt)', async () => {
      const expiredTokens: OAuthTokens = {
        accessToken: 'expired-token',
        refreshToken: 'refresh-token',
        expiresAt: new Date(Date.now() - 60000), // 1 minute ago
        scope: 'Files.ReadWrite.AppFolder offline_access',
        tokenType: 'Bearer'
      };

      const result = await provider.validateTokens(expiredTokens);
      expect(result).toBe(false);
      // Should not make a fetch call for expired tokens
      expect(mockFetch).not.toHaveBeenCalled();
    });

    test('returns false for tokens expiring within 5 minutes', async () => {
      const soonExpiringTokens: OAuthTokens = {
        accessToken: 'soon-expiring-token',
        refreshToken: 'refresh-token',
        expiresAt: new Date(Date.now() + 2 * 60 * 1000), // 2 minutes from now (within 5 min buffer)
        scope: 'Files.ReadWrite.AppFolder offline_access',
        tokenType: 'Bearer'
      };

      const result = await provider.validateTokens(soonExpiringTokens);
      expect(result).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    test('returns true for valid tokens with successful API call', async () => {
      const validTokens: OAuthTokens = {
        accessToken: 'valid-access-token',
        refreshToken: 'refresh-token',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
        scope: 'Files.ReadWrite.AppFolder offline_access',
        tokenType: 'Bearer'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'drive-id', driveType: 'personal' })
      } as Response);

      const result = await provider.validateTokens(validTokens);
      expect(result).toBe(true);

      // Should call Microsoft Graph API to validate
      expect(mockFetch).toHaveBeenCalledWith(
        'https://graph.microsoft.com/v1.0/me/drive',
        expect.objectContaining({
          method: 'GET',
          headers: { 'Authorization': 'Bearer valid-access-token' }
        })
      );
    });

    test('returns false when API call returns non-200 status', async () => {
      const validTokens: OAuthTokens = {
        accessToken: 'invalid-access-token',
        refreshToken: 'refresh-token',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        scope: 'Files.ReadWrite.AppFolder offline_access',
        tokenType: 'Bearer'
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401
      } as Response);

      const result = await provider.validateTokens(validTokens);
      expect(result).toBe(false);
    });

    test('returns false when API call throws network error', async () => {
      const validTokens: OAuthTokens = {
        accessToken: 'valid-access-token',
        refreshToken: 'refresh-token',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        scope: 'Files.ReadWrite.AppFolder offline_access',
        tokenType: 'Bearer'
      };

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await provider.validateTokens(validTokens);
      expect(result).toBe(false);
    });

    test('returns false when API call is aborted (timeout)', async () => {
      const validTokens: OAuthTokens = {
        accessToken: 'valid-access-token',
        refreshToken: 'refresh-token',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        scope: 'Files.ReadWrite.AppFolder offline_access',
        tokenType: 'Bearer'
      };

      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValueOnce(abortError);

      const result = await provider.validateTokens(validTokens);
      expect(result).toBe(false);
    });
  });
});
