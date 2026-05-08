/**
 * Unit tests for OAuthOneDriveProvider
 * Task 5.3: Tests authentication flow, timeout, disconnect, file operations, and error handling
 *
 * Requirements: 2.2, 2.4, 2.5, 2.8, 2.9, 5.7, 5.8, 11.1, 11.2
 */

// Mock OAuthManager methods
const mockAuthenticate = jest.fn();
const mockIsAuthenticated = jest.fn();
const mockLogout = jest.fn();
const mockGetValidTokens = jest.fn();
const mockRefreshTokens = jest.fn();
const mockRegisterProvider = jest.fn();

jest.mock('../../../services/oauth/tauri/SharedOAuthManager', () => ({
  getSharedOAuthManager: jest.fn().mockReturnValue({
    authenticate: (...args: any[]) => mockAuthenticate(...args),
    isAuthenticated: (...args: any[]) => mockIsAuthenticated(...args),
    logout: (...args: any[]) => mockLogout(...args),
    getValidTokens: (...args: any[]) => mockGetValidTokens(...args),
    refreshTokens: (...args: any[]) => mockRefreshTokens(...args),
    registerProvider: (...args: any[]) => mockRegisterProvider(...args),
  }),
}));

jest.mock('../../../services/oauth/providers/OneDriveOAuthProvider', () => ({
  OneDriveOAuthProvider: jest.fn().mockImplementation(() => ({
    name: 'onedrive',
    displayName: 'OneDrive',
    clientId: 'test-client-id-valid-long-enough',
    scope: ['Files.ReadWrite.AppFolder', 'offline_access'],
  })),
}));

jest.mock('../../../premium/LicenseManager', () => ({
  __esModule: true,
  default: {
    hasActiveLicense: jest.fn().mockReturnValue(true),
  },
}));

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

// Polyfill TextEncoder/TextDecoder for jsdom
import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = TextEncoder as any;
global.TextDecoder = TextDecoder as any;

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Suppress console noise
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
  mockFetch.mockReset();
});

import { OAuthOneDriveProvider } from '../OAuthOneDriveProvider';

