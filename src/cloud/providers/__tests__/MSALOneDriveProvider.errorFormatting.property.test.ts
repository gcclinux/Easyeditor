/**
 * Property-based tests for MSALOneDriveProvider using fast-check
 * Task 4.3: Property 4 - API error response formatting
 *
 * Each property test runs a minimum of 100 iterations.
 *
 * **Validates: Requirements 4.4, 5.7**
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

// Mock @azure/msal-browser
jest.mock('@azure/msal-browser', () => ({
  PublicClientApplication: jest.fn().mockImplementation(() => ({
    loginPopup: jest.fn(),
    logoutPopup: jest.fn(),
    getAllAccounts: jest.fn().mockReturnValue([]),
    acquireTokenSilent: jest.fn(),
  })),
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
  // Setup valid credentials so getValidAccessToken works
  mockGetCredentials.mockResolvedValue({
    provider: 'onedrive',
    accessToken: 'valid-test-token',
    refreshToken: 'valid-refresh-token',
    expiresAt: new Date(Date.now() + 3600000),
    scope: 'Files.ReadWrite.AppFolder offline_access',
  });
});

// ============================================================================
// Property 4: API error response formatting
// Feature: onedrive-integration, Property 4: API error response formatting
// Validates: Requirements 4.4, 5.7
// ============================================================================
describe('Feature: onedrive-integration, Property 4: API error response formatting', () => {
  it('for any HTTP status code 300-599 and any error message in error.message, the thrown error contains both the numeric status code and a non-empty description', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 300, max: 599 }).filter(s => s !== 401), // Skip 401 since it triggers refresh logic
        fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
        async (statusCode, errorMessage) => {
          // Mock fetch to return the error status with a JSON error body
          (global.fetch as jest.Mock).mockImplementation(async () => {
            return {
              ok: false,
              status: statusCode,
              statusText: 'Error',
              json: async () => ({ error: { message: errorMessage } }),
              text: async () => errorMessage,
            };
          });

          const provider = new MSALOneDriveProvider();

          try {
            await provider.listFiles('test-folder-id');
            // Should have thrown
            fail('Expected an error to be thrown');
          } catch (error: any) {
            // The error message must include the numeric status code
            expect(error.message).toContain(String(statusCode));
            // The error message must contain a non-empty description
            // (after removing the status code, there should still be content)
            const messageWithoutStatus = error.message.replace(String(statusCode), '').trim();
            expect(messageWithoutStatus.length).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('for any HTTP status code 300-599 with a JSON error body containing error.message, the thrown error includes that message', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 300, max: 599 }).filter(s => s !== 401),
        fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
        async (statusCode, errorMessage) => {
          (global.fetch as jest.Mock).mockImplementation(async () => {
            return {
              ok: false,
              status: statusCode,
              statusText: 'Error',
              json: async () => ({ error: { message: errorMessage } }),
              text: async () => errorMessage,
            };
          });

          const provider = new MSALOneDriveProvider();

          try {
            await provider.listFiles('test-folder-id');
            fail('Expected an error to be thrown');
          } catch (error: any) {
            // The error message must contain the error description from the response
            expect(error.message).toContain(errorMessage);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('for any HTTP status code 300-599 with a plain text error body (non-JSON), the thrown error includes both status code and the text', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 300, max: 599 }).filter(s => s !== 401),
        fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
        async (statusCode, errorText) => {
          (global.fetch as jest.Mock).mockImplementation(async () => {
            return {
              ok: false,
              status: statusCode,
              statusText: 'Error',
              json: async () => { throw new Error('Not JSON'); },
              text: async () => errorText,
            };
          });

          const provider = new MSALOneDriveProvider();

          try {
            await provider.listFiles('test-folder-id');
            fail('Expected an error to be thrown');
          } catch (error: any) {
            // The error message must include the numeric status code
            expect(error.message).toContain(String(statusCode));
            // The error message must contain the text description
            expect(error.message).toContain(errorText);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('for any HTTP status code 300-599 with error_description in body, the thrown error includes that description', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 300, max: 599 }).filter(s => s !== 401),
        fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
        async (statusCode, errorDescription) => {
          (global.fetch as jest.Mock).mockImplementation(async () => {
            return {
              ok: false,
              status: statusCode,
              statusText: 'Error',
              json: async () => ({ error_description: errorDescription }),
              text: async () => errorDescription,
            };
          });

          const provider = new MSALOneDriveProvider();

          try {
            await provider.listFiles('test-folder-id');
            fail('Expected an error to be thrown');
          } catch (error: any) {
            // The error message must include the numeric status code
            expect(error.message).toContain(String(statusCode));
            // The error message must contain the error description
            expect(error.message).toContain(errorDescription);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
