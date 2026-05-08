/**
 * Property-based tests for MSALOneDriveProvider using fast-check
 * Task 4.4: Property 5 - Upload returns valid CloudFile
 *
 * Each property test runs a minimum of 100 iterations.
 *
 * **Validates: Requirements 5.1, 5.2**
 */

import * as fc from 'fast-check';
import { TextEncoder } from 'util';
import { MSALOneDriveProvider } from '../MSALOneDriveProvider';

// Polyfill TextEncoder for jsdom environment
global.TextEncoder = TextEncoder as any;

// Mock MSAL browser
jest.mock('@azure/msal-browser', () => ({
  PublicClientApplication: jest.fn().mockImplementation(() => ({
    loginPopup: jest.fn(),
    logoutPopup: jest.fn(),
    getAllAccounts: jest.fn().mockReturnValue([]),
    acquireTokenSilent: jest.fn(),
  })),
}));

// Mock CloudCredentialManager
const mockSaveCredentials = jest.fn().mockResolvedValue(undefined);
const mockGetCredentials = jest.fn().mockResolvedValue(null);
const mockRemoveCredentials = jest.fn().mockResolvedValue(undefined);

jest.mock('../../managers/CloudCredentialManager', () => ({
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
    SCOPES: ['Files.ReadWrite.AppFolder', 'offline_access'],
    AUTHORIZED_DOMAINS: ['http://localhost:3024'],
    REDIRECT_URI: 'http://localhost:3024/onedrive-oauth-callback.html',
  },
  isOneDriveConfigured: jest.fn().mockReturnValue(true),
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
});

