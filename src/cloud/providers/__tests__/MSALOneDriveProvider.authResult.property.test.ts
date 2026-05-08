/**
 * Property-based tests for MSALOneDriveProvider using fast-check
 * Task 4.2: Property 1 - AuthResult well-formedness
 *
 * For any authentication attempt, if success is true then accessToken and refreshToken
 * are non-empty strings and expiresAt is in the future; if success is false then error
 * is a non-empty string.
 *
 * Each property test runs a minimum of 100 iterations.
 *
 * **Validates: Requirements 2.4, 2.5**
 */

import * as fc from 'fast-check';
import { MSALOneDriveProvider } from '../MSALOneDriveProvider';

// Mock CloudCredentialManager
const mockSaveCredentials = jest.fn().mockResolvedValue(undefined);
const mockGetCredentials = jest.fn().mockResolvedValue(null);
const mockRemoveCredentials = jest.fn().mockResolvedValue(undefined);

jest.mock('../../managers/CloudCredentialManager', () => ({
  CloudCredentialManager: jest.fn().mockImplementation(() => ({
    saveCredentials: mockSaveCredentials,
    getCredentials: mockGetCredentials,
    removeCredentials: mockRemoveCredentials,
  })),
  cloudCredentialManager: {
    saveCredentials: (...args: any[]) => mockSaveCredentials(...args),
    getCredentials: (...args: any[]) => mockGetCredentials(...args),
    removeCredentials: (...args: any[]) => mockRemoveCredentials(...args),
  }
}));

// Mock LicenseManager
jest.mock('../../../premium/LicenseManager', () => ({
  __esModule: true,
  default: {
    hasActiveLicense: jest.fn().mockReturnValue(true),
  }
}));

// Mock onedrive-credentials
jest.mock('../../config/onedrive-credentials', () => ({
  ONEDRIVE_CONFIG: {
    CLIENT_ID: 'test-client-id-valid-long-enough',
    CLIENT_SECRET: 'test-client-secret-valid-long-enough',
    REDIRECT_URI: 'http://localhost:3024/onedrive-oauth-callback.html',
    SCOPES: ['Files.ReadWrite.AppFolder', 'offline_access'],
    AUTHORIZED_DOMAINS: ['http://localhost:3024'],
  },
  isOneDriveConfigured: jest.fn().mockReturnValue(true),
  getConfigurationErrorMessage: jest.fn().mockReturnValue(''),
}));

// Store mock loginPopup for dynamic control per test case
const mockLoginPopup = jest.fn();

jest.mock('@azure/msal-browser', () => ({
  PublicClientApplication: jest.fn().mockImplementation(() => ({
    loginPopup: mockLoginPopup,
    logoutPopup: jest.fn(),
    getAllAccounts: jest.fn().mockReturnValue([]),
    acquireTokenSilent: jest.fn(),
  })),
}));

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
  mockLoginPopup.mockReset();
});

// ============================================================================
// Property 1: AuthResult well-formedness
// Feature: onedrive-integration, Property 1: AuthResult well-formedness
// Validates: Requirements 2.4, 2.5
// ============================================================================
describe('Feature: onedrive-integration, Property 1: AuthResult well-formedness', () => {
  it('when MSAL loginPopup succeeds with valid tokens, AuthResult has success=true with non-empty accessToken, non-empty refreshToken, and expiresAt in the future', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
        fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
        fc.integer({ min: 60, max: 86400 }), // seconds until expiry (1 min to 24 hours)
        async (accessToken, idToken, expiresInSeconds) => {
          const expiresOn = new Date(Date.now() + expiresInSeconds * 1000);

          mockLoginPopup.mockResolvedValue({
            accessToken,
            idToken,
            expiresOn,
            scopes: ['Files.ReadWrite.AppFolder', 'offline_access'],
            account: { username: 'test@example.com' },
          });

          const provider = new MSALOneDriveProvider();
          const timeBefore = Date.now();
          const result = await provider.authenticate();

          // AuthResult must be well-formed for success case
          expect(result.success).toBe(true);
          expect(typeof result.accessToken).toBe('string');
          expect(result.accessToken!.length).toBeGreaterThan(0);
          expect(typeof result.refreshToken).toBe('string');
          expect(result.refreshToken!.length).toBeGreaterThan(0);
          expect(result.expiresAt).toBeInstanceOf(Date);
          expect(result.expiresAt!.getTime()).toBeGreaterThan(timeBefore);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('when MSAL loginPopup throws an error, AuthResult has success=false with a non-empty error string', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
        async (errorMessage) => {
          mockLoginPopup.mockRejectedValue(new Error(errorMessage));

          const provider = new MSALOneDriveProvider();
          const result = await provider.authenticate();

          // AuthResult must be well-formed for failure case
          expect(result.success).toBe(false);
          expect(typeof result.error).toBe('string');
          expect(result.error!.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('when MSAL loginPopup returns null/empty accessToken, AuthResult has success=false with a non-empty error string', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.constant(null),
          fc.constant(undefined),
          fc.constant({ accessToken: '', idToken: 'some-id', expiresOn: new Date() }),
          fc.constant({ accessToken: null, idToken: 'some-id', expiresOn: new Date() })
        ),
        async (msalResponse) => {
          mockLoginPopup.mockResolvedValue(msalResponse);

          const provider = new MSALOneDriveProvider();
          const result = await provider.authenticate();

          // AuthResult must be well-formed for failure case
          expect(result.success).toBe(false);
          expect(typeof result.error).toBe('string');
          expect(result.error!.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('when MSAL loginPopup throws non-Error values, AuthResult has success=false with a non-empty error string', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.integer(),
          fc.constant(null),
          fc.constant(undefined)
        ),
        async (thrownValue) => {
          mockLoginPopup.mockRejectedValue(thrownValue);

          const provider = new MSALOneDriveProvider();
          const result = await provider.authenticate();

          // AuthResult must be well-formed for failure case
          expect(result.success).toBe(false);
          expect(typeof result.error).toBe('string');
          expect(result.error!.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('when MSAL loginPopup succeeds without expiresOn, AuthResult still has expiresAt in the future (default 1 hour)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
        fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
        async (accessToken, idToken) => {
          mockLoginPopup.mockResolvedValue({
            accessToken,
            idToken,
            expiresOn: null, // No expiration provided
            scopes: ['Files.ReadWrite.AppFolder', 'offline_access'],
            account: { username: 'test@example.com' },
          });

          const provider = new MSALOneDriveProvider();
          const timeBefore = Date.now();
          const result = await provider.authenticate();

          // AuthResult must be well-formed for success case
          expect(result.success).toBe(true);
          expect(typeof result.accessToken).toBe('string');
          expect(result.accessToken!.length).toBeGreaterThan(0);
          expect(typeof result.refreshToken).toBe('string');
          expect(result.refreshToken!.length).toBeGreaterThan(0);
          expect(result.expiresAt).toBeInstanceOf(Date);
          // Default fallback should be in the future
          expect(result.expiresAt!.getTime()).toBeGreaterThan(timeBefore);
        }
      ),
      { numRuns: 100 }
    );
  });
});
