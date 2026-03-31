/**
 * Property-based tests for GoogleOAuthProvider
 * Tests provider interface compliance and OAuth functionality
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import * as fc from 'fast-check';
import { GoogleOAuthProvider } from '../providers/GoogleOAuthProvider';
import type { OAuthTokens } from '../interfaces';

describe('GoogleOAuthProvider', () => {
  let provider: GoogleOAuthProvider;
  const testClientId = 'test-client-id.apps.googleusercontent.com';

  beforeEach(() => {
    provider = new GoogleOAuthProvider(testClientId);
  });

  /**
   * Feature: tauri-oauth-implementation, Property 9: Provider Interface Compliance
   * Validates: Requirements 5.1, 5.3
   * 
   * For any OAuth provider implementation, all authentication operations 
   * should conform to the common OAuthProvider interface
   */
  test('Property 9: Provider Interface Compliance - provider has required properties', () => {
    fc.assert(
      fc.property(
        fc.constant(null), // No input needed for this test
        () => {
          // Provider should have all required readonly properties
          expect(provider.name).toBe('google');
          expect(provider.displayName).toBe('Google Drive');
          expect(provider.authorizationUrl).toBe('https://accounts.google.com/o/oauth2/v2/auth');
          expect(provider.tokenUrl).toBe('https://oauth2.googleapis.com/token');
          expect(provider.clientId).toBe(testClientId);
          
          // Scope should be an array with Google Drive scope
          expect(Array.isArray(provider.scope)).toBe(true);
          expect(provider.scope).toContain('https://www.googleapis.com/auth/drive');
          
          // Properties should be defined and consistent
          expect(typeof provider.name).toBe('string');
          expect(typeof provider.displayName).toBe('string');
          expect(typeof provider.authorizationUrl).toBe('string');
          expect(typeof provider.tokenUrl).toBe('string');
          expect(typeof provider.clientId).toBe('string');
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 9: Provider Interface Compliance - buildAuthUrl generates valid URLs', () => {
    fc.assert(
      fc.property(
        fc.webUrl(), // redirectUri
        fc.string({ minLength: 10, maxLength: 50 }), // state
        fc.string({ minLength: 10, maxLength: 50 }), // codeChallenge
        (redirectUri, state, codeChallenge) => {
          const authUrl = provider.buildAuthUrl(redirectUri, state, codeChallenge);
          
          // Should return a valid URL string
          expect(typeof authUrl).toBe('string');
          expect(authUrl.length).toBeGreaterThan(0);
          
          // Should be a valid URL
          const url = new URL(authUrl);
          expect(url.protocol).toBe('https:');
          expect(url.hostname).toBe('accounts.google.com');
          expect(url.pathname).toBe('/o/oauth2/v2/auth');
          
          // Should contain required OAuth parameters
          const params = url.searchParams;
          expect(params.get('client_id')).toBe(testClientId);
          expect(params.get('redirect_uri')).toBe(redirectUri);
          expect(params.get('response_type')).toBe('code');
          expect(params.get('state')).toBe(state);
          expect(params.get('code_challenge')).toBe(codeChallenge);
          expect(params.get('code_challenge_method')).toBe('S256');
          expect(params.get('access_type')).toBe('offline');
          expect(params.get('prompt')).toBe('consent');
          
          // Scope should contain Google Drive scope
          const scope = params.get('scope');
          expect(scope).toContain('https://www.googleapis.com/auth/drive');
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 9: Provider Interface Compliance - constructor validates client ID', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(''),
          fc.constant(null),
          fc.constant(undefined)
        ),
        (invalidClientId) => {
          // Should throw error for invalid client ID
          expect(() => {
            new GoogleOAuthProvider(invalidClientId as any);
          }).toThrow('Google OAuth client ID is required');
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 9: Provider Interface Compliance - valid client IDs are accepted', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        (validClientId) => {
          // Should not throw error for valid client ID
          expect(() => {
            const testProvider = new GoogleOAuthProvider(validClientId);
            expect(testProvider.clientId).toBe(validClientId);
          }).not.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });
});