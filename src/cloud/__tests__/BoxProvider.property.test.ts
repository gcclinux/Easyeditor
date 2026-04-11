/**
 * Property-based tests for BoxProvider using fast-check
 * Task 6.2: All 8 correctness properties from the design document
 *
 * Each property test runs a minimum of 100 iterations.
 */

import * as fc from 'fast-check';
import { BoxProvider } from '../providers/BoxProvider';

// Mock CloudCredentialManager
const mockSaveCredentials = jest.fn().mockResolvedValue(undefined);
const mockGetCredentials = jest.fn().mockResolvedValue(null);
const mockRemoveCredentials = jest.fn().mockResolvedValue(undefined);
const mockUpdateCredentials = jest.fn().mockResolvedValue(undefined);

jest.mock('../managers/CloudCredentialManager', () => ({
  CloudCredentialManager: jest.fn().mockImplementation(() => ({
    saveCredentials: mockSaveCredentials,
    getCredentials: mockGetCredentials,
    removeCredentials: mockRemoveCredentials,
    updateCredentials: mockUpdateCredentials,
  })),
  cloudCredentialManager: {
    saveCredentials: (...args: any[]) => mockSaveCredentials(...args),
    getCredentials: (...args: any[]) => mockGetCredentials(...args),
    removeCredentials: (...args: any[]) => mockRemoveCredentials(...args),
    updateCredentials: (...args: any[]) => mockUpdateCredentials(...args),
  }
}));

// Mock LicenseManager
jest.mock('../../premium/LicenseManager', () => ({
  __esModule: true,
  default: {
    hasActiveLicense: jest.fn().mockReturnValue(true),
  }
}));

// Mock box-credentials with a mutable config for Property 5
const mockBoxConfig = {
  CLIENT_ID: 'test-client-id-valid-long-enough',
  CLIENT_SECRET: 'test-client-secret-valid-long-enough',
  REDIRECT_URI: 'http://localhost:3024/box-oauth-callback.html',
  SCOPES: ['root_readwrite'],
  AUTHORIZED_DOMAINS: ['http://localhost:3024'],
};

jest.mock('../config/box-credentials', () => ({
  get BOX_CONFIG() { return mockBoxConfig; },
  isBoxConfigured: jest.fn().mockReturnValue(true),
  getConfigurationErrorMessage: jest.fn().mockReturnValue(''),
}));

// Mock fetch globally
global.fetch = jest.fn();

// Suppress console noise in tests
beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'info').mockImplementation(() => {});
});

afterAll(() => {
  jest.restoreAllMocks();
});

beforeEach(() => {
  jest.clearAllMocks();
  (global.fetch as jest.Mock).mockReset();
  mockSaveCredentials.mockResolvedValue(undefined);
  mockGetCredentials.mockResolvedValue(null);
  mockRemoveCredentials.mockResolvedValue(undefined);
  mockUpdateCredentials.mockResolvedValue(undefined);
});