// ============================================================================
// Property 5: Upload returns valid CloudFile
// Feature: onedrive-integration, Property 5: Upload returns valid CloudFile
// Validates: Requirements 5.1, 5.2
// ============================================================================
describe('Feature: onedrive-integration, Property 5: Upload returns valid CloudFile', () => {
  it('for any valid string content (≤4MB) and valid filename, uploadFile returns a CloudFile with non-empty id, name matching input, valid Date modifiedTime, size > 0, and non-empty mimeType', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate valid filenames (non-empty, reasonable characters)
        fc.string({ minLength: 1, maxLength: 100 })
          .filter(s => s.trim().length > 0 && !s.includes('/') && !s.includes('\\'))
          .map(s => s + '.md'),
        // Generate string content ≤4MB (keep small for test speed)
        fc.string({ minLength: 1, maxLength: 1000 }),
        async (fileName, content) => {
          // Setup: provider has valid credentials
          mockGetCredentials.mockResolvedValue({
            provider: 'onedrive',
            accessToken: 'valid-access-token',
            refreshToken: 'valid-refresh-token',
            expiresAt: new Date(Date.now() + 3600000),
            scope: 'Files.ReadWrite.AppFolder offline_access',
          });

          // Generate a unique ID and timestamp for the mock response
          const mockId = 'item-id-' + Math.random().toString(36).substring(2);
          const mockModifiedTime = new Date().toISOString();
          const mockSize = Buffer.byteLength(content, 'utf-8');

          (global.fetch as jest.Mock).mockImplementation(async () => {
            return {
              ok: true,
              status: 200,
              json: async () => ({
                id: mockId,
                name: fileName,
                lastModifiedDateTime: mockModifiedTime,
                size: mockSize,
                file: {
                  mimeType: 'text/markdown',
                },
              }),
            };
          });

          const provider = new MSALOneDriveProvider();
          const result = await provider.uploadFile('test-folder-id', fileName, content);

          // Verify CloudFile properties
          // id is a non-empty string
          expect(typeof result.id).toBe('string');
          expect(result.id.length).toBeGreaterThan(0);

          // name matches the input filename
          expect(result.name).toBe(fileName);

          // modifiedTime is a valid Date
          expect(result.modifiedTime).toBeInstanceOf(Date);
          expect(isNaN(result.modifiedTime.getTime())).toBe(false);

          // size is greater than 0
          expect(result.size).toBeGreaterThan(0);

          // mimeType is a non-empty string
          expect(typeof result.mimeType).toBe('string');
          expect(result.mimeType.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('for any valid Uint8Array content (≤4MB) and valid filename, uploadFile returns a CloudFile with non-empty id, name matching input, valid Date modifiedTime, size > 0, and non-empty mimeType', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate valid filenames for binary files
        fc.string({ minLength: 1, maxLength: 100 })
          .filter(s => s.trim().length > 0 && !s.includes('/') && !s.includes('\\'))
          .map(s => s + '.sstp'),
        // Generate Uint8Array content (keep small for test speed)
        fc.uint8Array({ minLength: 1, maxLength: 1000 }),
        async (fileName, content) => {
          // Setup: provider has valid credentials
          mockGetCredentials.mockResolvedValue({
            provider: 'onedrive',
            accessToken: 'valid-access-token',
            refreshToken: 'valid-refresh-token',
            expiresAt: new Date(Date.now() + 3600000),
            scope: 'Files.ReadWrite.AppFolder offline_access',
          });

          // Generate a unique ID and timestamp for the mock response
          const mockId = 'item-id-' + Math.random().toString(36).substring(2);
          const mockModifiedTime = new Date().toISOString();

          (global.fetch as jest.Mock).mockImplementation(async () => {
            return {
              ok: true,
              status: 200,
              json: async () => ({
                id: mockId,
                name: fileName,
                lastModifiedDateTime: mockModifiedTime,
                size: content.length,
                file: {
                  mimeType: 'application/octet-stream',
                },
              }),
            };
          });

          const provider = new MSALOneDriveProvider();
          const result = await provider.uploadFile('test-folder-id', fileName, content);

          // Verify CloudFile properties
          // id is a non-empty string
          expect(typeof result.id).toBe('string');
          expect(result.id.length).toBeGreaterThan(0);

          // name matches the input filename
          expect(result.name).toBe(fileName);

          // modifiedTime is a valid Date
          expect(result.modifiedTime).toBeInstanceOf(Date);
          expect(isNaN(result.modifiedTime.getTime())).toBe(false);

          // size is greater than 0
          expect(result.size).toBeGreaterThan(0);

          // mimeType is a non-empty string
          expect(typeof result.mimeType).toBe('string');
          expect(result.mimeType.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('uploadFile returns a CloudFile whose name exactly equals the input filename for any valid content type', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate valid filenames
        fc.string({ minLength: 1, maxLength: 80 })
          .filter(s => s.trim().length > 0 && !s.includes('/') && !s.includes('\\')),
        // Generate file extension
        fc.oneof(fc.constant('.md'), fc.constant('.sstp')),
        // Generate content type: string or Uint8Array
        fc.oneof(
          fc.string({ minLength: 1, maxLength: 500 }).map(s => ({ type: 'string' as const, value: s })),
          fc.uint8Array({ minLength: 1, maxLength: 500 }).map(a => ({ type: 'binary' as const, value: a }))
        ),
        async (baseName, ext, contentWrapper) => {
          const fileName = baseName + ext;
          const content = contentWrapper.type === 'string' ? contentWrapper.value : contentWrapper.value;

          // Setup: provider has valid credentials
          mockGetCredentials.mockResolvedValue({
            provider: 'onedrive',
            accessToken: 'valid-access-token',
            refreshToken: 'valid-refresh-token',
            expiresAt: new Date(Date.now() + 3600000),
            scope: 'Files.ReadWrite.AppFolder offline_access',
          });

          const mockMimeType = contentWrapper.type === 'string' ? 'text/markdown' : 'application/octet-stream';
          const mockSize = contentWrapper.type === 'string'
            ? Buffer.byteLength(contentWrapper.value, 'utf-8')
            : contentWrapper.value.length;

          (global.fetch as jest.Mock).mockImplementation(async () => {
            return {
              ok: true,
              status: 200,
              json: async () => ({
                id: 'generated-id-' + Math.random().toString(36).substring(2),
                name: fileName,
                lastModifiedDateTime: new Date().toISOString(),
                size: mockSize,
                file: {
                  mimeType: mockMimeType,
                },
              }),
            };
          });

          const provider = new MSALOneDriveProvider();
          const result = await provider.uploadFile('test-folder-id', fileName, content);

          // The returned name MUST exactly equal the input filename
          expect(result.name).toBe(fileName);
        }
      ),
      { numRuns: 100 }
    );
  });
});
