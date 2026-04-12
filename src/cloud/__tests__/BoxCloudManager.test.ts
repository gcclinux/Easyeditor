/**
 * Integration tests for Box provider registration in CloudManager
 * Task 6.3: Verifies BoxProvider is registered in web environment
 * and OAuthBoxProvider is registered in Tauri environment via getAvailableProviders()
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

// Mock GISGoogleDriveProvider
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

// Mock DropboxProvider
jest.mock('../providers/DropboxProvider', () => ({
  DropboxProvider: jest.fn().mockImplementation(() => ({
    name: 'dropbox',
    displayName: 'Dropbox',
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

// Mock BoxProvider
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

// Mock OAuthGoogleDriveProvider
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

// Mock OAuthDropboxProvider
jest.mock('../providers/OAuthDropboxProvider', () => ({
  OAuthDropboxProvider: jest.fn().mockImplementation(() => ({
    name: 'dropbox',
    displayName: 'Dropbox',
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

// Mock OAuthBoxProvider
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

// Suppress console noise
beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  jest.restoreAllMocks();
});

describe('BoxCloudManager Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset module registry so CloudManager re-initializes fresh
    jest.resetModules();
  });

  describe('Web Environment', () => {
    it('should register BoxProvider via getAvailableProviders() in web environment', async () => {
      mockIsTauriEnvironment.mockReturnValue(false);

      // Re-import CloudManager after mocks are set
      const { CloudManager } = await import('../managers/CloudManager');
      const manager = new CloudManager();

      const providers = await manager.getAvailableProviders();
      const boxProvider = providers.find((p) => p.name === 'box');

      expect(boxProvider).toBeDefined();
      expect(boxProvider!.name).toBe('box');
      expect(boxProvider!.displayName).toBe('Box');
    });
  });

  describe('Tauri Environment', () => {
    it('should register OAuthBoxProvider via getAvailableProviders() in Tauri environment', async () => {
      mockIsTauriEnvironment.mockReturnValue(true);

      // Re-import CloudManager after mocks are set
      const { CloudManager } = await import('../managers/CloudManager');
      const manager = new CloudManager();

      const providers = await manager.getAvailableProviders();
      const boxProvider = providers.find((p) => p.name === 'box');

      expect(boxProvider).toBeDefined();
      expect(boxProvider!.name).toBe('box');
      expect(boxProvider!.displayName).toBe('Box');
    });
  });
});
