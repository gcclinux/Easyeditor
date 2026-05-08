/**
 * Unit tests for OneDrive credential configuration module
 * Tests isOneDriveConfigured(), getConfigurationStatus(), getEnvVar helper,
 * and ONEDRIVE_CONFIG structure.
 *
 * Requirements: 3.1, 3.2, 3.4, 3.5, 3.7, 3.8
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';

// Store original process.env
const originalEnv = { ...process.env };

describe('onedrive-credentials', () => {
  beforeEach(() => {
    // Reset modules before each test to get fresh config evaluation
    jest.resetModules();
  });

  afterEach(() => {
    // Restore original environment
    process.env = { ...originalEnv };
  });

  describe('ONEDRIVE_CONFIG structure (Requirement 3.8)', () => {
    test('exports ONEDRIVE_CONFIG with required fields', async () => {
      const { ONEDRIVE_CONFIG } = await import('../onedrive-credentials');

      expect(ONEDRIVE_CONFIG).toBeDefined();
      expect(ONEDRIVE_CONFIG).toHaveProperty('CLIENT_ID');
      expect(ONEDRIVE_CONFIG).toHaveProperty('CLIENT_SECRET');
      expect(ONEDRIVE_CONFIG).toHaveProperty('SCOPES');
      expect(ONEDRIVE_CONFIG).toHaveProperty('AUTHORIZED_DOMAINS');
      expect(ONEDRIVE_CONFIG).toHaveProperty('REDIRECT_URI');
    });

    test('SCOPES contains Files.ReadWrite.AppFolder and offline_access', async () => {
      const { ONEDRIVE_CONFIG } = await import('../onedrive-credentials');

      expect(Array.isArray(ONEDRIVE_CONFIG.SCOPES)).toBe(true);
      expect(ONEDRIVE_CONFIG.SCOPES).toContain('Files.ReadWrite.AppFolder');
      expect(ONEDRIVE_CONFIG.SCOPES).toContain('offline_access');
    });

    test('AUTHORIZED_DOMAINS is a non-empty array of strings', async () => {
      const { ONEDRIVE_CONFIG } = await import('../onedrive-credentials');

      expect(Array.isArray(ONEDRIVE_CONFIG.AUTHORIZED_DOMAINS)).toBe(true);
      expect(ONEDRIVE_CONFIG.AUTHORIZED_DOMAINS.length).toBeGreaterThan(0);
      ONEDRIVE_CONFIG.AUTHORIZED_DOMAINS.forEach((domain: string) => {
        expect(typeof domain).toBe('string');
        expect(domain.length).toBeGreaterThan(0);
      });
    });

    test('REDIRECT_URI is a non-empty string', async () => {
      const { ONEDRIVE_CONFIG } = await import('../onedrive-credentials');

      expect(typeof ONEDRIVE_CONFIG.REDIRECT_URI).toBe('string');
      expect(ONEDRIVE_CONFIG.REDIRECT_URI.length).toBeGreaterThan(0);
    });

    test('CLIENT_ID and CLIENT_SECRET are strings', async () => {
      const { ONEDRIVE_CONFIG } = await import('../onedrive-credentials');

      expect(typeof ONEDRIVE_CONFIG.CLIENT_ID).toBe('string');
      expect(typeof ONEDRIVE_CONFIG.CLIENT_SECRET).toBe('string');
    });
  });

  describe('isOneDriveConfigured() (Requirement 3.4)', () => {
    test('returns false with default placeholder credentials', async () => {
      // Without env vars set, defaults contain "your-" placeholder
      const { isOneDriveConfigured } = await import('../onedrive-credentials');

      expect(isOneDriveConfigured()).toBe(false);
    });

    test('returns true with valid credentials from environment', async () => {
      // Set valid credentials (non-placeholder, length > 10)
      process.env.VITE_ONEDRIVE_CLIENT_ID = 'a1b2c3d4e5f6g7h8i9j0k1l2';
      process.env.VITE_ONEDRIVE_CLIENT_SECRET = 'secret-value-that-is-long-enough';

      const { isOneDriveConfigured } = await import('../onedrive-credentials');

      expect(isOneDriveConfigured()).toBe(true);
    });

    test('returns false when client ID contains "your-"', async () => {
      process.env.VITE_ONEDRIVE_CLIENT_ID = 'your-development-client-id';
      process.env.VITE_ONEDRIVE_CLIENT_SECRET = 'secret-value-that-is-long-enough';

      const { isOneDriveConfigured } = await import('../onedrive-credentials');

      expect(isOneDriveConfigured()).toBe(false);
    });

    test('returns false when client secret contains "your-"', async () => {
      process.env.VITE_ONEDRIVE_CLIENT_ID = 'a1b2c3d4e5f6g7h8i9j0k1l2';
      process.env.VITE_ONEDRIVE_CLIENT_SECRET = 'your-development-client-secret';

      const { isOneDriveConfigured } = await import('../onedrive-credentials');

      expect(isOneDriveConfigured()).toBe(false);
    });

    test('returns false when client ID is empty string', async () => {
      process.env.VITE_ONEDRIVE_CLIENT_ID = '';
      process.env.VITE_ONEDRIVE_CLIENT_SECRET = 'secret-value-that-is-long-enough';

      const { isOneDriveConfigured } = await import('../onedrive-credentials');

      expect(isOneDriveConfigured()).toBe(false);
    });

    test('returns false when client secret is empty string', async () => {
      process.env.VITE_ONEDRIVE_CLIENT_ID = 'a1b2c3d4e5f6g7h8i9j0k1l2';
      process.env.VITE_ONEDRIVE_CLIENT_SECRET = '';

      const { isOneDriveConfigured } = await import('../onedrive-credentials');

      expect(isOneDriveConfigured()).toBe(false);
    });

    test('returns false when client ID is too short (length <= 10)', async () => {
      process.env.VITE_ONEDRIVE_CLIENT_ID = 'short';
      process.env.VITE_ONEDRIVE_CLIENT_SECRET = 'secret-value-that-is-long-enough';

      const { isOneDriveConfigured } = await import('../onedrive-credentials');

      expect(isOneDriveConfigured()).toBe(false);
    });

    test('returns false when client secret is too short (length <= 10)', async () => {
      process.env.VITE_ONEDRIVE_CLIENT_ID = 'a1b2c3d4e5f6g7h8i9j0k1l2';
      process.env.VITE_ONEDRIVE_CLIENT_SECRET = 'short';

      const { isOneDriveConfigured } = await import('../onedrive-credentials');

      expect(isOneDriveConfigured()).toBe(false);
    });

    test('returns false when client ID is exactly 10 characters', async () => {
      process.env.VITE_ONEDRIVE_CLIENT_ID = '1234567890'; // exactly 10 chars
      process.env.VITE_ONEDRIVE_CLIENT_SECRET = 'secret-value-that-is-long-enough';

      const { isOneDriveConfigured } = await import('../onedrive-credentials');

      expect(isOneDriveConfigured()).toBe(false);
    });

    test('returns true when client ID is 11 characters (just above threshold)', async () => {
      process.env.VITE_ONEDRIVE_CLIENT_ID = '12345678901'; // 11 chars
      process.env.VITE_ONEDRIVE_CLIENT_SECRET = 'secret-value-that-is-long-enough';

      const { isOneDriveConfigured } = await import('../onedrive-credentials');

      expect(isOneDriveConfigured()).toBe(true);
    });
  });

  describe('getConfigurationStatus() (Requirement 3.5)', () => {
    test('returns object with all required fields', async () => {
      const { getConfigurationStatus } = await import('../onedrive-credentials');
      const status = getConfigurationStatus();

      expect(status).toHaveProperty('configured');
      expect(status).toHaveProperty('environment');
      expect(status).toHaveProperty('clientIdConfigured');
      expect(status).toHaveProperty('clientSecretConfigured');
      expect(status).toHaveProperty('issues');
    });

    test('configured is a boolean', async () => {
      const { getConfigurationStatus } = await import('../onedrive-credentials');
      const status = getConfigurationStatus();

      expect(typeof status.configured).toBe('boolean');
    });

    test('environment is a string', async () => {
      const { getConfigurationStatus } = await import('../onedrive-credentials');
      const status = getConfigurationStatus();

      expect(typeof status.environment).toBe('string');
      expect(status.environment.length).toBeGreaterThan(0);
    });

    test('clientIdConfigured and clientSecretConfigured are booleans', async () => {
      const { getConfigurationStatus } = await import('../onedrive-credentials');
      const status = getConfigurationStatus();

      expect(typeof status.clientIdConfigured).toBe('boolean');
      expect(typeof status.clientSecretConfigured).toBe('boolean');
    });

    test('issues is an array of strings', async () => {
      const { getConfigurationStatus } = await import('../onedrive-credentials');
      const status = getConfigurationStatus();

      expect(Array.isArray(status.issues)).toBe(true);
      status.issues.forEach((issue: string) => {
        expect(typeof issue).toBe('string');
      });
    });

    test('reports unconfigured when using placeholder credentials', async () => {
      const { getConfigurationStatus } = await import('../onedrive-credentials');
      const status = getConfigurationStatus();

      expect(status.configured).toBe(false);
      expect(status.clientIdConfigured).toBe(false);
      expect(status.clientSecretConfigured).toBe(false);
      expect(status.issues.length).toBeGreaterThan(0);
    });

    test('reports configured when valid credentials are set', async () => {
      process.env.VITE_ONEDRIVE_CLIENT_ID = 'valid-client-id-long-enough';
      process.env.VITE_ONEDRIVE_CLIENT_SECRET = 'valid-client-secret-long-enough';

      const { getConfigurationStatus } = await import('../onedrive-credentials');
      const status = getConfigurationStatus();

      expect(status.configured).toBe(true);
      expect(status.clientIdConfigured).toBe(true);
      expect(status.clientSecretConfigured).toBe(true);
    });

    test('reports only client ID issue when only secret is valid', async () => {
      process.env.VITE_ONEDRIVE_CLIENT_ID = 'your-development-client-id';
      process.env.VITE_ONEDRIVE_CLIENT_SECRET = 'valid-client-secret-long-enough';

      const { getConfigurationStatus } = await import('../onedrive-credentials');
      const status = getConfigurationStatus();

      expect(status.configured).toBe(false);
      expect(status.clientIdConfigured).toBe(false);
      expect(status.clientSecretConfigured).toBe(true);
      expect(status.issues).toContain('OAuth Client ID not configured');
    });

    test('reports only client secret issue when only ID is valid', async () => {
      process.env.VITE_ONEDRIVE_CLIENT_ID = 'valid-client-id-long-enough';
      process.env.VITE_ONEDRIVE_CLIENT_SECRET = 'your-development-client-secret';

      const { getConfigurationStatus } = await import('../onedrive-credentials');
      const status = getConfigurationStatus();

      expect(status.configured).toBe(false);
      expect(status.clientIdConfigured).toBe(true);
      expect(status.clientSecretConfigured).toBe(false);
      expect(status.issues).toContain('OAuth Client Secret not configured');
    });

    test('defaults to development environment in test', async () => {
      const { getConfigurationStatus } = await import('../onedrive-credentials');
      const status = getConfigurationStatus();

      expect(status.environment).toBe('development');
    });
  });

  describe('getEnvVar helper (Requirement 3.7)', () => {
    test('reads environment variables from process.env in Jest/Node environment', async () => {
      process.env.VITE_ONEDRIVE_CLIENT_ID = 'test-env-var-value-12345';

      const { ONEDRIVE_CONFIG } = await import('../onedrive-credentials');

      // The config should have picked up the env var value
      expect(ONEDRIVE_CONFIG.CLIENT_ID).toBe('test-env-var-value-12345');
    });

    test('falls back to default when env var is not set', async () => {
      delete process.env.VITE_ONEDRIVE_CLIENT_ID;
      delete process.env.VITE_ONEDRIVE_CLIENT_SECRET;

      const { ONEDRIVE_CONFIG } = await import('../onedrive-credentials');

      // Should fall back to placeholder defaults
      expect(ONEDRIVE_CONFIG.CLIENT_ID).toBe('your-development-client-id');
      expect(ONEDRIVE_CONFIG.CLIENT_SECRET).toBe('your-development-client-secret');
    });

    test('reads VITE_ONEDRIVE_CLIENT_SECRET from process.env', async () => {
      process.env.VITE_ONEDRIVE_CLIENT_SECRET = 'my-secret-value-for-testing';

      const { ONEDRIVE_CONFIG } = await import('../onedrive-credentials');

      expect(ONEDRIVE_CONFIG.CLIENT_SECRET).toBe('my-secret-value-for-testing');
    });
  });

  describe('Environment configuration (Requirements 3.1, 3.2)', () => {
    test('uses VITE_ONEDRIVE_CLIENT_ID env var for client ID (Requirement 3.1)', async () => {
      process.env.VITE_ONEDRIVE_CLIENT_ID = 'env-specific-client-id-value';

      const { ONEDRIVE_CONFIG } = await import('../onedrive-credentials');

      expect(ONEDRIVE_CONFIG.CLIENT_ID).toBe('env-specific-client-id-value');
    });

    test('uses VITE_ONEDRIVE_CLIENT_SECRET env var for client secret (Requirement 3.2)', async () => {
      process.env.VITE_ONEDRIVE_CLIENT_SECRET = 'env-specific-secret-value';

      const { ONEDRIVE_CONFIG } = await import('../onedrive-credentials');

      expect(ONEDRIVE_CONFIG.CLIENT_SECRET).toBe('env-specific-secret-value');
    });
  });
});
