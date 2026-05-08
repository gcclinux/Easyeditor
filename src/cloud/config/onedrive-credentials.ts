/**
 * OneDrive API Configuration for EasyEditor
 * 
 * This configuration supports multiple deployment environments and provides
 * comprehensive credential management for OneDrive integration.
 */

/**
 * Safe environment variable access that works in both Vite and Jest environments
 */
function getEnvVar(key: string): string | undefined {
  // In Vite environment (browser) - import.meta.env is available at build time
  if (typeof window !== 'undefined' && typeof import.meta !== 'undefined' && import.meta.env) {
    const value = import.meta.env[key];
    return value;
  }

  // In Node.js/Jest environment
  if (typeof process !== 'undefined' && process.env) {
    const value = process.env[key];
    return value;
  }

  return undefined;
}

/**
 * Get current build mode safely
 */
function getBuildMode(): string {
  // In Vite environment (browser)
  if (typeof window !== 'undefined' && typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env.MODE || 'development';
  }

  // In Node.js/Jest environment
  if (typeof process !== 'undefined' && process.env) {
    return process.env.NODE_ENV || 'development';
  }

  return 'development';
}

/**
 * Get the appropriate OneDrive Client ID based on environment
 */
function getOneDriveClientId(): string {
  return getEnvVar('VITE_ONEDRIVE_CLIENT_ID') || 'your-development-client-id';
}

/**
 * Get the appropriate OneDrive Client Secret based on environment
 */
function getOneDriveClientSecret(): string {
  return getEnvVar('VITE_ONEDRIVE_CLIENT_SECRET') || 'your-development-client-secret';
}

interface OneDriveEnvironmentConfig {
  CLIENT_ID: string;
  CLIENT_SECRET: string;
  AUTHORIZED_DOMAINS: string[];
  REDIRECT_URI: string;
}

interface OneDriveConfig {
  CLIENT_ID: string;
  CLIENT_SECRET: string;
  SCOPES: string[];
  AUTHORIZED_DOMAINS: string[];
  REDIRECT_URI: string;
}

/**
 * Environment-specific configurations
 */
const ENVIRONMENT_CONFIGS: Record<string, OneDriveEnvironmentConfig> = {
  development: {
    CLIENT_ID: getOneDriveClientId(),
    CLIENT_SECRET: getOneDriveClientSecret(),
    AUTHORIZED_DOMAINS: [
      'http://localhost:3024',
      'https://localhost:3024',
      'http://127.0.0.1:3024',
      'https://127.0.0.1:3024',
      'http://tauri.localhost',
      'https://tauri.localhost',
      'tauri://localhost'
    ],
    REDIRECT_URI: (() => {
      const uri = typeof window !== 'undefined' ? `${window.location.origin}/onedrive-oauth-callback.html` : 'http://localhost:3024/onedrive-oauth-callback.html';
      console.log('[OneDrive Config] Computed REDIRECT_URI:', uri, '| window.location.origin:', typeof window !== 'undefined' ? window.location.origin : 'N/A');
      return uri;
    })()
  },

  production: {
    CLIENT_ID: getEnvVar('VITE_ONEDRIVE_CLIENT_ID_PROD') ||
      'your-production-client-id',
    CLIENT_SECRET: getEnvVar('VITE_ONEDRIVE_CLIENT_SECRET_PROD') ||
      'your-production-client-secret',
    AUTHORIZED_DOMAINS: [
      'https://easyeditor.co.uk',
      'https://www.easyeditor.co.uk'
    ],
    REDIRECT_URI: 'https://easyeditor.co.uk/onedrive-oauth-callback.html'
  }
};

/**
 * Detect current environment
 */
function getCurrentEnvironment(): string {
  // Check explicit environment variable first
  const explicitEnv = getEnvVar('VITE_ENVIRONMENT');
  if (explicitEnv && ENVIRONMENT_CONFIGS[explicitEnv]) {
    return explicitEnv;
  }

  // Check if running in Tauri (always use development config for Tauri)
  if (typeof window !== 'undefined' && window.location.origin.includes('tauri.localhost')) {
    return 'development';
  }

  // Auto-detect based on build mode
  if (getBuildMode() === 'production') {
    return 'production';
  }

  return 'development';
}

/**
 * Get configuration for current environment
 */
function getEnvironmentConfig(): OneDriveEnvironmentConfig {
  const environment = getCurrentEnvironment();
  const config = ENVIRONMENT_CONFIGS[environment];

  if (!config) {
    console.warn(`Unknown environment: ${environment}, falling back to development`);
    return ENVIRONMENT_CONFIGS.development;
  }

  return config;
}

/**
 * Main OneDrive configuration object
 */
