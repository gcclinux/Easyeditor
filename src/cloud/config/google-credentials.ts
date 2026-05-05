/**
 * Google Drive API Configuration for EasyEditor
 * 
 * This configuration supports multiple deployment environments and provides
 * comprehensive credential management for Google Drive integration.
 */

/**
 * Safe environment variable access that works in both Vite and Jest environments
 */
function getEnvVar(key: string): string | undefined {
  // In Vite environment (browser) - import.meta is available at build time
  if (typeof window !== 'undefined') {
    // Use Vite's import.meta.env which is available in browser builds
    try {
      return (import.meta as any).env[key];
    } catch (e) {
      // Fallback if import.meta is not available
    }
  }

  // In Node.js/Jest environment
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key];
  }

  return undefined;
}

/**
 * Get current build mode safely
 */
function getBuildMode(): string {
  // In Vite environment (browser)
  if (typeof window !== 'undefined') {
    try {
      return (import.meta as any).env.MODE || 'development';
    } catch (e) {
      // Fallback if import.meta is not available
    }
  }

  // In Node.js/Jest environment
  if (typeof process !== 'undefined' && process.env) {
    return process.env.NODE_ENV || 'development';
  }

  return 'development';
}

/**
 * Check if running in Tauri environment
 */
function isTauriEnvironment(): boolean {
  if (typeof window === 'undefined') return false;

  return (
    (window as any).__TAURI__ !== undefined ||
    (window as any).__TAURI_INTERNALS__ !== undefined ||
    (window as any).__TAURI_INVOKE__ !== undefined ||
    window.location.protocol === 'tauri:' ||
    window.location.hostname === 'tauri.localhost'
  );
}

/**
 * Get the appropriate Google Client ID based on environment
 * Uses VITE_GOOGLE_CLIENT_APP for Tauri desktop app
 * Uses VITE_GOOGLE_CLIENT_ID for web
 */
function getGoogleClientId(): string {
  // In Tauri, prefer the desktop app client ID
  if (isTauriEnvironment()) {
    const tauriClientId = getEnvVar('VITE_GOOGLE_CLIENT_APP');
    if (tauriClientId && !tauriClientId.includes('your-')) {
      console.log('[GoogleCredentials] Using VITE_GOOGLE_CLIENT_APP for Tauri environment');
      return tauriClientId;
    }
  }

  // Fall back to web client ID
  return getEnvVar('VITE_GOOGLE_CLIENT_ID') ||
    'your-development-client-id.apps.googleusercontent.com';
}

/**
 * Get the appropriate Google Client Secret based on environment
 * Google requires client_secret even for Desktop apps with PKCE (deviation from RFC 7636)
 */
function getGoogleClientSecret(): string | undefined {
  const secret = getEnvVar('VITE_GOOGLE_CLIENT_SECRET');
  if (secret && !secret.includes('your-')) {
    return secret;
  }
  return undefined;
}

interface GoogleDriveEnvironmentConfig {
  CLIENT_ID: string;
  CLIENT_SECRET?: string;
  API_KEY: string;
  AUTHORIZED_DOMAINS: string[];
  REDIRECT_URI?: string;
}

interface GoogleDriveConfig {
  CLIENT_ID: string;
  CLIENT_SECRET?: string;
  API_KEY: string;
  SCOPES: string[];
  DISCOVERY_DOC: string;
  AUTHORIZED_DOMAINS: string[];
  REDIRECT_URI?: string;
}

/**
 * Environment-specific configurations
 */
