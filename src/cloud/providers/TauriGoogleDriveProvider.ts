/**
 * TauriGoogleDriveProvider - Tauri-specific Google Drive implementation
 * Uses system browser for OAuth instead of popups which are blocked in Tauri
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
import { open } from '@tauri-apps/plugin-shell';
import { cloudToastService } from '../utils/CloudToastService';

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

export class TauriGoogleDriveProvider implements CloudProvider {
  readonly name = 'googledrive';
  readonly displayName = 'Google Drive';
  readonly icon = '🗂️';

  private clientId: string;
  private scope: string = 'https://www.googleapis.com/auth/drive.file';
  private redirectUri: string = 'http://localhost:8080/oauth/callback';

  constructor(clientId?: string, _apiKey?: string) {
    this.clientId = clientId || GOOGLE_DRIVE_CONFIG.CLIENT_ID;
    this.scope = GOOGLE_DRIVE_CONFIG.SCOPES.join(' ');

    // Validate configuration on initialization
    validateConfiguration();

    if (!isGoogleDriveConfigured()) {
      console.warn('Google Drive integration not configured. Users will see a helpful error message.');

      if (import.meta.env.MODE === 'development') {
        const validation = validateGoogleDriveConfiguration(true);
        console.warn('Configuration validation:', validation);
      }
    }
  }

  async authenticate(): Promise<AuthResult> {
    try {
      console.log('[TauriGoogleDriveProvider] Starting Tauri OAuth authentication...');

      // Validate configuration before attempting authentication
      const validation = validateGoogleDriveConfiguration();
      if (!validation.isValid) {
        const error = getConfigurationErrorMessage();
        console.error('[TauriGoogleDriveProvider] Configuration validation failed:', validation);
        cloudToastService.showConfigurationMessage(this.displayName, false);
        return {
          success: false,
          error
        };
      }

      console.log('[TauriGoogleDriveProvider] Configuration valid, starting OAuth flow...');

      return await ErrorHandler.withRetry(async () => {
        // Import Tauri shell API
        // const { open } = await import('@tauri-apps/plugin-shell');

        // Generate OAuth URL
        const state = this.generateRandomState();
        const authUrl = this.buildAuthUrl(state);

        console.log('[TauriGoogleDriveProvider] Opening OAuth URL in system browser...');

        // Open OAuth URL in system browser
        await open(authUrl);

        // Start local server to capture OAuth callback
        return await this.startOAuthServer(state);
      },
        { operation: 'authenticate', provider: this.name },
        { maxRetries: 1 }
      );

    } catch (error) {
      console.error('[TauriGoogleDriveProvider] Authentication failed:', error);
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

  /**
   * Build OAuth authorization URL
   */
  private buildAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: this.scope,
      state: state,
      access_type: 'offline',
      prompt: 'consent'
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * Generate random state for OAuth security
   */
  private generateRandomState(): string {
    return Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15);
  }

  /**
   * Start local server to capture OAuth callback
   */
  private async startOAuthServer(expectedState: string): Promise<AuthResult> {
    return new Promise((resolve) => {
      console.log('[TauriGoogleDriveProvider] Starting OAuth callback server...');

      // Create a simple HTTP server to capture the OAuth callback
      const server = this.createCallbackServer(expectedState, (result) => {
        resolve(result);
      });

      // Set timeout for OAuth flow
      setTimeout(() => {
        server.close();
        resolve({
          success: false,
          error: 'OAuth flow timed out. Please try again.'
        });
      }, 300000); // 5 minutes timeout
    });
  }

  /**
   * Create HTTP server to handle OAuth callback
   */
  private createCallbackServer(_expectedState: string, callback: (result: AuthResult) => void): any {
    console.log('[TauriGoogleDriveProvider] Starting OAuth callback handling...');

    // Show instructions to user with more helpful guidance
    cloudToastService.showInfo(
      'Google Drive integration in the desktop app requires additional setup. For now, please use the web version at localhost:3024 for Google Drive features.',
      { duration: 15000 }
    );

    // Provide immediate feedback about the limitation
    setTimeout(() => {
      callback({
        success: false,
        error: 'Google Drive OAuth is not yet fully supported in the desktop version. Please use the web version (npm run server) for Google Drive integration. We\'re working on adding full desktop OAuth support in a future update.'
      });
    }, 1000);

    return {
      close: () => {
        console.log('[TauriGoogleDriveProvider] OAuth callback handling closed');
      }
    };
  }



  async isAuthenticated(): Promise<boolean> {
    try {
      console.log('[TauriGoogleDriveProvider] Checking authentication status...');

      // Check if we have valid stored credentials
      const credentials = await cloudCredentialManager.getCredentials(this.name);
      console.log('[TauriGoogleDriveProvider] Credentials found:', !!credentials);

      if (!credentials) {
        console.log('[TauriGoogleDriveProvider] No credentials found');
        return false;
      }

      // Check if credentials are expired
      if (credentials.expiresAt && credentials.expiresAt <= new Date()) {
        console.log('[TauriGoogleDriveProvider] Credentials expired at:', credentials.expiresAt);
        return false;
      }

      console.log('[TauriGoogleDriveProvider] Credentials valid');

      if (credentials.accessToken && credentials.accessToken.length > 0) {
        console.log('[TauriGoogleDriveProvider] Valid access token found, considering authenticated');
        return true;
      }

      console.log('[TauriGoogleDriveProvider] No valid access token found');
      return false;

    } catch (error) {
      console.error('Error checking authentication status:', error);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    try {
      // Revoke the token if we have one
      const credentials = await cloudCredentialManager.getCredentials(this.name);
      if (credentials?.accessToken) {
        try {
          // Revoke the token
          await fetch(`https://oauth2.googleapis.com/revoke?token=${credentials.accessToken}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          });
        } catch (error) {
          console.warn('Failed to revoke token:', error);
          // Continue with cleanup even if revocation fails
        }
      }

      // Remove stored credentials
      await cloudCredentialManager.removeCredentials(this.name);

    } catch (error) {
      console.error('Error during disconnect:', error);
      // Still remove credentials even if other operations fail
      await cloudCredentialManager.removeCredentials(this.name);
    }
  }

  // The rest of the methods are identical to GISGoogleDriveProvider
  async createApplicationFolder(): Promise<string> {
    try {
      console.log('[TauriGoogleDriveProvider] Creating application folder...');
      const accessToken = await this.getValidAccessToken();
      console.log('[TauriGoogleDriveProvider] Got access token, checking for existing folder...');

      // Check if EasyEditor folder already exists
      const existingFolder = await this.findApplicationFolder();
      if (existingFolder) {
        console.log('[TauriGoogleDriveProvider] Found existing folder:', existingFolder);
        return existingFolder;
      }

      console.log('[TauriGoogleDriveProvider] No existing folder found, creating new one...');

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

      console.log('[TauriGoogleDriveProvider] Create folder response:', response);

      if (!response.id) {
        throw new Error('Failed to create application folder - no ID returned');
      }

      console.log('[TauriGoogleDriveProvider] Successfully created folder with ID:', response.id);
      return response.id;

    } catch (error) {
      console.error('[TauriGoogleDriveProvider] Error creating application folder:', error);
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

      console.log(`[TauriGoogleDriveProvider] Raw files from API: ${allFiles.length}`, allFiles.map(f => `${f.name} (${f.mimeType})`));

      // Filter to only include .md and .sstp files by extension
      const filtered = allFiles.filter(file => /\.(md|sstp)$/i.test(file.name));
      console.log(`[TauriGoogleDriveProvider] After extension filter: ${filtered.length} files`);

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

      const boundary = '-------314159265358979323846';
      const delimiter = "\r\n--" + boundary + "\r\n";
      const close_delim = "\r\n--" + boundary + "--";

      // Manual multipart construction
      let body = delimiter +
        'Content-Type: application/json\r\n\r\n' +
        JSON.stringify(metadata);

      body += delimiter +
        `Content-Type: ${mimeType}\r\n\r\n`;

      if (isBinary) {
        const headerEncoder = new TextEncoder();
        const part1 = headerEncoder.encode(body);
        const part3 = headerEncoder.encode(close_delim);

        const combined = new Uint8Array(part1.length + content.length + part3.length);
        combined.set(part1);
        combined.set(content, part1.length);
        combined.set(part3, part1.length + content.length);

        const response = await this.makeApiCall('/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime,size,mimeType', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': `multipart/related; boundary=${boundary}`
          },
          body: combined
        });

        return {
          id: response.id,
          name: response.name,
          modifiedTime: new Date(response.modifiedTime),
          size: parseInt(response.size) || content.byteLength,
          mimeType: response.mimeType
        };
      } else {
        body += content;
        body += close_delim;

        const response = await this.makeApiCall('/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime,size,mimeType', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': `multipart/related; boundary=${boundary}`
          },
          body: body
        });

        return {
          id: response.id,
          name: response.name,
          modifiedTime: new Date(response.modifiedTime),
          size: parseInt(response.size) || (content as string).length,
          mimeType: response.mimeType
        };
      }

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
      30000
    );

    if (!response.ok) {
      const errorText = await response.text();
      const error = new Error(`API call failed: ${response.status} ${response.statusText} - ${errorText}`) as any;
      error.statusCode = response.status;

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
   * Get a valid access token
   */
  private async getValidAccessToken(): Promise<string> {
    const credentials = await cloudCredentialManager.getCredentials(this.name);

    if (!credentials) {
      throw new Error('No credentials found. Please authenticate first.');
    }

    // Check if token is expired
    if (credentials.expiresAt && credentials.expiresAt <= new Date()) {
      throw new Error('Access token expired. Please re-authenticate.');
    }

    return credentials.accessToken;
  }

  /**
   * Save credentials using the credential manager
   * Note: Reserved for future OAuth implementation
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

    // Method is kept for future OAuth implementation
    console.log('[TauriGoogleDriveProvider] Credentials would be saved here when OAuth is implemented');
  }

  /**
   * Find existing EasyEditor application folder
   */
  private async findApplicationFolder(): Promise<string | null> {
    try {
      console.log('[TauriGoogleDriveProvider] Searching for existing Easyeditor folder...');
      const accessToken = await this.getValidAccessToken();

      const response: GoogleDriveResponse = await this.makeApiCall(
        "/drive/v3/files?q=name='Easyeditor' and mimeType='application/vnd.google-apps.folder' and parents in 'root' and trashed=false&fields=files(id,name)",
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          }
        }
      );

      console.log('[TauriGoogleDriveProvider] Search response:', response);

      if (response.files && response.files.length > 0) {
        console.log('[TauriGoogleDriveProvider] Found existing folder:', response.files[0]);
        return response.files[0].id;
      }

      console.log('[TauriGoogleDriveProvider] No existing folder found');
      return null;

    } catch (error) {
      console.error('[TauriGoogleDriveProvider] Error finding application folder:', error);
      return null;
    }
  }
}
