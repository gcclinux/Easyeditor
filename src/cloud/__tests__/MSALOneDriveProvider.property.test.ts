/**
 * Property-based tests for MSALOneDriveProvider using fast-check
 * Task 4.5: Property 6 - listFiles correctly maps Graph API response
 *
 * Each property test runs a minimum of 100 iterations.
 *
 * **Validates: Requirements 5.3**
 */

import * as fc from 'fast-check';
import { MSALOneDriveProvider } from '../providers/MSALOneDriveProvider';

// Mock CloudCredentialManager
const mockSaveCredentials = jest.fn().mockResolvedValue(undefined);
const mockGetCredentials = jest.fn().mockResolvedValue(null);
const mockRemoveCredentials = jest.fn().mockResolvedValue(undefined);

jest.mock('../managers/CloudCredentialManager', () => ({
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
jest.mock('../../premium/LicenseManager', () => ({
  __esModule: true,
  default: {
    hasActiveLicense: jest.fn().mockReturnValue(true),
  }
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

// Mock onedrive-credentials
jest.mock('../config/onedrive-credentials', () => ({
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
// Property 6: listFiles correctly maps Graph API response
// Feature: onedrive-integration, Property 6: listFiles correctly maps Graph API response
// Validates: Requirements 5.3
// ============================================================================
describe('Feature: onedrive-integration, Property 6: listFiles correctly maps Graph API response', () => {
  /**
   * Arbitrary for generating valid GraphDriveItem objects that represent files.
   * Each item has an id, name, lastModifiedDateTime (ISO 8601), size, and file.mimeType.
   */
  const graphDriveItemArb = fc.record({
    id: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
    name: fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
    lastModifiedDateTime: fc.date({ min: new Date('2000-01-01'), max: new Date('2030-12-31') })
      .filter(d => !isNaN(d.getTime()))
      .map(d => d.toISOString()),
    size: fc.nat({ max: 4 * 1024 * 1024 }),
    file: fc.record({
      mimeType: fc.oneof(
        fc.constant('text/plain'),
        fc.constant('text/markdown'),
        fc.constant('application/octet-stream'),
        fc.constant('application/json'),
        fc.constant('image/png'),
        fc.string({ minLength: 3, maxLength: 50 }).filter(s => s.includes('/'))
      ),
    }),
  });

  it('for any valid Graph API children response with N file items, listFiles returns exactly N CloudFile objects', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(graphDriveItemArb, { minLength: 0, maxLength: 20 }),
        async (items) => {
          // Setup: provider has valid credentials
          mockGetCredentials.mockResolvedValue({
            provider: 'onedrive',
            accessToken: 'valid-access-token',
            refreshToken: 'valid-refresh-token',
            expiresAt: new Date(Date.now() + 3600000),
            scope: 'Files.ReadWrite.AppFolder offline_access',
          });

          // Mock the Graph API response for listFiles
          (global.fetch as jest.Mock).mockImplementation(async (url: string) => {
            if (url.includes('/children')) {
              return {
                ok: true,
                json: async () => ({ value: items }),
              };
            }
            return { ok: false, status: 404, text: async () => 'not found' };
          });

          const provider = new MSALOneDriveProvider();
          const result = await provider.listFiles('test-folder-id');

          // The number of returned CloudFile objects must equal the number of input items
          // (all items have `file` property so none are filtered out)
          expect(result.length).toBe(items.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('each CloudFile has id, name, modifiedTime, size, and mimeType correctly mapped from the corresponding GraphDriveItem', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(graphDriveItemArb, { minLength: 1, maxLength: 20 }),
        async (items) => {
          // Setup: provider has valid credentials
          mockGetCredentials.mockResolvedValue({
            provider: 'onedrive',
            accessToken: 'valid-access-token',
            refreshToken: 'valid-refresh-token',
            expiresAt: new Date(Date.now() + 3600000),
            scope: 'Files.ReadWrite.AppFolder offline_access',
          });

          // Mock the Graph API response
          (global.fetch as jest.Mock).mockImplementation(async (url: string) => {
            if (url.includes('/children')) {
              return {
                ok: true,
                json: async () => ({ value: items }),
              };
            }
            return { ok: false, status: 404, text: async () => 'not found' };
          });

          const provider = new MSALOneDriveProvider();
          const result = await provider.listFiles('test-folder-id');

          // Verify each CloudFile is correctly mapped from the corresponding GraphDriveItem
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const cloudFile = result[i];

            // id maps directly
            expect(cloudFile.id).toBe(item.id);

            // name maps directly
            expect(cloudFile.name).toBe(item.name);

            // modifiedTime is a valid Date parsed from lastModifiedDateTime
            expect(cloudFile.modifiedTime).toBeInstanceOf(Date);
            expect(cloudFile.modifiedTime.toISOString()).toBe(item.lastModifiedDateTime);

            // size maps directly
            expect(cloudFile.size).toBe(item.size);

            // mimeType maps from file.mimeType
            expect(cloudFile.mimeType).toBe(item.file.mimeType);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('items without file property (folders) are excluded from the result', async () => {
    // Generate a mix of file items and folder items
    const folderItemArb = fc.record({
      id: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
      name: fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
      lastModifiedDateTime: fc.date({ min: new Date('2000-01-01'), max: new Date('2030-12-31') })
        .filter(d => !isNaN(d.getTime()))
        .map(d => d.toISOString()),
      size: fc.nat({ max: 4 * 1024 * 1024 }),
      folder: fc.constant({}),
    });

    const mixedItemsArb = fc.tuple(
      fc.array(graphDriveItemArb, { minLength: 0, maxLength: 10 }),
      fc.array(folderItemArb, { minLength: 0, maxLength: 10 })
    ).map(([files, folders]) => {
      // Interleave files and folders
      const mixed: any[] = [];
      const maxLen = Math.max(files.length, folders.length);
      for (let i = 0; i < maxLen; i++) {
        if (i < files.length) mixed.push(files[i]);
        if (i < folders.length) mixed.push(folders[i]);
      }
      return { mixed, fileCount: files.length };
    });

    await fc.assert(
      fc.asyncProperty(mixedItemsArb, async ({ mixed, fileCount }) => {
        // Setup: provider has valid credentials
        mockGetCredentials.mockResolvedValue({
          provider: 'onedrive',
          accessToken: 'valid-access-token',
          refreshToken: 'valid-refresh-token',
          expiresAt: new Date(Date.now() + 3600000),
          scope: 'Files.ReadWrite.AppFolder offline_access',
        });

        // Mock the Graph API response with mixed items
        (global.fetch as jest.Mock).mockImplementation(async (url: string) => {
          if (url.includes('/children')) {
            return {
              ok: true,
              json: async () => ({ value: mixed }),
            };
          }
          return { ok: false, status: 404, text: async () => 'not found' };
        });

        const provider = new MSALOneDriveProvider();
        const result = await provider.listFiles('test-folder-id');

        // Only file items (those with `file` property) should be returned
        expect(result.length).toBe(fileCount);
      }),
      { numRuns: 100 }
    );
  });

  it('items without file.mimeType default to application/octet-stream', async () => {
    // Generate items where file property exists but mimeType may be undefined
    const itemWithOptionalMimeArb = fc.record({
      id: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
      name: fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
      lastModifiedDateTime: fc.date({ min: new Date('2000-01-01'), max: new Date('2030-12-31') })
        .filter(d => !isNaN(d.getTime()))
        .map(d => d.toISOString()),
      size: fc.nat({ max: 4 * 1024 * 1024 }),
      file: fc.constant({}), // file property exists but no mimeType
    });

    await fc.assert(
      fc.asyncProperty(
        fc.array(itemWithOptionalMimeArb, { minLength: 1, maxLength: 10 }),
        async (items) => {
          // Setup: provider has valid credentials
          mockGetCredentials.mockResolvedValue({
            provider: 'onedrive',
            accessToken: 'valid-access-token',
            refreshToken: 'valid-refresh-token',
            expiresAt: new Date(Date.now() + 3600000),
            scope: 'Files.ReadWrite.AppFolder offline_access',
          });

          // Mock the Graph API response
          (global.fetch as jest.Mock).mockImplementation(async (url: string) => {
            if (url.includes('/children')) {
              return {
                ok: true,
                json: async () => ({ value: items }),
              };
            }
            return { ok: false, status: 404, text: async () => 'not found' };
          });

          const provider = new MSALOneDriveProvider();
          const result = await provider.listFiles('test-folder-id');

          // All items should default to 'application/octet-stream' when mimeType is missing
          for (const cloudFile of result) {
            expect(cloudFile.mimeType).toBe('application/octet-stream');
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
