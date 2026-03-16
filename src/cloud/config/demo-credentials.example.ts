/**
 * Example Google Drive Configuration for Testing
 * 
 * Copy this file to google-credentials.ts and update with your actual credentials
 * for development and testing purposes.
 */

export const GOOGLE_DRIVE_CONFIG = {
  // Replace with your actual OAuth 2.0 Client ID from Google Cloud Console
  CLIENT_ID: import.meta.env.PROD 
    ? 'your-production-client-id.apps.googleusercontent.com'
    : 'your-development-client-id.apps.googleusercontent.com',
    
  // Replace with your actual API Key from Google Cloud Console
  API_KEY: import.meta.env.PROD
    ? 'your-production-api-key'
    : 'your-development-api-key',
    
  // OAuth scopes required by EasyEditor
  SCOPES: [
    'https://www.googleapis.com/auth/drive.file',    // Create, edit, delete files the app creates
    'https://www.googleapis.com/auth/drive.readonly'  // Read all files (needed to discover manually uploaded files)
  ],
  
  // Discovery document for Google Drive API v3
  DISCOVERY_DOC: 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'
};

/**
 * Check if Google Drive credentials are properly configured
 */
export function isGoogleDriveConfigured(): boolean {
  return !GOOGLE_DRIVE_CONFIG.CLIENT_ID.includes('your-') && 
         !GOOGLE_DRIVE_CONFIG.API_KEY.includes('your-');
}

/**
 * Get user-friendly error message for unconfigured credentials
 */
export function getConfigurationErrorMessage(): string {
  return 'Google Drive integration is ready but needs to be configured with valid credentials. ' +
         'Please follow the setup instructions in GOOGLE_DRIVE_SETUP.md to enable this feature.';
}