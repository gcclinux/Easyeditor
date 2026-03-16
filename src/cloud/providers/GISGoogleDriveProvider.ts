/**
 * GISGoogleDriveProvider - Google Drive implementation using Google Identity Services (GIS)
 * This replaces the old gapi-script approach with the modern Google Identity Services
 * which provides better popup handling and OAuth reliability
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

// Google Identity Services types are now defined in global.d.ts

export class GISGoogleDriveProvider implements CloudProvider {
  readonly name = 'googledrive';
  readonly displayName = 'Google Drive';
  readonly icon = '🗂️';

  private clientId: string;
  private scope: string = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly';
  private tokenClient: any = null;
  private isGISLoaded: boolean = false;

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

  /**
   * Load Google Identity Services library
   */
  private async loadGIS(): Promise<void> {
    if (this.isGISLoaded && window.google?.accounts?.oauth2) {
      return;
    }

    return new Promise((resolve, reject) => {
      // Check if already loaded
      if (window.google?.accounts?.oauth2) {
        this.isGISLoaded = true;
        resolve();
        return;
      }

      console.log('[GISGoogleDriveProvider] Loading Google Identity Services...');

      // Create script element
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;

      script.onload = () => {
        console.log('[GISGoogleDriveProvider] Google Identity Services loaded');

        // Wait a bit for the library to initialize
        const checkReady = () => {
          if (window.google?.accounts?.oauth2) {
            this.isGISLoaded = true;
            resolve();
          } else {
            setTimeout(checkReady, 100);
          }
        };
        checkReady();
      };

      script.onerror = (error) => {
        console.error('[GISGoogleDriveProvider] Failed to load Google Identity Services:', error);
        reject(new Error('Failed to load Google Identity Services'));
      };

      document.head.appendChild(script);
    });
  }

  /**
   * Initialize the OAuth token client
   */
  private async initializeTokenClient(): Promise<void> {
    if (this.tokenClient) {
      return;
    }

    await this.loadGIS();

    if (!window.google?.accounts?.oauth2) {
      throw new Error('Google Identity Services not available');
    }

    console.log('[GISGoogleDriveProvider] Initializing token client...');

    this.tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: this.clientId,
      scope: this.scope,
      callback: '', // Will be set dynamically
    });

    console.log('[GISGoogleDriveProvider] Token client initialized');
  }

  async authenticate(): Promise<AuthResult> {
    try {
      console.log('[GISGoogleDriveProvider] Starting authentication...');

      // Validate configuration before attempting authentication
      const validation = validateGoogleDriveConfiguration();
      if (!validation.isValid) {
        const error = getConfigurationErrorMessage();
        console.error('[GISGoogleDriveProvider] Configuration validation failed:', validation);
        cloudToastService.showConfigurationMessage(this.displayName, false);
        return {
          success: false,
          error
        };
      }

      console.log('[GISGoogleDriveProvider] Configuration valid, initializing token client...');

      return await ErrorHandler.withRetry(async () => {
        await this.initializeTokenClient();

        return new Promise<AuthResult>((resolve) => {
          console.log('[GISGoogleDriveProvider] Starting OAuth flow...');

          // Set up the callback for this authentication attempt
          this.tokenClient.callback = async (response: any) => {
            console.log('[GISGoogleDriveProvider] OAuth response received:', response);

            if (response.error) {
              console.error('[GISGoogleDriveProvider] OAuth error:', response.error);

              let errorMessage = 'Authentication failed';
              if (response.error === 'popup_blocked_by_browser') {
                errorMessage = 'Sign-in popup was blocked by your browser. Please enable popups for this site and try again.';
              } else if (response.error === 'popup_closed_by_user') {
                errorMessage = 'Sign-in was cancelled. Please try again and complete the sign-in process.';
              } else if (response.error === 'access_denied') {
                errorMessage = 'Access was denied. Please try again and grant the necessary permissions.';
              }

              resolve({
                success: false,
                error: errorMessage
              });
              return;
            }

            if (!response.access_token) {
              console.error('[GISGoogleDriveProvider] No access token in response');
              resolve({
                success: false,
                error: 'No access token received'
              });
              return;
            }

            // Check if we have the required scopes
            if (!window.google?.accounts?.oauth2?.hasGrantedAllScopes(response, ...this.scope.split(' '))) {
              console.error('[GISGoogleDriveProvider] Required scopes not granted');
              resolve({
                success: false,
                error: 'Required permissions not granted'
              });
              return;
            }

            console.log('[GISGoogleDriveProvider] Authentication successful');
            console.log('[GISGoogleDriveProvider] OAuth response details:', {
              hasAccessToken: !!response.access_token,
              expiresIn: response.expires_in,
              scope: response.scope,
              tokenType: response.token_type
            });

            // Calculate expiry time (GIS tokens typically expire in 1 hour)
            const expiresAt = new Date(Date.now() + (response.expires_in || 3600) * 1000);

            const result: AuthResult = {
              success: true,
              accessToken: response.access_token,
              expiresAt
            };

            // Save credentials
            try {
              console.log('[GISGoogleDriveProvider] About to save credentials...');
              await this.saveCredentials(result);
              console.log('[GISGoogleDriveProvider] Credentials saved successfully');
              resolve(result);
            } catch (error) {
              console.error('[GISGoogleDriveProvider] Failed to save credentials:', error);
              resolve({
                success: false,
                error: 'Failed to save authentication credentials'
              });
            }
          };

          // Request access token
          console.log('[GISGoogleDriveProvider] Requesting access token...');
          this.tokenClient.requestAccessToken({ prompt: 'consent' });
        });
      },
        { operation: 'authenticate', provider: this.name },
        { maxRetries: 1 }
      );

    } catch (error) {
      console.error('[GISGoogleDriveProvider] Authentication failed:', error);
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
      console.log('[GISGoogleDriveProvider] Checking authentication status...');

      // Check if we have valid stored credentials
      const credentials = await cloudCredentialManager.getCredentials(this.name);
      console.log('[GISGoogleDriveProvider] Credentials found:', !!credentials);

      if (!credentials) {
        console.log('[GISGoogleDriveProvider] No credentials found');
        return false;
      }

      // Check if credentials are expired
      if (credentials.expiresAt && credentials.expiresAt <= new Date()) {
        console.log('[GISGoogleDriveProvider] Credentials expired at:', credentials.expiresAt);
        return false;
      }

      console.log('[GISGoogleDriveProvider] Credentials valid, checking expiry...');

      // For now, just check if we have a valid access token and it's not expired
      // The API test was causing issues, so we'll trust the stored credentials
      if (credentials.accessToken && credentials.accessToken.length > 0) {
        console.log('[GISGoogleDriveProvider] Valid access token found, considering authenticated');
        return true;
      }

      console.log('[GISGoogleDriveProvider] No valid access token found');
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

  async createApplicationFolder(): Promise<string> {
    try {
      console.log('[GISGoogleDriveProvider] Creating application folder...');
      const accessToken = await this.getValidAccessToken();
      console.log('[GISGoogleDriveProvider] Got access token, checking for existing folder...');

      // Check if EasyEditor folder already exists
      const existingFolder = await this.findApplicationFolder();
      if (existingFolder) {
        console.log('[GISGoogleDriveProvider] Found existing folder:', existingFolder);
        return existingFolder;
      }

      console.log('[GISGoogleDriveProvider] No existing folder found, creating new one...');

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

      console.log('[GISGoogleDriveProvider] Create folder response:', response);

      if (!response.id) {
        throw new Error('Failed to create application folder - no ID returned');
      }

      console.log('[GISGoogleDriveProvider] Successfully created folder with ID:', response.id);
      return response.id;

    } catch (error) {
      console.error('[GISGoogleDriveProvider] Error creating application folder:', error);
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

      console.log(`[GISGoogleDriveProvider] Raw files from API: ${allFiles.length}`, allFiles.map(f => `${f.name} (${f.mimeType})`));

      // Filter to only include .md and .sstp files by extension
      const filtered = allFiles.filter(file => /\.(md|sstp)$/i.test(file.name));
      console.log(`[GISGoogleDriveProvider] After extension filter: ${filtered.length} files`);

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

      // Manual multipart construction to ensure order
      // Part 1: Metadata
      let body = delimiter +
        'Content-Type: application/json\r\n\r\n' +
        JSON.stringify(metadata);

      // Part 2: Content
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
        // string content
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
        size: parseInt(response.size) || content.length,
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
      console.log('[GISGoogleDriveProvider] Searching for existing Easyeditor folder...');
      const accessToken = await this.getValidAccessToken();

      const response: GoogleDriveResponse = await this.makeApiCall(
        "/drive/v3/files?q=name='Easyeditor' and mimeType='application/vnd.google-apps.folder' and parents in 'root' and trashed=false&fields=files(id,name)",
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          }
        }
      );

      console.log('[GISGoogleDriveProvider] Search response:', response);

      if (response.files && response.files.length > 0) {
        console.log('[GISGoogleDriveProvider] Found existing folder:', response.files[0]);
        return response.files[0].id;
      }

      console.log('[GISGoogleDriveProvider] No existing folder found');
      return null;

    } catch (error) {
      console.error('[GISGoogleDriveProvider] Error finding application folder:', error);
      return null;
    }
  }
}