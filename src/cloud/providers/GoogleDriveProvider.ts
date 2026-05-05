/**
 * GoogleDriveProvider - Google Drive implementation of CloudProvider interface
 * Implements OAuth 2.0 authentication and Google Drive API integration
 */


import type { CloudProvider, CloudFile, AuthResult } from '../interfaces';
import { cloudCredentialManager } from '../managers/CloudCredentialManager';
import {
  GOOGLE_DRIVE_CONFIG,
  isGoogleDriveConfigured,
  getConfigurationErrorMessage,
  validateConfiguration
} from '../config/google-credentials';
import { validateGoogleDriveConfiguration } from '../config/config-validator';
import { ErrorHandler } from '../utils/ErrorHandler';
import { cloudToastService } from '../utils/CloudToastService';
import { runGoogleApiTests, testOAuthClientId } from '../utils/GoogleApiTest';
import '../utils/ConnectionDiagnostic'; // Load diagnostic utility

interface GoogleDriveFile {
  id: string;
  name: string;
  modifiedTime: string;
  size: string;
  mimeType: string;
  webContentLink?: string;
}

interface GoogleDriveResponse {
  files: GoogleDriveFile[];
  nextPageToken?: string;
}

export class GoogleDriveProvider implements CloudProvider {
  readonly name = 'googledrive';
  readonly displayName = 'Google Drive';
  readonly icon = '🗂️'; // Will be replaced with proper icon in UI integration

  private clientId: string;
  private apiKey: string;
  private scope: string = 'https://www.googleapis.com/auth/drive.file';
  private isGapiInitialized: boolean = false;
  private gapiInstance: any = null;

