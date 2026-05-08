/**
 * Integration tests for OneDrive provider registration in CloudManager
 * Task 6.3: Verifies MSALOneDriveProvider is registered in web environment
 * and OAuthOneDriveProvider is registered in Tauri environment via getAvailableProviders()
 * 
 * Validates: Requirements 1.4, 1.7, 9.1, 9.2, 9.3
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

// Mock GISGoogleDriveProvider (web)
jest.mock('../providers/GISGoogleDriveProvider', () => ({
  GISGoogleDriveProvider: jest.fn().mockImplementation(() => ({
    name: 'google-drive',
    displayName: 'Google Drive',
    icon: '📁',
    authenticate: jest.fn(),
    isAuthenticated: jest.fn().mockResolvedValue(false),
    disconnect: jest.fn(),
    createApplicationFolder: jest.fn(),
    listFiles: jest.fn(),
    downloadFile: jest.fn(),
    uploadFile: jest.fn(),
    updateFile: jest.fn(),
    deleteFile: jest.fn(),
  })),
}));

// Mock DropboxProvider (web)
jest.mock('../providers/DropboxProvider', () => ({
  DropboxProvider: jest.fn().mockImplementation(() => ({
    name: 'dropbox',
    displayName: 'Dropbox',
    icon: '💧',
    authenticate: jest.fn(),
    isAuthenticated: jest.fn().mockResolvedValue(false),
    disconnect: jest.fn(),
    createApplicationFolder: jest.fn(),
    listFiles: jest.fn(),
    downloadFile: jest.fn(),
    uploadFile: jest.fn(),
    updateFile: jest.fn(),
    deleteFile: jest.fn(),
  })),
}));

// Mock BoxProvider (web)
jest.mock('../providers/BoxProvider', () => ({
  BoxProvider: jest.fn().mockImplementation(() => ({
    name: 'box',
    displayName: 'Box',
    icon: '📦',
    authenticate: jest.fn(),
    isAuthenticated: jest.fn().mockResolvedValue(false),
    disconnect: jest.fn(),
    createApplicationFolder: jest.fn(),
    listFiles: jest.fn(),
    downloadFile: jest.fn(),
    uploadFile: jest.fn(),
    updateFile: jest.fn(),
    deleteFile: jest.fn(),
  })),
}));

// Mock MSALOneDriveProvider (web)
jest.mock('../providers/MSALOneDriveProvider', () => ({
  MSALOneDriveProvider: jest.fn().mockImplementation(() => ({
    name: 'onedrive',
    displayName: 'OneDrive',
    icon: '☁️',
    authenticate: jest.fn(),
    isAuthenticated: jest.fn().mockResolvedValue(false),
    disconnect: jest.fn(),
    createApplicationFolder: jest.fn(),
    listFiles: jest.fn(),
    downloadFile: jest.fn(),
    uploadFile: jest.fn(),
    updateFile: jest.fn(),
    deleteFile: jest.fn(),
  })),
}));

// Mock OAuthGoogleDriveProvider (Tauri)
jest.mock('../providers/OAuthGoogleDriveProvider', () => ({
  OAuthGoogleDriveProvider: jest.fn().mockImplementation(() => ({
    name: 'google-drive',
    displayName: 'Google Drive',
    icon: '📁',
    authenticate: jest.fn(),
    isAuthenticated: jest.fn().mockResolvedValue(false),
    disconnect: jest.fn(),
    createApplicationFolder: jest.fn(),
    listFiles: jest.fn(),
    downloadFile: jest.fn(),
    uploadFile: jest.fn(),
    updateFile: jest.fn(),
    deleteFile: jest.fn(),
  })),
}));

// Mock OAuthDropboxProvider (Tauri)
jest.mock('../providers/OAuthDropboxProvider', () => ({
  OAuthDropboxProvider: jest.fn().mockImplementation(() => ({
    name: 'dropbox',
    displayName: 'Dropbox',
    icon: '💧',
    authenticate: jest.fn(),
    isAuthenticated: jest.fn().mockResolvedValue(false),
    disconnect: jest.fn(),
    createApplicationFolder: jest.fn(),
    listFiles: jest.fn(),
    downloadFile: jest.fn(),
    uploadFile: jest.fn(),
    updateFile: jest.fn(),
    deleteFile: jest.fn(),
  })),
}));

// Mock OAuthBoxProvider (Tauri)
jest.mock('../providers/OAuthBoxProvider', () => ({
  OAuthBoxProvider: jest.fn().mockImplementation(() => ({
    name: 'box',
    displayName: 'Box',
    icon: '📦',
    authenticate: jest.fn(),
    isAuthenticated: jest.fn().mockResolvedValue(false),
    disconnect: jest.fn(),
    createApplicationFolder: jest.fn(),
    listFiles: jest.fn(),
    downloadFile: jest.fn(),
    uploadFile: jest.fn(),
    updateFile: jest.fn(),
    deleteFile: jest.fn(),
  })),
}));

// Mock OAuthOneDriveProvider (Tauri)
jest.mock('../providers/OAuthOneDriveProvider', () => ({
  OAuthOneDriveProvider: jest.fn().mockImplementation(() => ({
    name: 'onedrive',
    displayName: 'OneDrive',
    icon: '☁️',
    authenticate: jest.fn(),
    isAuthenticated: jest.fn().mockResolvedValue(false),
    disconnect: jest.fn(),
    createApplicationFolder: jest.fn(),
    listFiles: jest.fn(),
    downloadFile: jest.fn(),
    uploadFile: jest.fn(),
    updateFile: jest.fn(),
    deleteFile: jest.fn(),
  })),
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

describe('OneDrive CloudManager Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  describe('Web Environment - OneDrive Registration (Requirement 1.7)', () => {
    it('should register MSALOneDriveProvider via getAvailableProviders() in web environment', async () => {
      mockIsTauriEnvironment.mockReturnValue(false);

      const { CloudManager } = await import('../managers/CloudManager');
      const manager = new CloudManager();

      const providers = await manager.getAvailableProviders();
      const onedriveProvider = providers.find((p) => p.name === 'onedrive');

      expect(onedriveProvider).toBeDefined();
      expect(onedriveProvider!.name).toBe('onedrive');
      expect(onedriveProvider!.displayName).toBe('OneDrive');
      expect(onedriveProvider!.icon).toBe('☁️');
    });

    it('should make OneDrive accessible by name "onedrive" via providers map', async () => {
      mockIsTauriEnvironment.mockReturnValue(false);

      const { CloudManager } = await import('../managers/CloudManager');
      const manager = new CloudManager();

      // getAvailableProviders ensures providers are ready
      const providers = await manager.getAvailableProviders();
      const onedriveProvider = providers.find((p) => p.name === 'onedrive');

      expect(onedriveProvider).toBeDefined();
      expect(onedriveProvider!.name).toBe('onedrive');
    });
  });

  describe('Tauri Environment - OneDrive Registration (Requirement 1.7)', () => {
    it('should register OAuthOneDriveProvider via getAvailableProviders() in Tauri environment', async () => {
      mockIsTauriEnvironment.mockReturnValue(true);

      const { CloudManager } = await import('../managers/CloudManager');
      const manager = new CloudManager();

      const providers = await manager.getAvailableProviders();
      const onedriveProvider = providers.find((p) => p.name === 'onedrive');

      expect(onedriveProvider).toBeDefined();
      expect(onedriveProvider!.name).toBe('onedrive');
      expect(onedriveProvider!.displayName).toBe('OneDrive');
      expect(onedriveProvider!.icon).toBe('☁️');
    });
  });

  describe('Other Providers Still Register Correctly (Requirements 9.1, 9.2)', () => {
    it('should register Google Drive, Dropbox, and Box alongside OneDrive in web environment', async () => {
      mockIsTauriEnvironment.mockReturnValue(false);

      const { CloudManager } = await import('../managers/CloudManager');
      const manager = new CloudManager();

      const providers = await manager.getAvailableProviders();

      const googleDrive = providers.find((p) => p.name === 'google-drive');
      const dropbox = providers.find((p) => p.name === 'dropbox');
      const box = providers.find((p) => p.name === 'box');
      const onedrive = providers.find((p) => p.name === 'onedrive');

      expect(googleDrive).toBeDefined();
      expect(googleDrive!.displayName).toBe('Google Drive');
      expect(dropbox).toBeDefined();
      expect(dropbox!.displayName).toBe('Dropbox');
      expect(box).toBeDefined();
      expect(box!.displayName).toBe('Box');
      expect(onedrive).toBeDefined();
      expect(onedrive!.displayName).toBe('OneDrive');

      // All four providers should be registered
      expect(providers.length).toBe(4);
    });

    it('should register Google Drive, Dropbox, and Box alongside OneDrive in Tauri environment', async () => {
      mockIsTauriEnvironment.mockReturnValue(true);

      const { CloudManager } = await import('../managers/CloudManager');
      const manager = new CloudManager();

      const providers = await manager.getAvailableProviders();

      const googleDrive = providers.find((p) => p.name === 'google-drive');
      const dropbox = providers.find((p) => p.name === 'dropbox');
      const box = providers.find((p) => p.name === 'box');
      const onedrive = providers.find((p) => p.name === 'onedrive');

      expect(googleDrive).toBeDefined();
      expect(googleDrive!.displayName).toBe('Google Drive');
      expect(dropbox).toBeDefined();
      expect(dropbox!.displayName).toBe('Dropbox');
      expect(box).toBeDefined();
      expect(box!.displayName).toBe('Box');
      expect(onedrive).toBeDefined();
      expect(onedrive!.displayName).toBe('OneDrive');

      // All four providers should be registered
      expect(providers.length).toBe(4);
    });
  });

  describe('Graceful Handling When OneDrive Import Fails (Requirements 1.4, 9.3)', () => {
    it('should still register other providers when MSALOneDriveProvider import fails in web environment', async () => {
      mockIsTauriEnvironment.mockReturnValue(false);

      // Override the MSALOneDriveProvider mock to throw on import
      jest.doMock('../providers/MSALOneDriveProvider', () => {
        throw new Error('Failed to load MSALOneDriveProvider module');
      });

      const { CloudManager } = await import('../managers/CloudManager');
      const manager = new CloudManager();

      const providers = await manager.getAvailableProviders();

      // OneDrive should NOT be registered
      const onedrive = providers.find((p) => p.name === 'onedrive');
      expect(onedrive).toBeUndefined();

      // Other providers should still be registered
      const googleDrive = providers.find((p) => p.name === 'google-drive');
      const dropbox = providers.find((p) => p.name === 'dropbox');
      const box = providers.find((p) => p.name === 'box');

      expect(googleDrive).toBeDefined();
      expect(dropbox).toBeDefined();
      expect(box).toBeDefined();
      expect(providers.length).toBe(3);
    });

    it('should still register other providers when OAuthOneDriveProvider import fails in Tauri environment', async () => {
      mockIsTauriEnvironment.mockReturnValue(true);

      // Override the OAuthOneDriveProvider mock to throw on import
      jest.doMock('../providers/OAuthOneDriveProvider', () => {
        throw new Error('Failed to load OAuthOneDriveProvider module');
      });

      const { CloudManager } = await import('../managers/CloudManager');
      const manager = new CloudManager();

      const providers = await manager.getAvailableProviders();

      // OneDrive should NOT be registered
      const onedrive = providers.find((p) => p.name === 'onedrive');
      expect(onedrive).toBeUndefined();

      // Other providers should still be registered
      const googleDrive = providers.find((p) => p.name === 'google-drive');
      const dropbox = providers.find((p) => p.name === 'dropbox');
      const box = providers.find((p) => p.name === 'box');

      expect(googleDrive).toBeDefined();
      expect(dropbox).toBeDefined();
      expect(box).toBeDefined();
      expect(providers.length).toBe(3);
    });

    it('should log error when OneDrive provider fails to load', async () => {
      mockIsTauriEnvironment.mockReturnValue(false);

      jest.doMock('../providers/MSALOneDriveProvider', () => {
        throw new Error('Module not found');
      });

      const { CloudManager } = await import('../managers/CloudManager');
      const manager = new CloudManager();

      await manager.getAvailableProviders();

      expect(console.error).toHaveBeenCalledWith(
        '[CloudManager] Failed to load OneDrive MSAL provider:',
        expect.any(Error)
      );
    });
  });
});
