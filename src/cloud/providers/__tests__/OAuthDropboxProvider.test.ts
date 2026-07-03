/**
 * Tests for OAuthDropboxProvider
 * Validates OAuth-based Dropbox integration for Tauri environment
 */

import { OAuthDropboxProvider } from '../OAuthDropboxProvider';
import type { CloudProvider } from '../../interfaces/CloudProvider';

// Mock LicenseManager
jest.mock('../../../premium/LicenseManager', () => ({
  __esModule: true,
  default: {
    hasActiveLicense: jest.fn(() => true)
  }
}));

// Mock the OAuth manager and related modules
jest.mock('../../../services/oauth/core/OAuthManager');
jest.mock('../../../services/oauth/tauri/TauriOAuthManager', () => ({
  createOAuthManager: jest.fn(() => ({
    registerProvider: jest.fn(),
    authenticate: jest.fn(),
    isAuthenticated: jest.fn(),
    logout: jest.fn(),
    getValidTokens: jest.fn()
  }))
}));
jest.mock('../../../services/oauth/providers/DropboxOAuthProvider', () => ({
  DropboxOAuthProvider: jest.fn().mockImplementation(() => ({
    name: 'dropbox',
    displayName: 'Dropbox'
  }))
}));
jest.mock('../../config/dropbox-credentials', () => ({
  DROPBOX_CONFIG: {
    CLIENT_ID: 'test-client-id',
    CLIENT_SECRET: 'test-client-secret',
    SCOPES: ['files.content.write', 'files.content.read'],
    REDIRECT_URI: 'http://localhost:3000/oauth/callback'
  },
  isDropboxConfigured: jest.fn(() => true),
  getConfigurationErrorMessage: jest.fn(() => '')
}));

describe('OAuthDropboxProvider', () => {
  let provider: OAuthDropboxProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new OAuthDropboxProvider();
  });

  describe('CloudProvider interface', () => {
    it('should implement CloudProvider interface', () => {
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
      expect(provider.name).toBe('dropbox');
      expect(provider.displayName).toBe('Dropbox');
      expect(provider.icon).toBe('📦');
    });
  });

  describe('constructor', () => {
    it('should initialize OAuth manager and Dropbox provider', () => {
      expect(provider).toBeDefined();
      expect(provider.name).toBe('dropbox');
    });

    it('should warn when configuration is missing', () => {
      const { isDropboxConfigured, getConfigurationErrorMessage } = require('../../config/dropbox-credentials');
      isDropboxConfigured.mockReturnValueOnce(false);
      getConfigurationErrorMessage.mockReturnValueOnce('Configuration error');

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      new OAuthDropboxProvider();
      
      expect(consoleSpy).toHaveBeenCalledWith(
        '[OAuthDropboxProvider] Configuration warning:',
        'Configuration error'
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('authenticate', () => {
    it('should return error when not configured', async () => {
      const { isDropboxConfigured, getConfigurationErrorMessage } = require('../../config/dropbox-credentials');
      
      isDropboxConfigured.mockReturnValueOnce(false);
      getConfigurationErrorMessage.mockReturnValueOnce('Configuration error');

      const result = await provider.authenticate();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Configuration error');
    });
  });

  describe('isAuthenticated', () => {
    it('should return boolean value', async () => {
      const result = await provider.isAuthenticated();
      
      // Should return a boolean value (false when not authenticated)
      expect(typeof result).toBe('boolean');
    });
  });

  describe('disconnect', () => {
    it('should disconnect successfully', async () => {
      // Should not throw with mocked OAuth manager
      await expect(provider.disconnect()).resolves.not.toThrow();
    });
  });
});
