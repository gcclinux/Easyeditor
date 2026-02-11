/**
 * Cloud Configuration Management
 * 
 * Centralized exports for all cloud configuration functionality
 */

// Core configuration
export {
  GOOGLE_DRIVE_CONFIG,
  isGoogleDriveConfigured,
  getConfigurationStatus,
  getConfigurationErrorMessage,
  validateConfiguration,
  getDebugConfiguration
} from './google-credentials';

export {
  DROPBOX_CONFIG,
  isDropboxConfigured,
  getConfigurationStatus as getDropboxConfigurationStatus,
  getConfigurationErrorMessage as getDropboxConfigurationErrorMessage,
  validateConfiguration as validateDropboxConfiguration,
  getDebugConfiguration as getDropboxDebugConfiguration
} from './dropbox-credentials';

// Configuration validation
export {
  validateGoogleDriveConfiguration,
  getSetupInstructions,
  generateConfigurationReport,
  isProductionReady,
  getQuickStatus
} from './config-validator';

// Types
export type { ValidationResult, SetupInstructions } from './config-validator';

/**
 * Initialize cloud configuration system
 * Call this early in the application lifecycle
 */
export function initializeCloudConfiguration(): void {
  validateConfiguration();
  validateDropboxConfiguration();
  
  // Log configuration status in development
  if (!import.meta.env.PROD) {
    const validation = validateGoogleDriveConfiguration(true);
    if (!validation.isValid) {
      console.group('🔧 Google Drive Configuration');
      console.warn('Configuration issues detected:', validation.errors);
      if (validation.suggestions.length > 0) {
        console.info('Suggestions:', validation.suggestions);
      }
      console.groupEnd();
    } else {
      console.info('✅ Google Drive configuration is valid');
    }

    const dropboxStatus = getDropboxConfigurationStatus();
    if (!dropboxStatus.configured) {
      console.group('🔧 Dropbox Configuration');
      console.warn('Configuration issues detected:', dropboxStatus.issues);
      console.groupEnd();
    } else {
      console.info('✅ Dropbox configuration is valid');
    }
  }
}

/**
 * Check if any cloud provider is configured and ready
 */
export function isAnyCloudProviderReady(): boolean {
  return isGoogleDriveConfigured() || isDropboxConfigured();
}

/**
 * Get list of available cloud providers with their status
 */
export function getAvailableProviders(): Array<{
  name: string;
  displayName: string;
  configured: boolean;
  status: 'ready' | 'needs-setup' | 'error';
  message: string;
}> {
  const googleStatus = getQuickStatus();
  const dropboxStatus = getDropboxConfigurationStatus();
  
  return [
    {
      name: 'googledrive',
      displayName: 'Google Drive',
      configured: isGoogleDriveConfigured(),
      status: googleStatus.status,
      message: googleStatus.message
    },
    {
      name: 'dropbox',
      displayName: 'Dropbox',
      configured: isDropboxConfigured(),
      status: dropboxStatus.configured ? 'ready' : 'needs-setup',
      message: dropboxStatus.configured 
        ? `Configured for ${dropboxStatus.environment}` 
        : dropboxStatus.issues.join(', ')
    }
  ];
}