  constructor(clientId?: string, apiKey?: string) {
    // Use configuration system with fallback to constructor params
    this.clientId = clientId || GOOGLE_DRIVE_CONFIG.CLIENT_ID;
    this.apiKey = apiKey || GOOGLE_DRIVE_CONFIG.API_KEY;
    this.scope = GOOGLE_DRIVE_CONFIG.SCOPES.join(' ');

    // Validate configuration on initialization
    validateConfiguration();

    if (!isGoogleDriveConfigured()) {
      console.warn('Google Drive integration not configured. Users will see a helpful error message.');

      // Log detailed configuration status in development
      const isDevelopment = (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') ||
        (typeof window !== 'undefined' && (window as any).import?.meta?.env?.MODE === 'development');
      if (isDevelopment) {
        const validation = validateGoogleDriveConfiguration(true);
        console.warn('Configuration validation:', validation);
      }
    }
  }


  /**
   * Initialize Google API client if not already initialized
   */
  private async initializeGapi(): Promise<void> {
    if (this.isGapiInitialized) {
      return;
    }

    try {
      console.log('[GoogleDriveProvider] Initializing GAPI...');

      // Import and initialize gapi from gapi-script
      const { gapi: gapiInstance } = await import('gapi-script');
      this.gapiInstance = gapiInstance;

      // Ensure gapi is available
      if (!this.gapiInstance) {
        throw new Error('Failed to load Google API script');
      }

      console.log('[GoogleDriveProvider] GAPI script loaded, loading client and auth2...');

      // Load GAPI client and auth2 libraries
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout loading Google API libraries'));
        }, 15000); // Increased timeout

        this.gapiInstance.load('client:auth2', {
          callback: () => {
            clearTimeout(timeout);
            console.log('[GoogleDriveProvider] GAPI libraries loaded successfully');
            resolve();
          },
          onerror: (error: any) => {
            clearTimeout(timeout);
            console.error('[GoogleDriveProvider] Error loading GAPI libraries:', error);
            reject(new Error('Failed to load Google API libraries'));
          }
        });
      });

      console.log('[GoogleDriveProvider] Initializing GAPI client...');

      // Initialize the client
      await this.gapiInstance.client.init({
        apiKey: this.apiKey,
        clientId: this.clientId,
        scope: this.scope
      });

      // Wait a bit more for auth2 to be fully ready
      await new Promise(resolve => setTimeout(resolve, 1000));

      console.log('[GoogleDriveProvider] GAPI client initialized successfully');
      this.isGapiInitialized = true;
    } catch (error) {
      console.error('[GoogleDriveProvider] Failed to initialize GAPI:', error);
      throw new Error(`Failed to initialize Google API: ${(error as Error).message}`);
    }
  }

  async authenticate(): Promise<AuthResult> {
    try {
      console.log('[GoogleDriveProvider] Starting authentication...');

      // Run OAuth configuration test only (skip API key test for now)
      const oauthTest = await testOAuthClientId();
      if (!oauthTest.success) {
        console.error('[GoogleDriveProvider] OAuth configuration test failed:', oauthTest);
        return {
          success: false,
          error: oauthTest.message
        };
      }

      console.log('[GoogleDriveProvider] OAuth configuration test passed');

      // Validate configuration before attempting authentication
      const validation = validateGoogleDriveConfiguration();
      if (!validation.isValid) {
        const error = getConfigurationErrorMessage();
        console.error('[GoogleDriveProvider] Configuration validation failed:', validation);
        cloudToastService.showConfigurationMessage(this.displayName, false);
        return {
          success: false,
          error
        };
      }

      console.log('[GoogleDriveProvider] Configuration valid, initializing GAPI...');

      return await ErrorHandler.withRetry(async () => {
        await this.initializeGapi();
        console.log('[GoogleDriveProvider] GAPI initialized successfully');

        const authInstance = this.gapiInstance.auth2.getAuthInstance();
        if (!authInstance) {
          throw ErrorHandler.enhanceError(
            new Error('Failed to get Google Auth instance'),
            { operation: 'authenticate', provider: this.name }
          );
        }

        console.log('[GoogleDriveProvider] Auth instance obtained, checking sign-in status...');

        // Check if user is already signed in
        if (authInstance.isSignedIn.get()) {
          console.log('[GoogleDriveProvider] User already signed in');
          const user = authInstance.currentUser.get();
          const authResponse = (user as any).getAuthResponse();

          const result: AuthResult = {
            success: true,
            accessToken: authResponse.access_token,
            expiresAt: new Date(Date.now() + (authResponse.expires_in * 1000))
          };

          // Save credentials
          await this.saveCredentials(result, (user as any).getBasicProfile().getEmail());
          return result;
        }

        console.log('[GoogleDriveProvider] User not signed in, starting sign-in flow...');

        // Sign in user - use popup flow (user should have enabled popups by now)
        let user;
        try {
          console.log('[GoogleDriveProvider] Attempting popup-based authentication...');

          // Use popup flow - should work if user enabled popups
          user = await ErrorHandler.withTimeout(
            authInstance.signIn({
              prompt: 'select_account',
              ux_mode: 'popup'
            }),
            60000 // Longer timeout for popup
          );

          if (!user) {
            throw new Error('Popup authentication failed');
          }

          console.log('[GoogleDriveProvider] Popup authentication succeeded');

          if (!user) {
            throw new Error('Sign-in was cancelled or failed');
          }
        } catch (popupError: any) {
          console.warn('[GoogleDriveProvider] Popup authentication failed:', popupError);

          // No fallback - popup should work if user enabled it
          console.error('[GoogleDriveProvider] Popup authentication failed:', popupError);

          // Provide specific error messages for common OAuth issues
          if (popupError.error === 'popup_blocked_by_browser') {
            throw new Error('Sign-in popup was blocked by your browser. Please enable popups for this site in your browser settings, or try using a different browser.');
          } else if (popupError.error === 'popup_closed_by_user') {
            throw new Error('Sign-in was cancelled. Please try again and complete the sign-in process.');
          } else if (popupError.error === 'access_denied') {
            throw new Error('Access was denied. Please try again and grant the necessary permissions.');
          } else if (popupError.error === 'invalid_client') {
            throw new Error('OAuth configuration error. The client ID may not be properly configured for this domain.');
          } else if (popupError.message && popupError.message.includes('origin')) {
            throw new Error('OAuth configuration error: This domain is not authorized. Please check the Google Cloud Console OAuth settings.');
          }

          throw popupError;
        }

        console.log('[GoogleDriveProvider] Sign-in completed successfully');
        const authResponse = (user as any).getAuthResponse();

        const result: AuthResult = {
          success: true,
          accessToken: authResponse.access_token,
          expiresAt: new Date(Date.now() + (authResponse.expires_in * 1000))
        };

        // Save credentials
        await this.saveCredentials(result, (user as any).getBasicProfile().getEmail());
        console.log('[GoogleDriveProvider] Authentication completed and credentials saved');
        return result;
      },
        { operation: 'authenticate', provider: this.name },
        { maxRetries: 1 } // Limited retries for authentication
      );

    } catch (error) {
      console.error('[GoogleDriveProvider] Authentication failed:', error);
      const cloudError = ErrorHandler.enhanceError(error, {
        operation: 'authenticate',
        provider: this.name
      });

      return {
        success: false,
        error: ErrorHandler.getUserFriendlyMessage(cloudError)
      };
    }
  }

  async isAuthenticated(): Promise<boolean> {
    try {
      // Check if we have valid stored credentials
      const credentials = await cloudCredentialManager.getCredentials(this.name);
      if (!credentials) {
        return false;
      }

      // Check if credentials are expired
      if (credentials.expiresAt && credentials.expiresAt <= new Date()) {
        // Try to refresh token
        return await this.refreshToken();
      }

      // Verify with Google API
      await this.initializeGapi();
      const authInstance = this.gapiInstance.auth2.getAuthInstance();
      return authInstance?.isSignedIn.get() || false;

    } catch (error) {
      console.error('Error checking authentication status:', error);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.initializeGapi();
      const authInstance = this.gapiInstance.auth2.getAuthInstance();

      if (authInstance && authInstance.isSignedIn.get()) {
        await authInstance.signOut();
      }

      // Remove stored credentials
      await cloudCredentialManager.removeCredentials(this.name);

    } catch (error) {
      console.error('Error during disconnect:', error);
      // Still remove credentials even if Google API call fails
      await cloudCredentialManager.removeCredentials(this.name);
    }
  }

  async createApplicationFolder(): Promise<string> {
    try {
      console.log('[GoogleDriveProvider] Creating application folder...');
      const accessToken = await this.getValidAccessToken();
      console.log('[GoogleDriveProvider] Got access token, checking for existing folder...');

      // Check if EasyEditor folder already exists
      const existingFolder = await this.findApplicationFolder();
      if (existingFolder) {
        console.log('[GoogleDriveProvider] Found existing folder:', existingFolder);
        return existingFolder;
      }

      console.log('[GoogleDriveProvider] No existing folder found, creating new one...');

      // Create new Easyeditor folder
      const response = await this.makeApiCall('/drive/v3/files', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Easyeditor',
          mimeType: 'application/vnd.google-apps.folder',
          parents: ['root']
        })
      });

      console.log('[GoogleDriveProvider] Create folder response:', response);

      if (!response.id) {
        throw new Error('Failed to create application folder - no ID returned');
      }

      console.log('[GoogleDriveProvider] Successfully created folder with ID:', response.id);
      return response.id;

    } catch (error) {
      console.error('[GoogleDriveProvider] Error creating application folder:', error);
      throw new Error(`Failed to create application folder: ${(error as Error).message}`);
    }
  }

  async listFiles(folderId: string): Promise<CloudFile[]> {
    try {
      const accessToken = await this.getValidAccessToken();

      const allFiles: GoogleDriveFile[] = [];
      let pageToken: string | undefined;

      do {
        const pageParam = pageToken ? `&pageToken=${pageToken}` : '';
        const response: GoogleDriveResponse = await this.makeApiCall(
          `/drive/v3/files?q=parents in '${folderId}' and trashed=false&fields=nextPageToken,files(id,name,modifiedTime,size,mimeType,webContentLink)&pageSize=100${pageParam}`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            }
          }
        );
        allFiles.push(...(response.files || []));
        pageToken = response.nextPageToken;
      } while (pageToken);

      console.log(`[GoogleDriveProvider] Raw files from API: ${allFiles.length}`, allFiles.map(f => `${f.name} (${f.mimeType})`));

      // Filter to only include .md and .sstp files by extension
      const filtered = allFiles.filter(file => /\.(md|sstp)$/i.test(file.name));
      console.log(`[GoogleDriveProvider] After extension filter: ${filtered.length} files`);

      return filtered.map(file => ({
        id: file.id,
        name: file.name,
        modifiedTime: new Date(file.modifiedTime),
        size: parseInt(file.size) || 0,
        mimeType: file.mimeType,
        downloadUrl: file.webContentLink
      }));

    } catch (error) {
      throw new Error(`Failed to list files: ${(error as Error).message}`);
    }
  }

  async downloadFile(fileId: string): Promise<string | Uint8Array> {
    try {
      const accessToken = await this.getValidAccessToken();

      const response = await this.makeApiCall(`/drive/v3/files/${fileId}?alt=media`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        }
      });

      // Response should be text content for markdown files or Uint8Array for binary
      if (typeof response === 'string' || response instanceof Uint8Array) {
        return response;
      }

      throw new Error('Invalid file content received');

    } catch (error) {
      throw new Error(`Failed to download file: ${(error as Error).message}`);
    }
  }

  async uploadFile(folderId: string, fileName: string, content: string | Uint8Array): Promise<CloudFile> {
    try {
      const accessToken = await this.getValidAccessToken();

      const isBinary = content instanceof Uint8Array;
      const mimeType = isBinary ? 'application/octet-stream' : 'text/markdown';
      let finalFileName = fileName;

      if (!isBinary && !fileName.includes('.')) {
        finalFileName = `${fileName}.md`;
      }

      const metadata = {
        name: finalFileName,
        parents: [folderId],
        mimeType: mimeType
      };

      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      // Cast content to any to avoid "ArrayBufferLike vs ArrayBuffer" TS error
      form.append('file', new Blob([content as any], { type: mimeType }));

      const response = await this.makeApiCall('/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime,size,mimeType', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        body: form
      });

      return {
        id: response.id,
        name: response.name,
        modifiedTime: new Date(response.modifiedTime),
        size: parseInt(response.size) || (typeof content === 'string' ? content.length : content.byteLength),
        mimeType: response.mimeType
      };

    } catch (error) {
      throw new Error(`Failed to upload file: ${(error as Error).message}`);
    }
  }

  async updateFile(fileId: string, content: string | Uint8Array): Promise<CloudFile> {
    try {
      const accessToken = await this.getValidAccessToken();
      const isBinary = content instanceof Uint8Array;
      const mimeType = isBinary ? 'application/octet-stream' : 'text/markdown';

      const response = await this.makeApiCall(`/upload/drive/v3/files/${fileId}?uploadType=media&fields=id,name,modifiedTime,size,mimeType`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': mimeType,
        },
        body: content as BodyInit
      });

      return {
        id: response.id,
        name: response.name,
        modifiedTime: new Date(response.modifiedTime),
        size: parseInt(response.size) || (typeof content === 'string' ? content.length : content.byteLength),
        mimeType: response.mimeType
      };

    } catch (error) {
      throw new Error(`Failed to update file: ${(error as Error).message}`);
    }
  }

  async deleteFile(fileId: string): Promise<void> {
    try {
      const accessToken = await this.getValidAccessToken();

      await this.makeApiCall(`/drive/v3/files/${fileId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        }
      });

    } catch (error) {
      throw new Error(`Failed to delete file: ${(error as Error).message}`);
    }
  }

  /**
   * Refresh the access token using the refresh token
   */
  private async refreshToken(): Promise<boolean> {
    try {
      await this.initializeGapi();
      const authInstance = this.gapiInstance.auth2.getAuthInstance();

      if (!authInstance) {
        return false;
      }

      const user = authInstance.currentUser.get();
      if (!user) {
        return false;
      }

      // Reload auth response to get fresh token
      const authResponse = await (user as any).reloadAuthResponse();

      const result: AuthResult = {
        success: true,
        accessToken: authResponse.access_token,
        expiresAt: new Date(Date.now() + (authResponse.expires_in * 1000))
      };

      // Update stored credentials
      await this.saveCredentials(result, (user as any).getBasicProfile().getEmail());
      return true;

    } catch (error) {
      console.error('Token refresh failed:', error);
      return false;
    }
  }

  /**
   * Make API call to Google Drive API with enhanced error handling
   */
  private async makeApiCall(endpoint: string, options: RequestInit = {}): Promise<any> {
    const baseUrl = 'https://www.googleapis.com';
    const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${endpoint}`;

    const response = await ErrorHandler.withTimeout(
      fetch(url, {
        ...options,
        headers: {
          ...options.headers,
        }
      }),
      30000 // 30 second timeout
    );

    if (!response.ok) {
      const errorText = await response.text();
      const error = new Error(`API call failed: ${response.status} ${response.statusText} - ${errorText}`) as any;
      error.statusCode = response.status;

      // Handle specific Google Drive API errors
      if (response.status === 401) {
        error.code = 'AUTHENTICATION_ERROR';
      } else if (response.status === 403) {
        if (errorText.includes('quota') || errorText.includes('limit')) {
          error.code = 'RATE_LIMIT_ERROR';
        } else {
          error.code = 'PERMISSION_ERROR';
        }
      } else if (response.status === 404) {
        error.code = 'NOT_FOUND_ERROR';
      } else if (response.status === 413) {
        error.code = 'FILE_TOO_LARGE_ERROR';
      }

      throw error;
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    } else if (contentType && contentType.includes('application/octet-stream')) {
      return new Uint8Array(await response.arrayBuffer());
    } else {
      return await response.text();
    }
  }

  /**
   * Get a valid access token, refreshing if necessary
   */
  private async getValidAccessToken(): Promise<string> {
    const credentials = await cloudCredentialManager.getCredentials(this.name);

    if (!credentials) {
      throw new Error('No credentials found. Please authenticate first.');
    }

    // Check if token is expired
    if (credentials.expiresAt && credentials.expiresAt <= new Date()) {
      const refreshed = await this.refreshToken();
      if (!refreshed) {
        throw new Error('Failed to refresh access token. Please re-authenticate.');
      }

      // Get updated credentials
      const updatedCredentials = await cloudCredentialManager.getCredentials(this.name);
      if (!updatedCredentials) {
        throw new Error('Failed to get updated credentials after refresh.');
      }

      return updatedCredentials.accessToken;
    }

    return credentials.accessToken;
  }

  /**
   * Save credentials using the credential manager
   */
  private async saveCredentials(authResult: AuthResult, userId?: string): Promise<void> {
    if (!authResult.success || !authResult.accessToken) {
      return;
    }

    await cloudCredentialManager.saveCredentials({
      provider: this.name,
      accessToken: authResult.accessToken,
      refreshToken: authResult.refreshToken,
      expiresAt: authResult.expiresAt,
      scope: this.scope,
      userId: userId
    });
  }

  /**
   * Find existing EasyEditor application folder
   */
  private async findApplicationFolder(): Promise<string | null> {
    try {
      console.log('[GoogleDriveProvider] Searching for existing Easyeditor folder...');
      const accessToken = await this.getValidAccessToken();

      const response: GoogleDriveResponse = await this.makeApiCall(
        "/drive/v3/files?q=name='Easyeditor' and mimeType='application/vnd.google-apps.folder' and parents in 'root' and trashed=false&fields=files(id,name)",
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          }
        }
      );

      console.log('[GoogleDriveProvider] Search response:', response);

      if (response.files && response.files.length > 0) {
        console.log('[GoogleDriveProvider] Found existing folder:', response.files[0]);
        return response.files[0].id;
      }

      console.log('[GoogleDriveProvider] No existing folder found');
      return null;

    } catch (error) {
      console.error('[GoogleDriveProvider] Error finding application folder:', error);
      return null;
    }
  }
}
