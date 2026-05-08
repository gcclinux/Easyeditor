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

export {
  BOX_CONFIG,
  isBoxConfigured,
  getConfigurationStatus as getBoxConfigurationStatus,
  getConfigurationErrorMessage as getBoxConfigurationErrorMessage,
  validateConfiguration as validateBoxConfiguration,
  getDebugConfiguration as getBoxDebugConfiguration
} from './box-credentials';

export {
  ONEDRIVE_CONFIG,
  isOneDriveConfigured,
  getConfigurationStatus as getOneDriveConfigurationStatus,
  getConfigurationErrorMessage as getOneDriveConfigurationErrorMessage,
  validateConfiguration as validateOneDriveConfiguration,
  getDebugConfiguration as getOneDriveDebugConfiguration
} from './onedrive-credentials';

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
  validateBoxConfiguration();
  validateOneDriveConfiguration();
  
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

    const boxStatus = getBoxConfigurationStatus();
    if (!boxStatus.configured) {
      console.group('🔧 Box Configuration');
      console.warn('Configuration issues detected:', boxStatus.issues);
      console.groupEnd();
    } else {
      console.info('✅ Box configuration is valid');
    }

    const onedriveStatus = getOneDriveConfigurationStatus();
    if (!onedriveStatus.configured) {
      console.group('🔧 OneDrive Configuration');
      console.warn('Configuration issues detected:', onedriveStatus.issues);
      console.groupEnd();
    } else {
      console.info('✅ OneDrive configuration is valid');
    }
  }
}

/**
 * Check if any cloud provider is configured and ready
 */
export function isAnyCloudProviderReady(): boolean {
  return isGoogleDriveConfigured() || isDropboxConfigured() || isBoxConfigured() || isOneDriveConfigured();
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
  const boxStatus = getBoxConfigurationStatus();
  const onedriveStatus = getOneDriveConfigurationStatus();
  
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
    },
    {
      name: 'box',
      displayName: 'Box',
      configured: isBoxConfigured(),
      status: boxStatus.configured ? 'ready' : 'needs-setup',
      message: boxStatus.configured 
        ? `Configured for ${boxStatus.environment}` 
        : boxStatus.issues.join(', ')
    },
    {
      name: 'onedrive',
      displayName: 'OneDrive',
      configured: isOneDriveConfigured(),
      status: onedriveStatus.configured ? 'ready' : 'needs-setup',
      message: onedriveStatus.configured 
        ? `Configured for ${onedriveStatus.environment}` 
        : onedriveStatus.issues.join(', ')
    }
  ];
}