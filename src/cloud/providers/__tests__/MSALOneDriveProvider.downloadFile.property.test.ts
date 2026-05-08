/**
 * Property-based tests for MSALOneDriveProvider using fast-check
 * Task 4.6: Property 7 - downloadFile returns correct type based on content
 *
 * Each property test runs a minimum of 100 iterations.
 *
 * **Validates: Requirements 5.4**
 */

import * as fc from 'fast-check';
import { TextEncoder, TextDecoder } from 'util';
import { MSALOneDriveProvider } from '../MSALOneDriveProvider';

// Polyfill TextEncoder/TextDecoder for jsdom environment
global.TextEncoder = TextEncoder as any;
global.TextDecoder = TextDecoder as any;

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
// Property 7: downloadFile returns correct type based on content
// Feature: onedrive-integration, Property 7: downloadFile returns correct type based on content
// Validates: Requirements 5.4
// ============================================================================
describe('Feature: onedrive-integration, Property 7: downloadFile returns correct type based on content', () => {
  it('for any file with a mimeType starting with "text/", downloadFile returns a string', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate arbitrary text/* mimeType subtypes
        fc.string({ minLength: 1, maxLength: 50 })
          .filter(s => s.trim().length > 0 && !s.includes('/') && !s.includes(' '))
          .map(s => `text/${s}`),
        // Generate arbitrary file content as text
        fc.string({ minLength: 0, maxLength: 500 }),
        // Generate arbitrary file IDs
        fc.string({ minLength: 1, maxLength: 50 })
          .filter(s => s.trim().length > 0),
        async (mimeType, fileContent, fileId) => {
          // Mock fetch: first call returns metadata, second call returns content
          let callCount = 0;
          (global.fetch as jest.Mock).mockImplementation(async (url: string) => {
            callCount++;
            if (callCount === 1) {
              // Metadata request
              return {
                ok: true,
                status: 200,
                json: async () => ({
                  id: fileId,
                  name: 'test-file.md',
                  lastModifiedDateTime: new Date().toISOString(),
                  size: fileContent.length,
                  file: { mimeType },
                }),
              };
            }
            // Content download request
            return {
              ok: true,
              status: 200,
              text: async () => fileContent,
              arrayBuffer: async () => new TextEncoder().encode(fileContent).buffer,
            };
          });

          const provider = new MSALOneDriveProvider();
          const result = await provider.downloadFile(fileId);

          // For text/* mimeTypes, the result MUST be a string
          expect(typeof result).toBe('string');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('for any file with a mimeType NOT starting with "text/", downloadFile returns a Uint8Array', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate non-text mimeTypes (application/*, image/*, audio/*, video/*, etc.)
        fc.oneof(
          fc.string({ minLength: 1, maxLength: 30 })
            .filter(s => s.trim().length > 0 && !s.includes('/') && !s.includes(' ') && !s.startsWith('text'))
            .map(s => `application/${s}`),
          fc.string({ minLength: 1, maxLength: 30 })
            .filter(s => s.trim().length > 0 && !s.includes('/') && !s.includes(' '))
            .map(s => `image/${s}`),
          fc.string({ minLength: 1, maxLength: 30 })
            .filter(s => s.trim().length > 0 && !s.includes('/') && !s.includes(' '))
            .map(s => `audio/${s}`),
          fc.string({ minLength: 1, maxLength: 30 })
            .filter(s => s.trim().length > 0 && !s.includes('/') && !s.includes(' '))
            .map(s => `video/${s}`)
        ),
        // Generate arbitrary binary content
        fc.uint8Array({ minLength: 1, maxLength: 500 }),
        // Generate arbitrary file IDs
        fc.string({ minLength: 1, maxLength: 50 })
          .filter(s => s.trim().length > 0),
        async (mimeType, binaryContent, fileId) => {
          // Mock fetch: first call returns metadata, second call returns content
          let callCount = 0;
          (global.fetch as jest.Mock).mockImplementation(async (url: string) => {
            callCount++;
            if (callCount === 1) {
              // Metadata request
              return {
                ok: true,
                status: 200,
                json: async () => ({
                  id: fileId,
                  name: 'test-file.bin',
                  lastModifiedDateTime: new Date().toISOString(),
                  size: binaryContent.length,
                  file: { mimeType },
                }),
              };
            }
            // Content download request
            return {
              ok: true,
              status: 200,
              text: async () => new TextDecoder().decode(binaryContent),
              arrayBuffer: async () => binaryContent.buffer.slice(
                binaryContent.byteOffset,
                binaryContent.byteOffset + binaryContent.byteLength
              ),
            };
          });

          const provider = new MSALOneDriveProvider();
          const result = await provider.downloadFile(fileId);

          // For non-text mimeTypes, the result MUST be a Uint8Array
          expect(result).toBeInstanceOf(Uint8Array);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('for any mimeType, downloadFile returns string iff mimeType starts with "text/" and Uint8Array otherwise', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate arbitrary mimeTypes - both text/* and non-text/*
        fc.oneof(
          // text/* mimeTypes
          fc.string({ minLength: 1, maxLength: 30 })
            .filter(s => s.trim().length > 0 && !s.includes('/') && !s.includes(' '))
            .map(s => `text/${s}`),
          // non-text mimeTypes
          fc.constantFrom('application', 'image', 'audio', 'video', 'multipart', 'font')
            .chain(prefix =>
              fc.string({ minLength: 1, maxLength: 30 })
                .filter(s => s.trim().length > 0 && !s.includes('/') && !s.includes(' '))
                .map(s => `${prefix}/${s}`)
            )
        ),
        // Generate arbitrary file IDs
        fc.string({ minLength: 1, maxLength: 50 })
          .filter(s => s.trim().length > 0),
        async (mimeType, fileId) => {
          const sampleContent = 'sample file content for testing';
          const binaryContent = new TextEncoder().encode(sampleContent);

          // Mock fetch: first call returns metadata, second call returns content
          let callCount = 0;
          (global.fetch as jest.Mock).mockImplementation(async (url: string) => {
            callCount++;
            if (callCount === 1) {
              // Metadata request
              return {
                ok: true,
                status: 200,
                json: async () => ({
                  id: fileId,
                  name: 'test-file',
                  lastModifiedDateTime: new Date().toISOString(),
                  size: binaryContent.length,
                  file: { mimeType },
                }),
              };
            }
            // Content download request
            return {
              ok: true,
              status: 200,
              text: async () => sampleContent,
              arrayBuffer: async () => binaryContent.buffer.slice(
                binaryContent.byteOffset,
                binaryContent.byteOffset + binaryContent.byteLength
              ),
            };
          });

          const provider = new MSALOneDriveProvider();
          const result = await provider.downloadFile(fileId);

          // The return type is determined solely by whether mimeType starts with "text/"
          if (mimeType.startsWith('text/')) {
            expect(typeof result).toBe('string');
          } else {
            expect(result).toBeInstanceOf(Uint8Array);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