const ENVIRONMENT_CONFIGS: Record<string, GoogleDriveEnvironmentConfig> = {
  development: {
    CLIENT_ID: getGoogleClientId(),
    CLIENT_SECRET: getGoogleClientSecret(),
    API_KEY: getEnvVar('VITE_GOOGLE_API_KEY') ||
      'your-development-api-key',
    AUTHORIZED_DOMAINS: [
      'http://localhost:3024',
      'https://localhost:3024',
      'http://127.0.0.1:3024',
      'https://127.0.0.1:3024',
      'http://tauri.localhost',
      'https://tauri.localhost',
      'tauri://localhost',
      'https://easyedit-cloud.web.app'
    ],
    REDIRECT_URI: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3024'
  },

  production: {
    CLIENT_ID: getEnvVar('VITE_GOOGLE_CLIENT_ID_PROD') ||
      'your-production-client-id.apps.googleusercontent.com',
    API_KEY: getEnvVar('VITE_GOOGLE_API_KEY_PROD') ||
      'your-production-api-key',
    AUTHORIZED_DOMAINS: [
      'https://easyeditor.co.uk',
      'https://www.easyeditor.co.uk',
      'https://easyedit-cloud.web.app'
    ],
    REDIRECT_URI: 'https://easyeditor.co.uk'
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
function getEnvironmentConfig(): GoogleDriveEnvironmentConfig {
  const environment = getCurrentEnvironment();
  const config = ENVIRONMENT_CONFIGS[environment];

  if (!config) {
    console.warn(`Unknown environment: ${environment}, falling back to development`);
    return ENVIRONMENT_CONFIGS.development;
  }

  return config;
}

/**
 * Main Google Drive configuration object
 */
export const GOOGLE_DRIVE_CONFIG: GoogleDriveConfig = (() => {
  const envConfig = getEnvironmentConfig();

  return {
    CLIENT_ID: envConfig.CLIENT_ID,
    CLIENT_SECRET: envConfig.CLIENT_SECRET,
    API_KEY: envConfig.API_KEY,
    AUTHORIZED_DOMAINS: envConfig.AUTHORIZED_DOMAINS,
    REDIRECT_URI: envConfig.REDIRECT_URI,

    // OAuth scopes required by EasyEditor
    // NOTE: We now use 'drive.file' scope as recommended by Google to avoid
    // restricted scope verification. This requires users to explicitly
    // open externally created files using the Google Picker.
    SCOPES: [
      'https://www.googleapis.com/auth/drive.file',
    ],

    // Discovery document for Google Drive API v3
    DISCOVERY_DOC: 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'
  };
})();

/**
 * Check if Google Drive credentials are properly configured
 */
export function isGoogleDriveConfigured(): boolean {
  const hasValidClientId = Boolean(GOOGLE_DRIVE_CONFIG.CLIENT_ID &&
    !GOOGLE_DRIVE_CONFIG.CLIENT_ID.includes('your-') &&
    GOOGLE_DRIVE_CONFIG.CLIENT_ID.length > 10);

  const hasValidApiKey = Boolean(GOOGLE_DRIVE_CONFIG.API_KEY &&
    !GOOGLE_DRIVE_CONFIG.API_KEY.includes('your-') &&
    GOOGLE_DRIVE_CONFIG.API_KEY.length > 10);

  return hasValidClientId && hasValidApiKey;
}

/**
 * Get detailed configuration status
 */
export function getConfigurationStatus(): {
  configured: boolean;
  environment: string;
  clientIdConfigured: boolean;
  apiKeyConfigured: boolean;
  issues: string[];
} {
  const environment = getCurrentEnvironment();
  const clientIdConfigured = Boolean(GOOGLE_DRIVE_CONFIG.CLIENT_ID &&
    !GOOGLE_DRIVE_CONFIG.CLIENT_ID.includes('your-') &&
    GOOGLE_DRIVE_CONFIG.CLIENT_ID.length > 10);
  const apiKeyConfigured = Boolean(GOOGLE_DRIVE_CONFIG.API_KEY &&
    !GOOGLE_DRIVE_CONFIG.API_KEY.includes('your-') &&
    GOOGLE_DRIVE_CONFIG.API_KEY.length > 10);

  const issues: string[] = [];

  if (!clientIdConfigured) {
    issues.push('OAuth Client ID not configured');
  }

  if (!apiKeyConfigured) {
    issues.push('API Key not configured');
  }

  // Check if current domain is authorized (in browser environment)
  if (typeof window !== 'undefined') {
    const currentOrigin = window.location.origin;
    const isAuthorized = GOOGLE_DRIVE_CONFIG.AUTHORIZED_DOMAINS.some(domain =>
      currentOrigin === domain || currentOrigin.startsWith(domain)
    );

    if (!isAuthorized) {
      issues.push(`Current domain ${currentOrigin} not in authorized domains`);
    }
  }

  return {
    configured: clientIdConfigured && apiKeyConfigured,
    environment,
    clientIdConfigured,
    apiKeyConfigured,
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

  const baseMessage = 'Google Drive integration requires configuration to function.';

  if (status.environment === 'development') {
    return `${baseMessage} Please follow the setup instructions in GOOGLE_DRIVE_SETUP.md to configure your development environment. Issues: ${status.issues.join(', ')}`;
  }

  return `${baseMessage} This feature will be available once the application is properly configured by the maintainers.`;
}

/**
 * Validate current configuration and log warnings
 */
export function validateConfiguration(): void {
  const status = getConfigurationStatus();

  if (!status.configured) {
    console.warn('Google Drive integration not configured:', status.issues);
  } else {
    console.info(`Google Drive integration configured for ${status.environment} environment`);
  }

  // Additional runtime validations
  if (typeof window !== 'undefined') {
    const currentOrigin = window.location.origin;
    const isAuthorized = GOOGLE_DRIVE_CONFIG.AUTHORIZED_DOMAINS.some(domain =>
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
    apiKeyConfigured: status.apiKeyConfigured,
    authorizedDomains: GOOGLE_DRIVE_CONFIG.AUTHORIZED_DOMAINS,
    scopes: GOOGLE_DRIVE_CONFIG.SCOPES,
    issues: status.issues,
    // Never log actual credentials
    clientIdPrefix: GOOGLE_DRIVE_CONFIG.CLIENT_ID.substring(0, 10) + '...',
    apiKeyPrefix: GOOGLE_DRIVE_CONFIG.API_KEY.substring(0, 10) + '...'
  };
}