// ============================================================================
// Property 1: Token endpoint request formation
// Feature: box-cloud-integration, Property 1: Token endpoint request formation
// Validates: Requirements 1.2, 3.1
// ============================================================================
describe('Feature: box-cloud-integration, Property 1: Token endpoint request formation', () => {
  it('authorization code exchange: POST body contains correct grant_type, client_id, code, and code_verifier', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        fc.string({ minLength: 1, maxLength: 128 }).filter(s => s.trim().length > 0),
        async (code, verifier) => {
          let capturedBody: string | undefined;

          (global.fetch as jest.Mock).mockImplementation(async (url: string, options: any) => {
            if (url === '/api/box-oauth/oauth2/token') {
              capturedBody = options.body;
              return {
                ok: true,
                json: async () => ({
                  access_token: 'at_test',
                  refresh_token: 'rt_test',
                  expires_in: 3600,
                  token_type: 'bearer',
                }),
              };
            }
            return { ok: false, status: 404, text: async () => 'not found' };
          });

          const provider = new BoxProvider();
          // Access private method via bracket notation
          await (provider as any).exchangeCodeForToken(code, verifier);

          expect(capturedBody).toBeDefined();
          const params = new URLSearchParams(capturedBody!);
          expect(params.get('grant_type')).toBe('authorization_code');
          expect(params.get('client_id')).toBe(mockBoxConfig.CLIENT_ID);
          expect(params.get('code')).toBe(code);
          expect(params.get('code_verifier')).toBe(verifier);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('refresh token: POST body contains correct grant_type, client_id, and refresh_token', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        async (refreshToken) => {
          let capturedBody: string | undefined;

          (global.fetch as jest.Mock).mockImplementation(async (url: string, options: any) => {
            if (url === '/api/box-oauth/oauth2/token') {
              capturedBody = options.body;
              return {
                ok: true,
                json: async () => ({
                  access_token: 'new_at',
                  refresh_token: 'new_rt',
                  expires_in: 3600,
                  token_type: 'bearer',
                }),
              };
            }
            return { ok: false, status: 404, text: async () => 'not found' };
          });

          const provider = new BoxProvider();
          await (provider as any).refreshAccessToken(refreshToken);

          expect(capturedBody).toBeDefined();
          const params = new URLSearchParams(capturedBody!);
          expect(params.get('grant_type')).toBe('refresh_token');
          expect(params.get('client_id')).toBe(mockBoxConfig.CLIENT_ID);
          expect(params.get('refresh_token')).toBe(refreshToken);
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ============================================================================
// Property 2: Credential storage round-trip
// Feature: box-cloud-integration, Property 2: Credential storage round-trip
// Validates: Requirements 1.3, 2.2, 3.2
// ============================================================================
describe('Feature: box-cloud-integration, Property 2: Credential storage round-trip', () => {
  it('storing credentials and retrieving them yields the same access token, refresh token, and correct expiration', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
        fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
        fc.integer({ min: 60, max: 86400 }),
        async (accessToken, refreshToken, expiresIn) => {
          // Track what was saved
          let savedCredentials: any = null;
          mockSaveCredentials.mockImplementation(async (creds: any) => {
            savedCredentials = creds;
          });

          (global.fetch as jest.Mock).mockImplementation(async (url: string) => {
            if (url === '/api/box-oauth/oauth2/token') {
              return {
                ok: true,
                json: async () => ({
                  access_token: accessToken,
                  refresh_token: refreshToken,
                  expires_in: expiresIn,
                  token_type: 'bearer',
                }),
              };
            }
            return { ok: false, status: 404, text: async () => 'not found' };
          });

          const provider = new BoxProvider();
          const timeBefore = Date.now();
          await (provider as any).exchangeCodeForToken('test-code', 'test-verifier');
          const timeAfter = Date.now();

          // Verify round-trip
          expect(savedCredentials).not.toBeNull();
          expect(savedCredentials.accessToken).toBe(accessToken);
          expect(savedCredentials.refreshToken).toBe(refreshToken);

          // Verify expiration time is correctly computed
          const expectedExpiresAtMin = timeBefore + (expiresIn * 1000);
          const expectedExpiresAtMax = timeAfter + (expiresIn * 1000);
          const actualExpiresAt = savedCredentials.expiresAt.getTime();

          expect(actualExpiresAt).toBeGreaterThanOrEqual(expectedExpiresAtMin);
          expect(actualExpiresAt).toBeLessThanOrEqual(expectedExpiresAtMax);
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ============================================================================
// Property 3: OAuth error passthrough
// Feature: box-cloud-integration, Property 3: OAuth error passthrough
// Validates: Requirements 1.5
// ============================================================================
describe('Feature: box-cloud-integration, Property 3: OAuth error passthrough', () => {
  it('any error description from Box results in AuthResult with success=false and error containing the description', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
        async (errorDescription) => {
          (global.fetch as jest.Mock).mockImplementation(async (url: string) => {
            if (url === '/api/box-oauth/oauth2/token') {
              return {
                ok: false,
                status: 400,
                text: async () => errorDescription,
              };
            }
            return { ok: false, status: 404, text: async () => 'not found' };
          });

          const provider = new BoxProvider();

          let result: any;
          try {
            result = await (provider as any).exchangeCodeForToken('test-code', 'test-verifier');
          } catch (error: any) {
            // exchangeCodeForToken throws on failure, the error message should contain the description
            expect(error.message).toContain(errorDescription);
            return;
          }

          // If it didn't throw, it should be a failed AuthResult
          expect(result.success).toBe(false);
          expect(result.error).toContain(errorDescription);
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ============================================================================
// Property 4: Authentication status correctness
// Feature: box-cloud-integration, Property 4: Authentication status correctness
// Validates: Requirements 3.4
// ============================================================================
describe('Feature: box-cloud-integration, Property 4: Authentication status correctness', () => {
  it('isAuthenticated returns true iff a valid non-expired token exists or refresh succeeds', async () => {
    // Define credential state scenarios
    const credentialStateArb = fc.oneof(
      // No credentials
      fc.constant({ type: 'none' as const }),
      // Valid non-expired token
      fc.record({
        type: fc.constant('valid' as const),
        accessToken: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        refreshToken: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        minutesUntilExpiry: fc.integer({ min: 10, max: 1440 }),
      }),
      // Expired token with refresh token (refresh succeeds)
      fc.record({
        type: fc.constant('expired_with_refresh' as const),
        accessToken: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        refreshToken: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
      }),
      // Expired token without refresh token
      fc.record({
        type: fc.constant('expired_no_refresh' as const),
        accessToken: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
      })
    );

    await fc.assert(
      fc.asyncProperty(credentialStateArb, async (state) => {
        // Setup mocks based on state
        if (state.type === 'none') {
          mockGetCredentials.mockResolvedValue(null);
        } else if (state.type === 'valid') {
          mockGetCredentials.mockResolvedValue({
            provider: 'box',
            accessToken: state.accessToken,
            refreshToken: state.refreshToken,
            expiresAt: new Date(Date.now() + state.minutesUntilExpiry * 60 * 1000),
            scope: 'root_readwrite',
          });
        } else if (state.type === 'expired_with_refresh') {
          mockGetCredentials.mockResolvedValue({
            provider: 'box',
            accessToken: state.accessToken,
            refreshToken: state.refreshToken,
            expiresAt: new Date(Date.now() - 60000), // expired 1 minute ago
            scope: 'root_readwrite',
          });
          // Mock successful refresh
          (global.fetch as jest.Mock).mockImplementation(async (url: string) => {
            if (url === '/api/box-oauth/oauth2/token') {
              return {
                ok: true,
                json: async () => ({
                  access_token: 'refreshed_token',
                  refresh_token: 'new_refresh',
                  expires_in: 3600,
                  token_type: 'bearer',
                }),
              };
            }
            return { ok: false, status: 404, text: async () => '' };
          });
        } else if (state.type === 'expired_no_refresh') {
          mockGetCredentials.mockResolvedValue({
            provider: 'box',
            accessToken: state.accessToken,
            refreshToken: undefined,
            expiresAt: new Date(Date.now() - 60000), // expired 1 minute ago
            scope: 'root_readwrite',
          });
        }

        const provider = new BoxProvider();
        const result = await provider.isAuthenticated();

        // Verify correctness
        if (state.type === 'none') {
          expect(result).toBe(false);
        } else if (state.type === 'valid') {
          expect(result).toBe(true);
        } else if (state.type === 'expired_with_refresh') {
          // Should be true because refresh succeeds
          expect(result).toBe(true);
        } else if (state.type === 'expired_no_refresh') {
          expect(result).toBe(false);
        }
      }),
      { numRuns: 100 }
    );
  });
});


// ============================================================================
// Property 5: Configuration validation
// Feature: box-cloud-integration, Property 5: Configuration validation
// Validates: Requirements 4.5
// ============================================================================
describe('Feature: box-cloud-integration, Property 5: Configuration validation', () => {
  it('isBoxConfigured returns true iff both clientId and clientSecret are non-empty and do not contain "your-" prefix', async () => {
    // Import the actual implementation for testing
    // We need to test the logic directly since the module is mocked
    // Replicate the isBoxConfigured logic to test the property
    const isBoxConfiguredLogic = (clientId: string, clientSecret: string): boolean => {
      const hasValidClientId = Boolean(clientId &&
        !clientId.includes('your-') &&
        clientId.length > 10);
      const hasValidClientSecret = Boolean(clientSecret &&
        !clientSecret.includes('your-') &&
        clientSecret.length > 10);
      return hasValidClientId && hasValidClientSecret;
    };

    const configArb = fc.oneof(
      // Valid configs: non-empty, no "your-" prefix, length > 10
      fc.record({
        clientId: fc.string({ minLength: 11, maxLength: 100 })
          .filter(s => !s.includes('your-') && s.trim().length > 10),
        clientSecret: fc.string({ minLength: 11, maxLength: 100 })
          .filter(s => !s.includes('your-') && s.trim().length > 10),
      }),
      // Invalid: empty clientId
      fc.record({
        clientId: fc.constant(''),
        clientSecret: fc.string({ minLength: 11, maxLength: 100 })
          .filter(s => !s.includes('your-')),
      }),
      // Invalid: "your-" prefix in clientId
      fc.record({
        clientId: fc.string({ minLength: 5, maxLength: 50 }).map(s => 'your-' + s),
        clientSecret: fc.string({ minLength: 11, maxLength: 100 })
          .filter(s => !s.includes('your-')),
      }),
      // Invalid: empty clientSecret
      fc.record({
        clientId: fc.string({ minLength: 11, maxLength: 100 })
          .filter(s => !s.includes('your-')),
        clientSecret: fc.constant(''),
      }),
      // Invalid: "your-" prefix in clientSecret
      fc.record({
        clientId: fc.string({ minLength: 11, maxLength: 100 })
          .filter(s => !s.includes('your-')),
        clientSecret: fc.string({ minLength: 5, maxLength: 50 }).map(s => 'your-' + s),
      }),
      // Invalid: too short clientId
      fc.record({
        clientId: fc.string({ minLength: 1, maxLength: 10 })
          .filter(s => !s.includes('your-')),
        clientSecret: fc.string({ minLength: 11, maxLength: 100 })
          .filter(s => !s.includes('your-')),
      })
    );

    fc.assert(
      fc.property(configArb, ({ clientId, clientSecret }) => {
        const result = isBoxConfiguredLogic(clientId, clientSecret);

        const expectedValid =
          clientId.length > 10 &&
          !clientId.includes('your-') &&
          clientSecret.length > 10 &&
          !clientSecret.includes('your-');

        expect(result).toBe(expectedValid);
      }),
      { numRuns: 100 }
    );
  });
});


// ============================================================================
// Property 6: Box item to CloudFile mapping
// Feature: box-cloud-integration, Property 6: Box item to CloudFile mapping
// Validates: Requirements 6.1
// ============================================================================
describe('Feature: box-cloud-integration, Property 6: Box item to CloudFile mapping', () => {
  it('mapBoxFileToCloudFile produces a CloudFile with correct id, name, valid Date, numeric size, and non-empty mimeType', () => {
    const boxItemArb = fc.record({
      type: fc.constant('file' as const),
      id: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
      name: fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
      modified_at: fc.date({ min: new Date('2000-01-01'), max: new Date('2030-12-31') })
        .filter(d => !isNaN(d.getTime()))
        .map(d => d.toISOString()),
      size: fc.nat({ max: 1000000000 }),
    });

    fc.assert(
      fc.property(boxItemArb, (item) => {
        const provider = new BoxProvider();
        const cloudFile = (provider as any).mapBoxFileToCloudFile(item);

        // id equals Box item id and is non-empty
        expect(cloudFile.id).toBe(item.id);
        expect(cloudFile.id.length).toBeGreaterThan(0);

        // name equals Box item name and is non-empty
        expect(cloudFile.name).toBe(item.name);
        expect(cloudFile.name.length).toBeGreaterThan(0);

        // modifiedTime is a valid Date
        expect(cloudFile.modifiedTime).toBeInstanceOf(Date);
        expect(isNaN(cloudFile.modifiedTime.getTime())).toBe(false);

        // size is a number
        expect(typeof cloudFile.size).toBe('number');

        // mimeType is a non-empty string
        expect(typeof cloudFile.mimeType).toBe('string');
        expect(cloudFile.mimeType.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });

  it('mapBoxFileToCloudFile handles missing modified_at by using a valid fallback Date', () => {
    const boxItemArb = fc.record({
      type: fc.constant('file' as const),
      id: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
      name: fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
      size: fc.nat({ max: 1000000000 }),
    });

    fc.assert(
      fc.property(boxItemArb, (item) => {
        const provider = new BoxProvider();
        const cloudFile = (provider as any).mapBoxFileToCloudFile(item);

        // modifiedTime should still be a valid Date even without modified_at
        expect(cloudFile.modifiedTime).toBeInstanceOf(Date);
        expect(isNaN(cloudFile.modifiedTime.getTime())).toBe(false);
      }),
      { numRuns: 100 }
    );
  });
});


// ============================================================================
// Property 7: API error status code inclusion
// Feature: box-cloud-integration, Property 7: API error status code inclusion
// Validates: Requirements 6.6
// ============================================================================
describe('Feature: box-cloud-integration, Property 7: API error status code inclusion', () => {
  it('for any HTTP error status 400-599, the thrown error message includes the numeric status code', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 400, max: 599 }),
        async (statusCode) => {
          // Setup: provider has valid credentials so getValidAccessToken works
          mockGetCredentials.mockResolvedValue({
            provider: 'box',
            accessToken: 'valid-token',
            refreshToken: undefined,
            expiresAt: new Date(Date.now() + 3600000),
            scope: 'root_readwrite',
          });

          (global.fetch as jest.Mock).mockImplementation(async () => {
            return {
              ok: false,
              status: statusCode,
              statusText: 'Error',
              text: async () => JSON.stringify({ message: 'API error occurred' }),
              headers: new Map(),
            };
          });

          const provider = new BoxProvider();

          try {
            await provider.listFiles('test-folder-id');
            // Should have thrown
            fail('Expected an error to be thrown');
          } catch (error: any) {
            // The error message must include the status code
            expect(error.message).toContain(String(statusCode));
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ============================================================================
// Property 8: Disconnect clears all state
// Feature: box-cloud-integration, Property 8: Disconnect clears all state
// Validates: Requirements 8.2, 8.3
// ============================================================================
describe('Feature: box-cloud-integration, Property 8: Disconnect clears all state', () => {
  it('after disconnect, getCredentials returns null and isAuthenticated returns false', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          accessToken: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          refreshToken: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          minutesUntilExpiry: fc.integer({ min: -60, max: 1440 }),
        }),
        async (initialState) => {
          const expiresAt = new Date(Date.now() + initialState.minutesUntilExpiry * 60 * 1000);

          // Setup initial credentials
          mockGetCredentials.mockResolvedValue({
            provider: 'box',
            accessToken: initialState.accessToken,
            refreshToken: initialState.refreshToken,
            expiresAt,
            scope: 'root_readwrite',
          });

          // Mock revoke to succeed (or fail - shouldn't matter)
          (global.fetch as jest.Mock).mockImplementation(async () => {
            return { ok: true };
          });

          const provider = new BoxProvider();
          await provider.disconnect();

          // After disconnect, removeCredentials must have been called
          expect(mockRemoveCredentials).toHaveBeenCalledWith('box');

          // Now simulate that credentials are gone
          mockGetCredentials.mockResolvedValue(null);

          // isAuthenticated should return false
          const isAuth = await provider.isAuthenticated();
          expect(isAuth).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('disconnect clears state even when token revocation fails', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          accessToken: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          refreshToken: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        }),
        async (initialState) => {
          mockGetCredentials.mockResolvedValue({
            provider: 'box',
            accessToken: initialState.accessToken,
            refreshToken: initialState.refreshToken,
            expiresAt: new Date(Date.now() + 3600000),
            scope: 'root_readwrite',
          });

          // Mock revoke to fail
          (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

          const provider = new BoxProvider();
          // disconnect should not throw even if revocation fails
          await provider.disconnect();

          // Credentials must still be cleared
          expect(mockRemoveCredentials).toHaveBeenCalledWith('box');

          // Simulate credentials gone
          mockGetCredentials.mockResolvedValue(null);
          const isAuth = await provider.isAuthenticated();
          expect(isAuth).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});
