/**
 * Backward Compatibility Integration Tests
 * Task 10.2: Verifies that existing providers (Google Drive, Dropbox, Box)
 * continue to authenticate, list, upload, download, update, and delete
 * with OneDrive registered alongside them.
 *
 * Also verifies:
 * - Sidebar renders existing providers with same display name, icon, and behavior
 * - OneDrive failure during init does not affect other providers
 *
 * Validates: Requirements 9.1, 9.2, 9.3
 */

// Mock environment utility
const mockIsTauriEnvironment = jest.fn();
jest.mock('../../utils/environment', () => ({
  isTauriEnvironment: () => mockIsTauriEnvironment(),
}));

// Mock FEATURES config
jest.mock('../../config/features', () => ({
  FEATURES: { EASY_NOTES: true },
}));

// Mock CloudCredentialManager
jest.mock('../managers/CloudCredentialManager', () => ({
  cloudCredentialManager: {
    saveCredentials: jest.fn().mockResolvedValue(undefined),
    getCredentials: jest.fn().mockResolvedValue(null),
    removeCredentials: jest.fn().mockResolvedValue(undefined),
    updateCredentials: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock LicenseManager
jest.mock('../../premium/LicenseManager', () => ({
  __esModule: true,
  default: {
    hasActiveLicense: jest.fn().mockReturnValue(true),
  },
}));

// Mock onedrive-credentials
jest.mock('../config/onedrive-credentials', () => ({
  ONEDRIVE_CONFIG: {
    CLIENT_ID: 'test-onedrive-client-id-valid',
    CLIENT_SECRET: 'test-onedrive-client-secret-valid',
    REDIRECT_URI: 'http://localhost:3024/onedrive-oauth-callback.html',
    SCOPES: ['Files.ReadWrite.AppFolder', 'offline_access'],
    AUTHORIZED_DOMAINS: ['http://localhost:3024'],
  },
  isOneDriveConfigured: jest.fn().mockReturnValue(true),
  getConfigurationErrorMessage: jest.fn().mockReturnValue(''),
}));

// Mock box-credentials
jest.mock('../config/box-credentials', () => ({
  BOX_CONFIG: {
    CLIENT_ID: 'test-box-client-id',
    CLIENT_SECRET: 'test-box-client-secret',
    REDIRECT_URI: 'http://localhost:3024/box-oauth-callback.html',
    SCOPES: ['root_readwrite'],
    AUTHORIZED_DOMAINS: ['http://localhost:3024'],
  },
  isBoxConfigured: jest.fn().mockReturnValue(true),
  getConfigurationErrorMessage: jest.fn().mockReturnValue(''),
  isTauriEnvironment: jest.fn().mockReturnValue(false),
}));

// Mock dropbox-credentials
jest.mock('../config/dropbox-credentials', () => ({
  DROPBOX_CONFIG: {
    CLIENT_ID: 'test-dropbox-client-id',
    CLIENT_SECRET: 'test-dropbox-client-secret',
    REDIRECT_URI: 'http://localhost:3024/dropbox-oauth-callback.html',
  },
  isDropboxConfigured: jest.fn().mockReturnValue(true),
  getConfigurationErrorMessage: jest.fn().mockReturnValue(''),
  isTauriEnvironment: jest.fn().mockReturnValue(false),
}));

// Mock MetadataManager
jest.mock('../managers/MetadataManager', () => ({
  MetadataManager: jest.fn().mockImplementation(() => ({
    getAllNotes: jest.fn().mockReturnValue([]),
    getNoteById: jest.fn().mockReturnValue(null),
    addNote: jest.fn(),
    updateNote: jest.fn(),
    deleteNote: jest.fn(),
  })),
}));

// Mock FileSynchronizer
jest.mock('../managers/FileSynchronizer', () => ({
  FileSynchronizer: jest.fn().mockImplementation(() => ({
    sync: jest.fn().mockResolvedValue({ synced: 0, conflicts: 0 }),
  })),
}));

// Mock ErrorHandler
jest.mock('../utils/ErrorHandler', () => ({
  ErrorHandler: {
    handle: jest.fn(),
    handleWithToast: jest.fn(),
  },
}));

// Mock CloudToastService
jest.mock('../utils/CloudToastService', () => ({
  cloudToastService: {
    showSuccess: jest.fn(),
    showError: jest.fn(),
    showInfo: jest.fn(),
  },
}));

// Mock OfflineManager
jest.mock('../utils/OfflineManager', () => ({
  offlineManager: {
    isOnline: jest.fn().mockReturnValue(true),
    withOfflineFallback: jest.fn().mockImplementation(async (fn: () => Promise<any>) => fn()),
  },
}));

// Mock crypto-js
jest.mock('crypto-js', () => ({
  SHA256: jest.fn().mockReturnValue({ toString: () => 'mock-hash' }),
}));

// --- Provider mocks with full CloudProvider interface ---

const createMockProvider = (name: string, displayName: string, icon: string) => {
  const files = new Map<string, any>();
  const fileContents = new Map<string, string | Uint8Array>();
  let authenticated = false;
  let folderId = `${name}-app-folder-id`;

  return {
    name,
    displayName,
    icon,
    authenticate: jest.fn().mockImplementation(async () => {
      authenticated = true;
      return {
        success: true,
        accessToken: `${name}-access-token`,
        refreshToken: `${name}-refresh-token`,
        expiresAt: new Date(Date.now() + 3600000),
      };
    }),
    isAuthenticated: jest.fn().mockImplementation(async () => authenticated),
    disconnect: jest.fn().mockImplementation(async () => {
      authenticated = false;
    }),
    createApplicationFolder: jest.fn().mockImplementation(async () => folderId),
    listFiles: jest.fn().mockImplementation(async () => Array.from(files.values())),
    uploadFile: jest.fn().mockImplementation(async (_folderId: string, fileName: string, content: string | Uint8Array) => {
      const fileId = `${name}-file-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const cloudFile = {
        id: fileId,
        name: fileName,
        modifiedTime: new Date(),
        size: typeof content === 'string' ? content.length : content.byteLength,
        mimeType: fileName.endsWith('.md') ? 'text/markdown' : 'application/octet-stream',
      };
      files.set(fileId, cloudFile);
      fileContents.set(fileId, content);
      return cloudFile;
    }),
    downloadFile: jest.fn().mockImplementation(async (fileId: string) => {
      const content = fileContents.get(fileId);
      if (!content) throw new Error(`File not found: ${fileId}`);
      return content;
    }),
    updateFile: jest.fn().mockImplementation(async (fileId: string, content: string | Uint8Array) => {
      const existing = files.get(fileId);
      if (!existing) throw new Error(`File not found: ${fileId}`);
      const updated = {
        ...existing,
        modifiedTime: new Date(),
        size: typeof content === 'string' ? content.length : content.byteLength,
      };
      files.set(fileId, updated);
      fileContents.set(fileId, content);
      return updated;
    }),
    deleteFile: jest.fn().mockImplementation(async (fileId: string) => {
      files.delete(fileId);
      fileContents.delete(fileId);
    }),
    // Test helpers
    _getFiles: () => files,
    _getFileContents: () => fileContents,
    _reset: () => {
      files.clear();
      fileContents.clear();
      authenticated = false;
    },
  };
};

// Create mock providers
const mockGoogleDrive = createMockProvider('google-drive', 'Google Drive', '📁');
const mockDropbox = createMockProvider('dropbox', 'Dropbox', '💧');
const mockBox = createMockProvider('box', 'Box', '📦');
const mockOneDrive = createMockProvider('onedrive', 'OneDrive', '☁️');

// Mock GISGoogleDriveProvider (web)
jest.mock('../providers/GISGoogleDriveProvider', () => ({
  GISGoogleDriveProvider: jest.fn().mockImplementation(() => mockGoogleDrive),
}));

// Mock DropboxProvider (web)
jest.mock('../providers/DropboxProvider', () => ({
  DropboxProvider: jest.fn().mockImplementation(() => mockDropbox),
}));

// Mock BoxProvider (web)
jest.mock('../providers/BoxProvider', () => ({
  BoxProvider: jest.fn().mockImplementation(() => mockBox),
}));

// Mock MSALOneDriveProvider (web)
jest.mock('../providers/MSALOneDriveProvider', () => ({
  MSALOneDriveProvider: jest.fn().mockImplementation(() => mockOneDrive),
}));

// Mock OAuthGoogleDriveProvider (Tauri)
jest.mock('../providers/OAuthGoogleDriveProvider', () => ({
  OAuthGoogleDriveProvider: jest.fn().mockImplementation(() => mockGoogleDrive),
}));

// Mock OAuthDropboxProvider (Tauri)
jest.mock('../providers/OAuthDropboxProvider', () => ({
  OAuthDropboxProvider: jest.fn().mockImplementation(() => mockDropbox),
}));

// Mock OAuthBoxProvider (Tauri)
jest.mock('../providers/OAuthBoxProvider', () => ({
  OAuthBoxProvider: jest.fn().mockImplementation(() => mockBox),
}));

// Mock OAuthOneDriveProvider (Tauri)
jest.mock('../providers/OAuthOneDriveProvider', () => ({
  OAuthOneDriveProvider: jest.fn().mockImplementation(() => mockOneDrive),
}));

// Suppress console noise
beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  jest.restoreAllMocks();
});

describe('Backward Compatibility Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockGoogleDrive._reset();
    mockDropbox._reset();
    mockBox._reset();
    mockOneDrive._reset();
  });

  describe('Existing providers authenticate with OneDrive registered (Requirement 9.1)', () => {
    it('should allow Google Drive to authenticate when OneDrive is registered in web environment', async () => {
      mockIsTauriEnvironment.mockReturnValue(false);

      const { CloudManager } = await import('../managers/CloudManager');
      const manager = new CloudManager();

      const providers = await manager.getAvailableProviders();
      expect(providers.find(p => p.name === 'onedrive')).toBeDefined();

      // Google Drive should authenticate successfully
      const googleProvider = providers.find(p => p.name === 'google-drive');
      expect(googleProvider).toBeDefined();

      const authResult = await googleProvider!.authenticate();
      expect(authResult.success).toBe(true);
      expect(authResult.accessToken).toBeDefined();
      expect(authResult.refreshToken).toBeDefined();

      const isAuth = await googleProvider!.isAuthenticated();
      expect(isAuth).toBe(true);
    });

    it('should allow Dropbox to authenticate when OneDrive is registered in web environment', async () => {
      mockIsTauriEnvironment.mockReturnValue(false);

      const { CloudManager } = await import('../managers/CloudManager');
      const manager = new CloudManager();

      const providers = await manager.getAvailableProviders();
      expect(providers.find(p => p.name === 'onedrive')).toBeDefined();

      const dropboxProvider = providers.find(p => p.name === 'dropbox');
      expect(dropboxProvider).toBeDefined();

      const authResult = await dropboxProvider!.authenticate();
      expect(authResult.success).toBe(true);
      expect(authResult.accessToken).toBeDefined();

      const isAuth = await dropboxProvider!.isAuthenticated();
      expect(isAuth).toBe(true);
    });

    it('should allow Box to authenticate when OneDrive is registered in web environment', async () => {
      mockIsTauriEnvironment.mockReturnValue(false);

      const { CloudManager } = await import('../managers/CloudManager');
      const manager = new CloudManager();

      const providers = await manager.getAvailableProviders();
      expect(providers.find(p => p.name === 'onedrive')).toBeDefined();

      const boxProvider = providers.find(p => p.name === 'box');
      expect(boxProvider).toBeDefined();

      const authResult = await boxProvider!.authenticate();
      expect(authResult.success).toBe(true);
      expect(authResult.accessToken).toBeDefined();

      const isAuth = await boxProvider!.isAuthenticated();
      expect(isAuth).toBe(true);
    });

    it('should allow all existing providers to authenticate in Tauri environment with OneDrive', async () => {
      mockIsTauriEnvironment.mockReturnValue(true);

      const { CloudManager } = await import('../managers/CloudManager');
      const manager = new CloudManager();

      const providers = await manager.getAvailableProviders();
      expect(providers.find(p => p.name === 'onedrive')).toBeDefined();

      for (const providerName of ['google-drive', 'dropbox', 'box']) {
        const provider = providers.find(p => p.name === providerName);
        expect(provider).toBeDefined();

        const authResult = await provider!.authenticate();
        expect(authResult.success).toBe(true);
        expect(authResult.accessToken).toBeDefined();
      }
    });
  });

  describe('Existing providers list, upload, download, update, delete with OneDrive registered (Requirement 9.1)', () => {
    it('should allow Google Drive to perform full CRUD lifecycle with OneDrive present', async () => {
      mockIsTauriEnvironment.mockReturnValue(false);

      const { CloudManager } = await import('../managers/CloudManager');
      const manager = new CloudManager();

      const providers = await manager.getAvailableProviders();
      const googleProvider = providers.find(p => p.name === 'google-drive')!;

      // Authenticate
      await googleProvider.authenticate();

      // Create application folder
      const folderId = await googleProvider.createApplicationFolder();
      expect(folderId).toBeDefined();
      expect(typeof folderId).toBe('string');

      // Upload a file
      const uploadedFile = await googleProvider.uploadFile(folderId, 'test-note.md', '# Test Note\nContent');
      expect(uploadedFile.id).toBeDefined();
      expect(uploadedFile.name).toBe('test-note.md');
      expect(uploadedFile.size).toBeGreaterThan(0);

      // List files
      const files = await googleProvider.listFiles(folderId);
      expect(files.length).toBe(1);
      expect(files[0].name).toBe('test-note.md');

      // Download file
      const content = await googleProvider.downloadFile(uploadedFile.id);
      expect(content).toBe('# Test Note\nContent');

      // Update file
      const updatedFile = await googleProvider.updateFile(uploadedFile.id, '# Updated Note\nNew content');
      expect(updatedFile.id).toBe(uploadedFile.id);
      expect(updatedFile.size).toBeGreaterThan(0);

      // Verify updated content
      const updatedContent = await googleProvider.downloadFile(uploadedFile.id);
      expect(updatedContent).toBe('# Updated Note\nNew content');

      // Delete file
      await googleProvider.deleteFile(uploadedFile.id);
      const filesAfterDelete = await googleProvider.listFiles(folderId);
      expect(filesAfterDelete.length).toBe(0);
    });

    it('should allow Dropbox to perform full CRUD lifecycle with OneDrive present', async () => {
      mockIsTauriEnvironment.mockReturnValue(false);

      const { CloudManager } = await import('../managers/CloudManager');
      const manager = new CloudManager();

      const providers = await manager.getAvailableProviders();
      const dropboxProvider = providers.find(p => p.name === 'dropbox')!;

      await dropboxProvider.authenticate();

      const folderId = await dropboxProvider.createApplicationFolder();
      expect(folderId).toBeDefined();

      // Upload
      const uploaded = await dropboxProvider.uploadFile(folderId, 'dropbox-note.md', '# Dropbox Note');
      expect(uploaded.name).toBe('dropbox-note.md');

      // List
      const files = await dropboxProvider.listFiles(folderId);
      expect(files.length).toBe(1);

      // Download
      const content = await dropboxProvider.downloadFile(uploaded.id);
      expect(content).toBe('# Dropbox Note');

      // Update
      const updated = await dropboxProvider.updateFile(uploaded.id, '# Updated Dropbox Note');
      expect(updated.id).toBe(uploaded.id);

      // Delete
      await dropboxProvider.deleteFile(uploaded.id);
      const filesAfterDelete = await dropboxProvider.listFiles(folderId);
      expect(filesAfterDelete.length).toBe(0);
    });

    it('should allow Box to perform full CRUD lifecycle with OneDrive present', async () => {
      mockIsTauriEnvironment.mockReturnValue(false);

      const { CloudManager } = await import('../managers/CloudManager');
      const manager = new CloudManager();

      const providers = await manager.getAvailableProviders();
      const boxProvider = providers.find(p => p.name === 'box')!;

      await boxProvider.authenticate();

      const folderId = await boxProvider.createApplicationFolder();
      expect(folderId).toBeDefined();

      // Upload
      const uploaded = await boxProvider.uploadFile(folderId, 'box-note.md', '# Box Note');
      expect(uploaded.name).toBe('box-note.md');

      // List
      const files = await boxProvider.listFiles(folderId);
      expect(files.length).toBe(1);

      // Download
      const content = await boxProvider.downloadFile(uploaded.id);
      expect(content).toBe('# Box Note');

      // Update
      const updated = await boxProvider.updateFile(uploaded.id, '# Updated Box Note');
      expect(updated.id).toBe(uploaded.id);

      // Delete
      await boxProvider.deleteFile(uploaded.id);
      const filesAfterDelete = await boxProvider.listFiles(folderId);
      expect(filesAfterDelete.length).toBe(0);
    });

    it('should allow all providers to operate independently and simultaneously', async () => {
      mockIsTauriEnvironment.mockReturnValue(false);

      const { CloudManager } = await import('../managers/CloudManager');
      const manager = new CloudManager();

      const providers = await manager.getAvailableProviders();

      // Authenticate all providers including OneDrive
      for (const provider of providers) {
        const result = await provider.authenticate();
        expect(result.success).toBe(true);
      }

      // Upload a file to each provider
      for (const provider of providers) {
        const folderId = await provider.createApplicationFolder();
        const uploaded = await provider.uploadFile(folderId, `${provider.name}-note.md`, `# ${provider.displayName} Note`);
        expect(uploaded.name).toBe(`${provider.name}-note.md`);
      }

      // Verify each provider only sees its own files
      const googleProvider = providers.find(p => p.name === 'google-drive')!;
      const googleFolder = await googleProvider.createApplicationFolder();
      const googleFiles = await googleProvider.listFiles(googleFolder);
      expect(googleFiles.length).toBe(1);
      expect(googleFiles[0].name).toBe('google-drive-note.md');

      const dropboxProvider = providers.find(p => p.name === 'dropbox')!;
      const dropboxFolder = await dropboxProvider.createApplicationFolder();
      const dropboxFiles = await dropboxProvider.listFiles(dropboxFolder);
      expect(dropboxFiles.length).toBe(1);
      expect(dropboxFiles[0].name).toBe('dropbox-note.md');

      const boxProvider = providers.find(p => p.name === 'box')!;
      const boxFolder = await boxProvider.createApplicationFolder();
      const boxFiles = await boxProvider.listFiles(boxFolder);
      expect(boxFiles.length).toBe(1);
      expect(boxFiles[0].name).toBe('box-note.md');
    });
  });

  describe('Sidebar renders existing providers with same display name, icon, and behavior (Requirement 9.2)', () => {
    it('should preserve Google Drive display name and icon with OneDrive registered', async () => {
      mockIsTauriEnvironment.mockReturnValue(false);

      const { CloudManager } = await import('../managers/CloudManager');
      const manager = new CloudManager();

      const providers = await manager.getAvailableProviders();
      const googleProvider = providers.find(p => p.name === 'google-drive');

      expect(googleProvider).toBeDefined();
      expect(googleProvider!.displayName).toBe('Google Drive');
      expect(googleProvider!.icon).toBe('📁');
    });

    it('should preserve Dropbox display name and icon with OneDrive registered', async () => {
      mockIsTauriEnvironment.mockReturnValue(false);

      const { CloudManager } = await import('../managers/CloudManager');
      const manager = new CloudManager();

      const providers = await manager.getAvailableProviders();
      const dropboxProvider = providers.find(p => p.name === 'dropbox');

      expect(dropboxProvider).toBeDefined();
      expect(dropboxProvider!.displayName).toBe('Dropbox');
      expect(dropboxProvider!.icon).toBe('💧');
    });

    it('should preserve Box display name and icon with OneDrive registered', async () => {
      mockIsTauriEnvironment.mockReturnValue(false);

      const { CloudManager } = await import('../managers/CloudManager');
      const manager = new CloudManager();

      const providers = await manager.getAvailableProviders();
      const boxProvider = providers.find(p => p.name === 'box');

      expect(boxProvider).toBeDefined();
      expect(boxProvider!.displayName).toBe('Box');
      expect(boxProvider!.icon).toBe('📦');
    });

    it('should maintain all four providers with distinct icons in web environment', async () => {
      mockIsTauriEnvironment.mockReturnValue(false);

      const { CloudManager } = await import('../managers/CloudManager');
      const manager = new CloudManager();

      const providers = await manager.getAvailableProviders();

      const expectedProviders = [
        { name: 'google-drive', displayName: 'Google Drive', icon: '📁' },
        { name: 'dropbox', displayName: 'Dropbox', icon: '💧' },
        { name: 'box', displayName: 'Box', icon: '📦' },
        { name: 'onedrive', displayName: 'OneDrive', icon: '☁️' },
      ];

      expect(providers.length).toBe(4);

      for (const expected of expectedProviders) {
        const provider = providers.find(p => p.name === expected.name);
        expect(provider).toBeDefined();
        expect(provider!.displayName).toBe(expected.displayName);
        expect(provider!.icon).toBe(expected.icon);
      }

      // Verify all icons are distinct
      const icons = providers.map(p => p.icon);
      const uniqueIcons = new Set(icons);
      expect(uniqueIcons.size).toBe(4);
    });

    it('should maintain all four providers with distinct icons in Tauri environment', async () => {
      mockIsTauriEnvironment.mockReturnValue(true);

      const { CloudManager } = await import('../managers/CloudManager');
      const manager = new CloudManager();

      const providers = await manager.getAvailableProviders();

      const expectedProviders = [
        { name: 'google-drive', displayName: 'Google Drive', icon: '📁' },
        { name: 'dropbox', displayName: 'Dropbox', icon: '💧' },
        { name: 'box', displayName: 'Box', icon: '📦' },
        { name: 'onedrive', displayName: 'OneDrive', icon: '☁️' },
      ];

      expect(providers.length).toBe(4);

      for (const expected of expectedProviders) {
        const provider = providers.find(p => p.name === expected.name);
        expect(provider).toBeDefined();
        expect(provider!.displayName).toBe(expected.displayName);
        expect(provider!.icon).toBe(expected.icon);
      }
    });

    it('should preserve provider behavior: disconnect resets authentication state', async () => {
      mockIsTauriEnvironment.mockReturnValue(false);

      const { CloudManager } = await import('../managers/CloudManager');
      const manager = new CloudManager();

      const providers = await manager.getAvailableProviders();

      for (const providerName of ['google-drive', 'dropbox', 'box']) {
        const provider = providers.find(p => p.name === providerName)!;

        // Authenticate
        await provider.authenticate();
        expect(await provider.isAuthenticated()).toBe(true);

        // Disconnect
        await provider.disconnect();
        expect(await provider.isAuthenticated()).toBe(false);
      }
    });
  });

  describe('OneDrive failure during init does not affect other providers (Requirement 9.3)', () => {
    it('should register Google Drive, Dropbox, and Box when MSALOneDriveProvider throws during import', async () => {
      mockIsTauriEnvironment.mockReturnValue(false);

      // Override OneDrive mock to throw
      jest.doMock('../providers/MSALOneDriveProvider', () => {
        throw new Error('MSAL library failed to load');
      });

      const { CloudManager } = await import('../managers/CloudManager');
      const manager = new CloudManager();

      const providers = await manager.getAvailableProviders();

      // OneDrive should NOT be registered
      expect(providers.find(p => p.name === 'onedrive')).toBeUndefined();

      // All other providers should still be registered and functional
      const googleProvider = providers.find(p => p.name === 'google-drive');
      const dropboxProvider = providers.find(p => p.name === 'dropbox');
      const boxProvider = providers.find(p => p.name === 'box');

      expect(googleProvider).toBeDefined();
      expect(dropboxProvider).toBeDefined();
      expect(boxProvider).toBeDefined();
      expect(providers.length).toBe(3);
    });

    it('should register Google Drive, Dropbox, and Box when OAuthOneDriveProvider throws during import in Tauri', async () => {
      mockIsTauriEnvironment.mockReturnValue(true);

      // Override OneDrive mock to throw
      jest.doMock('../providers/OAuthOneDriveProvider', () => {
        throw new Error('OneDrive OAuth module failed to load');
      });

      const { CloudManager } = await import('../managers/CloudManager');
      const manager = new CloudManager();

      const providers = await manager.getAvailableProviders();

      // OneDrive should NOT be registered
      expect(providers.find(p => p.name === 'onedrive')).toBeUndefined();

      // All other providers should still be registered
      expect(providers.find(p => p.name === 'google-drive')).toBeDefined();
      expect(providers.find(p => p.name === 'dropbox')).toBeDefined();
      expect(providers.find(p => p.name === 'box')).toBeDefined();
      expect(providers.length).toBe(3);
    });

    it('should allow existing providers to authenticate after OneDrive fails to load', async () => {
      mockIsTauriEnvironment.mockReturnValue(false);

      jest.doMock('../providers/MSALOneDriveProvider', () => {
        throw new Error('MSAL initialization error');
      });

      const { CloudManager } = await import('../managers/CloudManager');
      const manager = new CloudManager();

      const providers = await manager.getAvailableProviders();

      // Verify all existing providers can still authenticate
      for (const provider of providers) {
        const authResult = await provider.authenticate();
        expect(authResult.success).toBe(true);
        expect(authResult.accessToken).toBeDefined();
      }
    });

    it('should allow existing providers to perform file operations after OneDrive fails to load', async () => {
      mockIsTauriEnvironment.mockReturnValue(false);

      jest.doMock('../providers/MSALOneDriveProvider', () => {
        throw new Error('MSAL initialization error');
      });

      const { CloudManager } = await import('../managers/CloudManager');
      const manager = new CloudManager();

      const providers = await manager.getAvailableProviders();

      // Verify all existing providers can perform CRUD operations
      for (const provider of providers) {
        await provider.authenticate();
        const folderId = await provider.createApplicationFolder();

        // Upload
        const uploaded = await provider.uploadFile(folderId, 'test.md', '# Test');
        expect(uploaded.id).toBeDefined();

        // List
        const files = await provider.listFiles(folderId);
        expect(files.length).toBeGreaterThan(0);

        // Download
        const content = await provider.downloadFile(uploaded.id);
        expect(content).toBe('# Test');

        // Update
        const updated = await provider.updateFile(uploaded.id, '# Updated');
        expect(updated.id).toBe(uploaded.id);

        // Delete
        await provider.deleteFile(uploaded.id);
      }
    });

    it('should log error when OneDrive fails but not throw', async () => {
      mockIsTauriEnvironment.mockReturnValue(false);

      jest.doMock('../providers/MSALOneDriveProvider', () => {
        throw new Error('Module not found: @azure/msal-browser');
      });

      const { CloudManager } = await import('../managers/CloudManager');
      const manager = new CloudManager();

      // Should not throw
      const providers = await manager.getAvailableProviders();
      expect(providers.length).toBe(3);

      // Error should have been logged
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('OneDrive'),
        expect.any(Error)
      );
    });
  });
});