describe('OAuthOneDriveProvider', () => {
  let provider: OAuthOneDriveProvider;

  beforeEach(() => {
    provider = new OAuthOneDriveProvider();
  });

  // ==========================================================================
  // Provider interface and constants
  // ==========================================================================
  describe('CloudProvider interface', () => {
    it('should implement all CloudProvider interface methods', () => {
      expect(provider).toHaveProperty('name');
      expect(provider).toHaveProperty('displayName');
      expect(provider).toHaveProperty('icon');
      expect(provider).toHaveProperty('authenticate');
      expect(provider).toHaveProperty('isAuthenticated');
      expect(provider).toHaveProperty('disconnect');
      expect(provider).toHaveProperty('createApplicationFolder');
      expect(provider).toHaveProperty('listFiles');
      expect(provider).toHaveProperty('downloadFile');
      expect(provider).toHaveProperty('uploadFile');
      expect(provider).toHaveProperty('updateFile');
      expect(provider).toHaveProperty('deleteFile');
    });

    it('should have correct provider constants', () => {
      expect(provider.name).toBe('onedrive');
      expect(provider.displayName).toBe('OneDrive');
      expect(provider.icon).toBe('☁️');
    });
  });

  // ==========================================================================
  // Authentication flow (Requirement 2.2, 2.4, 2.5)
  // ==========================================================================
  describe('authenticate', () => {
    it('should return successful AuthResult when OAuth succeeds', async () => {
      const futureDate = new Date(Date.now() + 3600000);
      mockAuthenticate.mockResolvedValue({
        success: true,
        tokens: {
          accessToken: 'test-access-token',
          refreshToken: 'test-refresh-token',
          expiresAt: futureDate,
        },
      });

      const result = await provider.authenticate();

      expect(result.success).toBe(true);
      expect(result.accessToken).toBe('test-access-token');
      expect(result.refreshToken).toBe('test-refresh-token');
      expect(result.expiresAt).toEqual(futureDate);
      expect(mockAuthenticate).toHaveBeenCalledWith('onedrive');
    });

    it('should return error when OAuth authentication fails', async () => {
      mockAuthenticate.mockResolvedValue({
        success: false,
        errorDescription: 'User denied access',
      });

      const result = await provider.authenticate();

      expect(result.success).toBe(false);
      expect(result.error).toBe('User denied access');
    });

    it('should return error when OAuth succeeds but no tokens received', async () => {
      mockAuthenticate.mockResolvedValue({
        success: true,
        tokens: null,
      });

      const result = await provider.authenticate();

      expect(result.success).toBe(false);
      expect(result.error).toContain('no tokens received');
    });

    it('should return error when no premium license', async () => {
      const LicenseManager = require('../../../premium/LicenseManager').default;
      LicenseManager.hasActiveLicense.mockReturnValueOnce(false);

      const result = await provider.authenticate();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Premium license required');
    });

    it('should return error when not configured', async () => {
      const { isOneDriveConfigured, getConfigurationErrorMessage } = require('../../config/onedrive-credentials');
      isOneDriveConfigured.mockReturnValueOnce(false);
      getConfigurationErrorMessage.mockReturnValueOnce('OneDrive client ID is not configured');

      const result = await provider.authenticate();

      expect(result.success).toBe(false);
      expect(result.error).toBe('OneDrive client ID is not configured');
    });

    it('should handle user cancellation errors', async () => {
      mockAuthenticate.mockRejectedValue(new Error('User cancelled the authentication'));

      const result = await provider.authenticate();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Authentication window was closed');
    });

    it('should handle network errors during authentication', async () => {
      mockAuthenticate.mockRejectedValue(new Error('Network error: ECONNREFUSED'));

      const result = await provider.authenticate();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });

    it('should handle generic errors during authentication', async () => {
      mockAuthenticate.mockRejectedValue(new Error('Something unexpected happened'));

      const result = await provider.authenticate();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Something unexpected happened');
    });
  });

  // ==========================================================================
  // 5-minute timeout behavior (Requirement 2.8)
  // ==========================================================================
  describe('authenticate timeout', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return timeout error when authentication takes longer than 5 minutes', async () => {
      // Make authenticate never resolve
      mockAuthenticate.mockImplementation(
        () => new Promise(() => {}) // never resolves
      );

      const authPromise = provider.authenticate();

      // Advance time past the 5-minute timeout
      jest.advanceTimersByTime(5 * 60 * 1000 + 1);

      const result = await authPromise;

      expect(result.success).toBe(false);
      expect(result.error).toBe('Authentication timeout');
    });

    it('should succeed if authentication completes before timeout', async () => {
      const futureDate = new Date(Date.now() + 3600000);
      mockAuthenticate.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                success: true,
                tokens: {
                  accessToken: 'token',
                  refreshToken: 'refresh',
                  expiresAt: futureDate,
                },
              });
            }, 1000);
          })
      );

      const authPromise = provider.authenticate();

      // Advance time by 1 second (before timeout)
      jest.advanceTimersByTime(1000);

      const result = await authPromise;

      expect(result.success).toBe(true);
      expect(result.accessToken).toBe('token');
    });
  });

  // ==========================================================================
  // isAuthenticated (Requirement 2.7)
  // ==========================================================================
  describe('isAuthenticated', () => {
    it('should return true when OAuth manager reports authenticated', async () => {
      mockIsAuthenticated.mockResolvedValue(true);

      const result = await provider.isAuthenticated();

      expect(result).toBe(true);
      expect(mockIsAuthenticated).toHaveBeenCalledWith('onedrive');
    });

    it('should return false when OAuth manager reports not authenticated', async () => {
      mockIsAuthenticated.mockResolvedValue(false);

      const result = await provider.isAuthenticated();

      expect(result).toBe(false);
    });

    it('should return false when OAuth manager throws an error', async () => {
      mockIsAuthenticated.mockRejectedValue(new Error('Token store corrupted'));

      const result = await provider.isAuthenticated();

      expect(result).toBe(false);
    });
  });

  // ==========================================================================
  // Disconnect (Requirements 11.1, 11.2)
  // ==========================================================================
  describe('disconnect', () => {
    it('should call OAuth manager logout', async () => {
      mockLogout.mockResolvedValue(undefined);

      await provider.disconnect();

      expect(mockLogout).toHaveBeenCalledWith('onedrive');
    });

    it('should clear credentials even when revocation fails', async () => {
      mockLogout.mockRejectedValue(new Error('Token revocation failed'));

      // Should not throw
      await expect(provider.disconnect()).resolves.not.toThrow();
    });

    it('should reset internal state after disconnect', async () => {
      // First, set up the application folder ID by simulating a successful folder creation
      mockGetValidTokens.mockResolvedValue({
        accessToken: 'test-token',
        refreshToken: 'test-refresh',
        expiresAt: new Date(Date.now() + 3600000),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          value: [{ id: 'folder-123', name: 'Easyeditor', folder: {}, lastModifiedDateTime: '2024-01-01T00:00:00Z', size: 0 }],
        }),
      });

      await provider.createApplicationFolder();

      // Now disconnect
      mockLogout.mockResolvedValue(undefined);
      await provider.disconnect();

      // After disconnect, createApplicationFolder should make a new API call (not use cached ID)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          value: [{ id: 'folder-456', name: 'Easyeditor', folder: {}, lastModifiedDateTime: '2024-01-01T00:00:00Z', size: 0 }],
        }),
      });

      const folderId = await provider.createApplicationFolder();
      expect(folderId).toBe('folder-456');
    });
  });

  // ==========================================================================
  // File operations with mocked Graph API responses (Requirements 5.7, 5.8)
  // ==========================================================================
  describe('createApplicationFolder', () => {
    beforeEach(() => {
      mockGetValidTokens.mockResolvedValue({
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresAt: new Date(Date.now() + 3600000),
      });
    });

    it('should find existing folder', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          value: [
            { id: 'existing-folder-id', name: 'Easyeditor', folder: {}, lastModifiedDateTime: '2024-01-01T00:00:00Z', size: 0 },
          ],
        }),
      });

      const folderId = await provider.createApplicationFolder();

      expect(folderId).toBe('existing-folder-id');
    });

    it('should create folder when none exists', async () => {
      // First call: search returns empty
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ value: [] }),
      });

      // Second call: create folder
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ id: 'new-folder-id', name: 'Easyeditor', folder: {} }),
      });

      const folderId = await provider.createApplicationFolder();

      expect(folderId).toBe('new-folder-id');
    });

    it('should throw error when not authenticated', async () => {
      mockGetValidTokens.mockResolvedValue(null);

      await expect(provider.createApplicationFolder()).rejects.toThrow('Authentication required');
    });

    it('should throw network error when fetch fails', async () => {
      // First fetch (findApplicationFolder) - fails but is caught internally
      mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'));
      // Second fetch (create folder POST) - also fails with TypeError
      mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'));

      await expect(provider.createApplicationFolder()).rejects.toThrow('Network request could not be completed');
    });
  });

  describe('listFiles', () => {
    beforeEach(() => {
      mockGetValidTokens.mockResolvedValue({
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresAt: new Date(Date.now() + 3600000),
      });
    });

    it('should return mapped CloudFile array from Graph API response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          value: [
            {
              id: 'file-1',
              name: 'note1.md',
              lastModifiedDateTime: '2024-06-15T10:30:00Z',
              size: 1024,
              file: { mimeType: 'text/markdown' },
            },
            {
              id: 'file-2',
              name: 'note2.sstp',
              lastModifiedDateTime: '2024-06-16T14:00:00Z',
              size: 2048,
              file: { mimeType: 'application/octet-stream' },
            },
          ],
        }),
      });

      const files = await provider.listFiles('folder-id');

      expect(files).toHaveLength(2);
      expect(files[0]).toEqual({
        id: 'file-1',
        name: 'note1.md',
        modifiedTime: new Date('2024-06-15T10:30:00Z'),
        size: 1024,
        mimeType: 'text/markdown',
      });
      expect(files[1]).toEqual({
        id: 'file-2',
        name: 'note2.sstp',
        modifiedTime: new Date('2024-06-16T14:00:00Z'),
        size: 2048,
        mimeType: 'application/octet-stream',
      });
    });

    it('should filter out folders from results', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          value: [
            {
              id: 'file-1',
              name: 'note.md',
              lastModifiedDateTime: '2024-06-15T10:30:00Z',
              size: 512,
              file: { mimeType: 'text/markdown' },
            },
            {
              id: 'folder-1',
              name: 'subfolder',
              lastModifiedDateTime: '2024-06-15T10:30:00Z',
              size: 0,
              folder: {},
            },
          ],
        }),
      });

      const files = await provider.listFiles('folder-id');

      expect(files).toHaveLength(1);
      expect(files[0].name).toBe('note.md');
    });

    it('should return empty array when folder is empty', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ value: [] }),
      });

      const files = await provider.listFiles('folder-id');

      expect(files).toHaveLength(0);
    });
  });

  describe('downloadFile', () => {
    beforeEach(() => {
      mockGetValidTokens.mockResolvedValue({
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresAt: new Date(Date.now() + 3600000),
      });
    });

    it('should return string for text files', async () => {
      // Metadata request
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'file-1',
          name: 'note.md',
          file: { mimeType: 'text/markdown' },
        }),
      });

      // Content request
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => '# Hello World',
        arrayBuffer: async () => new ArrayBuffer(0),
      });

      const content = await provider.downloadFile('file-1');

      expect(typeof content).toBe('string');
      expect(content).toBe('# Hello World');
    });

    it('should return Uint8Array for binary files', async () => {
      const binaryData = new Uint8Array([0x00, 0x01, 0x02, 0x03]);

      // Metadata request
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'file-2',
          name: 'note.sstp',
          file: { mimeType: 'application/octet-stream' },
        }),
      });

      // Content request
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        arrayBuffer: async () => binaryData.buffer,
      });

      const content = await provider.downloadFile('file-2');

      expect(content).toBeInstanceOf(Uint8Array);
      expect(content).toEqual(binaryData);
    });

    it('should throw error on non-2xx response for content download', async () => {
      // Metadata request succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'file-1',
          name: 'note.md',
          file: { mimeType: 'text/markdown' },
        }),
      });

      // Content request fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => JSON.stringify({ error: { message: 'Item not found' } }),
      });

      await expect(provider.downloadFile('file-1')).rejects.toThrow(/404/);
    });
  });

  describe('uploadFile', () => {
    beforeEach(() => {
      mockGetValidTokens.mockResolvedValue({
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresAt: new Date(Date.now() + 3600000),
      });
    });

    it('should upload text file and return CloudFile', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          id: 'new-file-id',
          name: 'test.md',
          lastModifiedDateTime: '2024-06-15T10:30:00Z',
          size: 13,
          file: { mimeType: 'text/markdown' },
        }),
      });

      const result = await provider.uploadFile('folder-id', 'test.md', '# Hello World');

      expect(result.id).toBe('new-file-id');
      expect(result.name).toBe('test.md');
      expect(result.size).toBe(13);
      expect(result.mimeType).toBe('text/markdown');
    });

    it('should upload binary file and return CloudFile', async () => {
      const binaryContent = new Uint8Array([0x01, 0x02, 0x03]);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          id: 'binary-file-id',
          name: 'note.sstp',
          lastModifiedDateTime: '2024-06-15T10:30:00Z',
          size: 3,
          file: { mimeType: 'application/octet-stream' },
        }),
      });

      const result = await provider.uploadFile('folder-id', 'note.sstp', binaryContent);

      expect(result.id).toBe('binary-file-id');
      expect(result.name).toBe('note.sstp');
      expect(result.mimeType).toBe('application/octet-stream');
    });

    it('should throw error when file exceeds 4MB', async () => {
      const largeContent = 'x'.repeat(4 * 1024 * 1024 + 1);

      await expect(provider.uploadFile('folder-id', 'large.md', largeContent)).rejects.toThrow(
        'File exceeds maximum upload size'
      );
    });

    it('should throw network error when fetch fails', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'));

      await expect(provider.uploadFile('folder-id', 'test.md', 'content')).rejects.toThrow(
        'Network request could not be completed'
      );
    });
  });

  describe('updateFile', () => {
    beforeEach(() => {
      mockGetValidTokens.mockResolvedValue({
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresAt: new Date(Date.now() + 3600000),
      });
    });

    it('should update file and return updated CloudFile', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'file-id',
          name: 'note.md',
          lastModifiedDateTime: '2024-06-16T12:00:00Z',
          size: 20,
          file: { mimeType: 'text/markdown' },
        }),
      });

      const result = await provider.updateFile('file-id', '# Updated content');

      expect(result.id).toBe('file-id');
      expect(result.name).toBe('note.md');
      expect(result.size).toBe(20);
      expect(result.modifiedTime).toEqual(new Date('2024-06-16T12:00:00Z'));
    });

    it('should throw error when file exceeds 4MB', async () => {
      const largeContent = new Uint8Array(4 * 1024 * 1024 + 1);

      await expect(provider.updateFile('file-id', largeContent)).rejects.toThrow(
        'File exceeds maximum upload size'
      );
    });
  });

  describe('deleteFile', () => {
    beforeEach(() => {
      mockGetValidTokens.mockResolvedValue({
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresAt: new Date(Date.now() + 3600000),
      });
    });

    it('should delete file successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        text: async () => '',
      });

      await expect(provider.deleteFile('file-id')).resolves.not.toThrow();
    });

    it('should throw error on non-2xx response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: async () => JSON.stringify({ error: { message: 'Access denied' } }),
      });

      await expect(provider.deleteFile('file-id')).rejects.toThrow(/403/);
    });
  });

  // ==========================================================================
  // Error handling for various HTTP status codes (Requirements 5.7, 5.8)
  // ==========================================================================
  describe('error handling', () => {
    beforeEach(() => {
      mockGetValidTokens.mockResolvedValue({
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresAt: new Date(Date.now() + 3600000),
      });
    });

    it('should include status code 401 in error message and attempt refresh', async () => {
      // First call returns 401
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ error: { message: 'Token expired' } }),
      });

      // Refresh attempt
      mockRefreshTokens.mockResolvedValue(true);

      // Retry after refresh also fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ error: { message: 'Token expired' } }),
      });

      await expect(provider.listFiles('folder-id')).rejects.toThrow(/401/);
    });

    it('should include status code 403 in error message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: async () => JSON.stringify({ error: { message: 'Insufficient permissions' } }),
      });

      await expect(provider.listFiles('folder-id')).rejects.toThrow(/Permission denied.*403/);
    });

    it('should include status code 404 in error message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => JSON.stringify({ error: { message: 'Item does not exist' } }),
      });

      await expect(provider.listFiles('folder-id')).rejects.toThrow(/not found.*404/);
    });

    it('should include status code 429 in error message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => JSON.stringify({ error: { message: 'Too many requests' } }),
      });

      await expect(provider.listFiles('folder-id')).rejects.toThrow(/Rate limited.*429/);
    });

    it('should include status code 500 in error message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => JSON.stringify({ error: { message: 'Internal server error' } }),
      });

      await expect(provider.listFiles('folder-id')).rejects.toThrow(/server error.*500/);
    });

    it('should throw network error when fetch throws TypeError', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

      await expect(provider.listFiles('folder-id')).rejects.toThrow(
        'Network request could not be completed'
      );
    });

    it('should handle non-JSON error responses gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
        text: async () => 'Bad Gateway',
      });

      await expect(provider.listFiles('folder-id')).rejects.toThrow(/502/);
    });
  });

  // ==========================================================================
  // Constructor behavior
  // ==========================================================================
  describe('constructor', () => {
    it('should register the OneDrive OAuth provider', () => {
      new OAuthOneDriveProvider();
      expect(mockRegisterProvider).toHaveBeenCalled();
    });

    it('should warn when configuration is missing', () => {
      const { isOneDriveConfigured, getConfigurationErrorMessage } = require('../../config/onedrive-credentials');
      isOneDriveConfigured.mockReturnValueOnce(false);
      getConfigurationErrorMessage.mockReturnValueOnce('OneDrive is not configured');

      const consoleSpy = jest.spyOn(console, 'warn');

      new OAuthOneDriveProvider();

      expect(consoleSpy).toHaveBeenCalledWith(
        '[OAuthOneDriveProvider] Configuration warning:',
        'OneDrive is not configured'
      );
    });
  });
});