export const ONEDRIVE_CONFIG: OneDriveConfig = (() => {
  const envConfig = getEnvironmentConfig();

  return {
    CLIENT_ID: envConfig.CLIENT_ID,
    CLIENT_SECRET: envConfig.CLIENT_SECRET,
    AUTHORIZED_DOMAINS: envConfig.AUTHORIZED_DOMAINS,
    REDIRECT_URI: envConfig.REDIRECT_URI,

    // OAuth scopes required by EasyEditor for OneDrive
    SCOPES: [
      'Files.ReadWrite.AppFolder',
      'offline_access'
    ]
  };
})();

/**
 * Check if OneDrive credentials are properly configured.
 * For public clients (Tauri/desktop), only CLIENT_ID is required.
 * CLIENT_SECRET is only needed for confidential web clients.
 */
export function isOneDriveConfigured(): boolean {
  const hasValidClientId = Boolean(ONEDRIVE_CONFIG.CLIENT_ID &&
    !ONEDRIVE_CONFIG.CLIENT_ID.includes('your-') &&
    ONEDRIVE_CONFIG.CLIENT_ID.length > 10);

  return hasValidClientId;
}

/**
 * Get detailed configuration status
 */
export function getConfigurationStatus(): {
  configured: boolean;
  environment: string;
  clientIdConfigured: boolean;
  clientSecretConfigured: boolean;
  issues: string[];
} {
  const environment = getCurrentEnvironment();
  const clientIdConfigured = Boolean(ONEDRIVE_CONFIG.CLIENT_ID &&
    !ONEDRIVE_CONFIG.CLIENT_ID.includes('your-') &&
    ONEDRIVE_CONFIG.CLIENT_ID.length > 10);
  const clientSecretConfigured = Boolean(ONEDRIVE_CONFIG.CLIENT_SECRET &&
    !ONEDRIVE_CONFIG.CLIENT_SECRET.includes('your-') &&
    ONEDRIVE_CONFIG.CLIENT_SECRET.length > 10);

  const issues: string[] = [];

  if (!clientIdConfigured) {
    issues.push('OAuth Client ID not configured');
  }

  // Client secret is optional for public clients (Tauri/desktop using PKCE).
  // Only flag it as an issue for web/production environments.
  if (!clientSecretConfigured && environment === 'production') {
    issues.push('OAuth Client Secret not configured (required for web production)');
  }

  // Check if current domain is authorized (in browser environment)
  if (typeof window !== 'undefined') {
    const currentOrigin = window.location.origin;
    const isAuthorized = ONEDRIVE_CONFIG.AUTHORIZED_DOMAINS.some(domain =>
      currentOrigin === domain || currentOrigin.startsWith(domain)
    );

    if (!isAuthorized) {
      issues.push(`Current domain ${currentOrigin} not in authorized domains`);
    }
  }

  return {
    configured: clientIdConfigured,
    environment,
    clientIdConfigured,
    clientSecretConfigured,
    issues
  };
}

/**
 * Get user-friendly error message for unconfigured credentials
 */
export function getConfigurationErrorMessage(): string {
  const status = getConfigurationStatus();

  if (status.configured) {
    return '';
  }

  const baseMessage = 'OneDrive integration requires configuration to function.';

  if (status.environment === 'development') {
    return `${baseMessage} Please follow the setup instructions in ONEDRIVE_SETUP.md to configure your development environment. Issues: ${status.issues.join(', ')}`;
  }

  return `${baseMessage} This feature will be available once the application is properly configured by the maintainers.`;
}

/**
 * Validate current configuration and log warnings
 */
export function validateConfiguration(): void {
  const status = getConfigurationStatus();

  if (!status.configured) {
    console.warn('OneDrive integration not configured:', status.issues);
  } else {
    console.info(`OneDrive integration configured for ${status.environment} environment`);
  }

  // Additional runtime validations
  if (typeof window !== 'undefined') {
    const currentOrigin = window.location.origin;
    const isAuthorized = ONEDRIVE_CONFIG.AUTHORIZED_DOMAINS.some(domain =>
      currentOrigin === domain || currentOrigin.startsWith(domain)
    );

    if (!isAuthorized) {
      console.warn(`Current domain ${currentOrigin} not in authorized domains. OAuth may fail.`);
    }
  }
}

/**
 * Get configuration for debugging (safe for logging)
 */
export function getDebugConfiguration(): Record<string, any> {
  const status = getConfigurationStatus();

  return {
    environment: status.environment,
    configured: status.configured,
    clientIdConfigured: status.clientIdConfigured,
    clientSecretConfigured: status.clientSecretConfigured,
    authorizedDomains: ONEDRIVE_CONFIG.AUTHORIZED_DOMAINS,
    scopes: ONEDRIVE_CONFIG.SCOPES,
    issues: status.issues,
    // Never log actual credentials
    clientIdPrefix: ONEDRIVE_CONFIG.CLIENT_ID.substring(0, 10) + '...',
    clientSecretPrefix: ONEDRIVE_CONFIG.CLIENT_SECRET.substring(0, 10) + '...'
  };
}
