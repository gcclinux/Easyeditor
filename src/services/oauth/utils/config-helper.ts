/**
 * OAuth Configuration Helper
 * Provides utility functions for OAuth configuration management
 */

import type { OAuthConfig, OAuthProviderConfig } from '../interfaces';

/**
 * Create a default OAuth configuration
 */
export function createDefaultOAuthConfig(): OAuthConfig {
  return {
    providers: {},
    callbackServer: {
      host: '127.0.0.1',
      portRange: [8080, 8082],
      timeout: 300000, // 5 minutes
      maxRetries: 3,
      useHttps: false
    },
    security: {
      stateExpiration: 600000, // 10 minutes
      pkceMethod: 'S256',
      tokenEncryption: true,
      tokenRefreshBuffer: 300000, // 5 minutes
      maxAuthAttempts: 3,
      lockoutDuration: 900000 // 15 minutes
    }
  };
}

/**
 * Create Google OAuth provider configuration
 */
export function createGoogleProviderConfig(clientId: string, clientSecret?: string): OAuthProviderConfig {
  return {
    clientId,
    clientSecret,
    scope: ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive.readonly'],
    authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    enabled: true,
    additionalParams: {
      access_type: 'offline',
      prompt: 'consent'
    }
  };
}

/**
 * Create Dropbox OAuth provider configuration (future)
 */
export function createDropboxProviderConfig(clientId: string, clientSecret?: string): OAuthProviderConfig {
  return {
    clientId,
    clientSecret,
    scope: ['files.content.write', 'files.content.read'],
    authorizationUrl: 'https://www.dropbox.com/oauth2/authorize',
    tokenUrl: 'https://api.dropboxapi.com/oauth2/token',
    enabled: true
  };
}

/**
 * Create OneDrive OAuth provider configuration (future)
 */
export function createOneDriveProviderConfig(clientId: string, clientSecret?: string): OAuthProviderConfig {
  return {
    clientId,
    clientSecret,
    scope: ['Files.ReadWrite'],
    authorizationUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    enabled: true
  };
}

/**
 * Validate OAuth configuration
 */
export function validateOAuthConfig(config: OAuthConfig): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate providers
  for (const [providerName, providerConfig] of Object.entries(config.providers)) {
    if (!providerConfig.clientId) {
      errors.push(`Provider '${providerName}' missing clientId`);
    }
    if (!providerConfig.scope || providerConfig.scope.length === 0) {
      errors.push(`Provider '${providerName}' missing scope`);
    }
  }

  // Validate callback server
  if (config.callbackServer.portRange[0] >= config.callbackServer.portRange[1]) {
    errors.push('Callback server portRange start must be less than end');
  }
  if (config.callbackServer.maxRetries < 1) {
    errors.push('Callback server maxRetries must be at least 1');
  }

  // Validate security config
  if (config.security.maxAuthAttempts < 1) {
    errors.push('Security maxAuthAttempts must be at least 1');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Merge OAuth configurations
 */
export function mergeOAuthConfigs(base: OAuthConfig, override: Partial<OAuthConfig>): OAuthConfig {
  return {
    providers: {
      ...base.providers,
      ...override.providers
    },
    callbackServer: {
      ...base.callbackServer,
      ...override.callbackServer
    },
    security: {
      ...base.security,
      ...override.security
    },
    environment: override.environment || base.environment
  };
}
