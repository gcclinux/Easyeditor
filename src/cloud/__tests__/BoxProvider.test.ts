/**
 * Unit tests for BoxProvider (Web)
 * Task 6.1: Example-based unit tests covering authentication flow,
 * provider metadata, and disconnect resilience.
 *
 * Validates: Requirements 1.4, 1.5, 1.6, 4.4, 7.3, 8.4
 */

import { BoxProvider } from '../providers/BoxProvider';

// Mock CloudCredentialManager
jest.mock('../managers/CloudCredentialManager', () => ({
  CloudCredentialManager: jest.fn().mockImplementation(() => ({
    saveCredentials: jest.fn().mockResolvedValue(undefined),
    getCredentials: jest.fn().mockResolvedValue(null),
    removeCredentials: jest.fn().mockResolvedValue(undefined),
    updateCredentials: jest.fn().mockResolvedValue(undefined),
  })),
  cloudCredentialManager: {
    saveCredentials: jest.fn().mockResolvedValue(undefined),
    getCredentials: jest.fn().mockResolvedValue(null),
    removeCredentials: jest.fn().mockResolvedValue(undefined),
    updateCredentials: jest.fn().mockResolvedValue(undefined),
  }
}));



// Mock box-credentials
jest.mock('../config/box-credentials', () => ({
  BOX_CONFIG: {
    CLIENT_ID: 'test-client-id-valid-long-enough',
    CLIENT_SECRET: 'test-client-secret-valid-long-enough',
    REDIRECT_URI: 'http://localhost:3024/box-oauth-callback.html',
    SCOPES: ['root_readwrite'],
    AUTHORIZED_DOMAINS: ['http://localhost:3024'],
  },
  isBoxConfigured: jest.fn().mockReturnValue(true),
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

describe('BoxProvider Unit Tests', () => {
  let provider: BoxProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new BoxProvider();
  });

  describe('Provider Metadata', () => {
    it('should have name "box"', () => {
      expect(provider.name).toBe('box');
    });

    it('should have displayName "Box"', () => {
      expect(provider.displayName).toBe('Box');
    });

    it('should have icon "📦"', () => {
      expect(provider.icon).toBe('📦');
    });
  });

  describe('Authentication - Popup Blocked', () => {
    it('should return error when popup is blocked (window.open returns null)', async () => {


      const { isBoxConfigured } = require('../config/box-credentials');
      isBoxConfigured.mockReturnValue(true);

      // Mock window.open to return null (popup blocked)
      const originalOpen = window.open;
      window.open = jest.fn().mockReturnValue(null);

      // Mock crypto for PKCE (including TextEncoder for the hash)
      const { TextEncoder: NodeTextEncoder } = require('util');
      global.TextEncoder = NodeTextEncoder;

      Object.defineProperty(global, 'crypto', {
        value: {
          subtle: {
            digest: jest.fn().mockResolvedValue(new ArrayBuffer(32)),
          },
          getRandomValues: jest.fn((arr: Uint8Array) => {
            for (let i = 0; i < arr.length; i++) arr[i] = i % 256;
            return arr;
          }),
        },
        configurable: true,
      });

      // Mock sessionStorage
      const sessionStorageMock: Record<string, string> = {};
      Object.defineProperty(window, 'sessionStorage', {
        value: {
          getItem: (key: string) => sessionStorageMock[key] || null,
          setItem: (key: string, value: string) => { sessionStorageMock[key] = value; },
          removeItem: (key: string) => { delete sessionStorageMock[key]; },
        },
        configurable: true,
      });

      const result = await provider.authenticate();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.toLowerCase()).toContain('popup');

      window.open = originalOpen;
    });
  });



  describe('Authentication - Missing Config', () => {
    it('should return error when Box is not configured', async () => {


      const { isBoxConfigured, getConfigurationErrorMessage } = require('../config/box-credentials');
      isBoxConfigured.mockReturnValue(false);
      getConfigurationErrorMessage.mockReturnValue(
        'Box integration requires configuration. Please follow BOX_SETUP.md.'
      );

      const result = await provider.authenticate();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Box integration requires configuration');
    });
  });

  describe('Disconnect Resilience', () => {
    it('should clear credentials even when token revocation fails', async () => {
      const { cloudCredentialManager } = require('../managers/CloudCredentialManager');

      // Setup: provider has stored credentials
      cloudCredentialManager.getCredentials.mockResolvedValue({
        provider: 'box',
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresAt: new Date(Date.now() + 3600000),
        scope: 'root_readwrite',
        userId: '',
      });

      // Mock fetch to simulate revocation failure (network error)
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      // disconnect should NOT throw - revocation failure is non-fatal
      await provider.disconnect();

      // Credentials should still be cleared
      expect(cloudCredentialManager.removeCredentials).toHaveBeenCalledWith('box');
    });

    it('should clear credentials when revocation returns HTTP error', async () => {
      const { cloudCredentialManager } = require('../managers/CloudCredentialManager');

      cloudCredentialManager.getCredentials.mockResolvedValue({
        provider: 'box',
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresAt: new Date(Date.now() + 3600000),
        scope: 'root_readwrite',
        userId: '',
      });

      // Mock fetch to simulate HTTP error on revocation
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 503,
      });

      // disconnect may throw but credentials must still be cleared
      try {
        await provider.disconnect();
      } catch {
        // Expected - revocation failure propagates
      }

      // Credentials should still be cleared regardless
      expect(cloudCredentialManager.removeCredentials).toHaveBeenCalledWith('box');
    });

    it('should clear credentials when no credentials exist', async () => {
      const { cloudCredentialManager } = require('../managers/CloudCredentialManager');

      cloudCredentialManager.getCredentials.mockResolvedValue(null);

      // Should not throw
      await provider.disconnect();

      expect(cloudCredentialManager.removeCredentials).toHaveBeenCalledWith('box');
    });
  });
});
