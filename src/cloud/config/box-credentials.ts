/**
 * Box API Configuration for EasyEditor
 * 
 * This configuration supports multiple deployment environments and provides
 * comprehensive credential management for Box integration.
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
 * Check if running in Tauri environment
 */
export function isTauriEnvironment(): boolean {
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
 * Get the appropriate Box Client ID based on environment
 */
function getBoxClientId(): string {
  return getEnvVar('VITE_BOX_CLIENT_ID') || 'your-development-client-id';
}

/**
 * Get the appropriate Box Client Secret based on environment
 */
function getBoxClientSecret(): string {
  return getEnvVar('VITE_BOX_CLIENT_SECRET') || 'your-development-client-secret';
}

interface BoxEnvironmentConfig {
  CLIENT_ID: string;
  CLIENT_SECRET: string;
  AUTHORIZED_DOMAINS: string[];
  REDIRECT_URI: string;
}

interface BoxConfig {
  CLIENT_ID: string;
  CLIENT_SECRET: string;
  SCOPES: string[];
  AUTHORIZED_DOMAINS: string[];
  REDIRECT_URI: string;
}

/**
 * Environment-specific configurations
 */
const ENVIRONMENT_CONFIGS: Record<string, BoxEnvironmentConfig> = {
  development: {
    CLIENT_ID: getBoxClientId(),
    CLIENT_SECRET: getBoxClientSecret(),
    AUTHORIZED_DOMAINS: [
      'http://localhost:3024',
      'https://localhost:3024',
      'http://127.0.0.1:3024',
      'https://127.0.0.1:3024',
      'http://localhost:5000',
      'http://tauri.localhost',
      'https://tauri.localhost',
      'tauri://localhost',
      'https://easyedit-cloud.web.app'
    ],
    REDIRECT_URI: typeof window !== 'undefined' ? `${window.location.origin}/box-oauth-callback.html` : 'http://localhost:3024/box-oauth-callback.html'
  },

  production: {
    CLIENT_ID: getEnvVar('VITE_BOX_CLIENT_ID_PROD') ||
      'your-production-client-id',
    CLIENT_SECRET: getEnvVar('VITE_BOX_CLIENT_SECRET_PROD') ||
      'your-production-client-secret',
    AUTHORIZED_DOMAINS: [
      'https://easyeditor.co.uk',
      'https://www.easyeditor.co.uk',
      'https://easyedit-cloud.web.app'
    ],
    REDIRECT_URI: 'https://easyeditor.co.uk/box-oauth-callback.html'
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
function getEnvironmentConfig(): BoxEnvironmentConfig {
  const environment = getCurrentEnvironment();
  const config = ENVIRONMENT_CONFIGS[environment];

  if (!config) {
    console.warn(`Unknown environment: ${environment}, falling back to development`);
    return ENVIRONMENT_CONFIGS.development;
  }

  return config;
}

/**
 * Main Box configuration object
 */
export const BOX_CONFIG: BoxConfig = (() => {
  const envConfig = getEnvironmentConfig();

  return {
    CLIENT_ID: envConfig.CLIENT_ID,
    CLIENT_SECRET: envConfig.CLIENT_SECRET,
    AUTHORIZED_DOMAINS: envConfig.AUTHORIZED_DOMAINS,
    REDIRECT_URI: envConfig.REDIRECT_URI,

    // OAuth scopes required by EasyEditor for Box
    SCOPES: [
      'root_readwrite'
    ]
  };
})();

/**
 * Check if Box credentials are properly configured
 */
export function isBoxConfigured(): boolean {
  const hasValidClientId = Boolean(BOX_CONFIG.CLIENT_ID &&
    !BOX_CONFIG.CLIENT_ID.includes('your-') &&
    BOX_CONFIG.CLIENT_ID.length > 10);

  const hasValidClientSecret = Boolean(BOX_CONFIG.CLIENT_SECRET &&
    !BOX_CONFIG.CLIENT_SECRET.includes('your-') &&
    BOX_CONFIG.CLIENT_SECRET.length > 10);

  return hasValidClientId && hasValidClientSecret;
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
  const clientIdConfigured = Boolean(BOX_CONFIG.CLIENT_ID &&
    !BOX_CONFIG.CLIENT_ID.includes('your-') &&
    BOX_CONFIG.CLIENT_ID.length > 10);
  const clientSecretConfigured = Boolean(BOX_CONFIG.CLIENT_SECRET &&
    !BOX_CONFIG.CLIENT_SECRET.includes('your-') &&
    BOX_CONFIG.CLIENT_SECRET.length > 10);

  const issues: string[] = [];

  if (!clientIdConfigured) {
    issues.push('OAuth Client ID not configured');
  }

  if (!clientSecretConfigured) {
    issues.push('OAuth Client Secret not configured');
  }

  // Check if current domain is authorized (in browser environment)
  if (typeof window !== 'undefined') {
    const currentOrigin = window.location.origin;
    const isAuthorized = BOX_CONFIG.AUTHORIZED_DOMAINS.some(domain =>
      currentOrigin === domain || currentOrigin.startsWith(domain)
    );

    if (!isAuthorized) {
      issues.push(`Current domain ${currentOrigin} not in authorized domains`);
    }
  }

  return {
    configured: clientIdConfigured && clientSecretConfigured,
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

  const baseMessage = 'Box integration requires configuration to function.';

  if (status.environment === 'development') {
    return `${baseMessage} Please follow the setup instructions in BOX_SETUP.md to configure your development environment. Issues: ${status.issues.join(', ')}`;
  }

  return `${baseMessage} This feature will be available once the application is properly configured by the maintainers.`;
}

/**
 * Validate current configuration and log warnings
 */
export function validateConfiguration(): void {
  const status = getConfigurationStatus();

  if (!status.configured) {
    console.warn('Box integration not configured:', status.issues);
  } else {
    console.info(`Box integration configured for ${status.environment} environment`);
  }

  // Additional runtime validations
  if (typeof window !== 'undefined') {
    const currentOrigin = window.location.origin;
    const isAuthorized = BOX_CONFIG.AUTHORIZED_DOMAINS.some(domain =>
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
    authorizedDomains: BOX_CONFIG.AUTHORIZED_DOMAINS,
    scopes: BOX_CONFIG.SCOPES,
    issues: status.issues,
    // Never log actual credentials
    clientIdPrefix: BOX_CONFIG.CLIENT_ID.substring(0, 10) + '...',
    clientSecretPrefix: BOX_CONFIG.CLIENT_SECRET.substring(0, 10) + '...'
  };
}
