/**
 * OAuth-enabled Google Drive Provider
 * Uses the OAuth system for authentication instead of GAPI
 */

import type { CloudProvider, CloudFile, AuthResult } from '../interfaces';
import { OAuthManager } from '../../services/oauth/core/OAuthManager';
import { getSharedOAuthManager } from '../../services/oauth/tauri/SharedOAuthManager';
import { GoogleOAuthProvider } from '../../services/oauth/providers/GoogleOAuthProvider';
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

export class OAuthGoogleDriveProvider implements CloudProvider {
  readonly name = 'googledrive';
  readonly displayName = 'Google Drive';
  readonly icon = '🗂️';

  private oauthManager: OAuthManager;
  private googleProvider: GoogleOAuthProvider;

  constructor() {
    // Validate configuration on initialization
    validateConfiguration();

    if (!isGoogleDriveConfigured()) {
      console.warn('Google Drive integration not configured. Users will see a helpful error message.');

      const isDevelopment = (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') ||
        (typeof window !== 'undefined' && (window as any).import?.meta?.env?.MODE === 'development');
      if (isDevelopment) {
        const validation = validateGoogleDriveConfiguration(true);
        console.warn('Configuration validation:', validation);
      }
    }

    // Get shared OAuth manager (creates it if first provider)
    this.oauthManager = getSharedOAuthManager();

    // Create and register Google OAuth provider
    // Pass client secret - Google requires it even for Desktop apps with PKCE (deviation from RFC 7636)
    this.googleProvider = new GoogleOAuthProvider(GOOGLE_DRIVE_CONFIG.CLIENT_ID, GOOGLE_DRIVE_CONFIG.CLIENT_SECRET);
    this.oauthManager.registerProvider(this.googleProvider);

    console.log('[OAuthGoogleDriveProvider] Initialized with shared OAuth manager');
  }

  async authenticate(): Promise<AuthResult> {
    try {
      console.log('[OAuthGoogleDriveProvider] Starting OAuth authentication...');

      // Validate configuration before attempting authentication
      const validation = validateGoogleDriveConfiguration();
      if (!validation.isValid) {
        const error = getConfigurationErrorMessage();
        console.error('[OAuthGoogleDriveProvider] Configuration validation failed:', validation);
        cloudToastService.showConfigurationMessage(this.displayName, false);
        return {
          success: false,
          error
        };
      }

      console.log('[OAuthGoogleDriveProvider] Configuration valid, starting OAuth flow...');

      return await ErrorHandler.withRetry(async () => {
        // Use OAuth manager to authenticate
        const oauthResult = await this.oauthManager.authenticate('google');

        if (!oauthResult.success) {
          throw ErrorHandler.enhanceError(
            new Error(oauthResult.errorDescription || 'OAuth authentication failed'),
            { operation: 'authenticate', provider: this.name }
          );
        }

        if (!oauthResult.tokens) {
          throw ErrorHandler.enhanceError(
            new Error('OAuth authentication succeeded but no tokens received'),
            { operation: 'authenticate', provider: this.name }
          );
        }

        console.log('[OAuthGoogleDriveProvider] OAuth authentication completed successfully');

        return {
          success: true,
          accessToken: oauthResult.tokens.accessToken,
          refreshToken: oauthResult.tokens.refreshToken,
          expiresAt: oauthResult.tokens.expiresAt
        };
      },
        { operation: 'authenticate', provider: this.name },
        { maxRetries: 1 } // Limited retries for authentication
      );

    } catch (error) {
      console.error('[OAuthGoogleDriveProvider] Authentication failed:', error);
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
      console.log('[OAuthGoogleDriveProvider] Checking authentication status...');

      // Use OAuth manager to check authentication
      const isAuth = await this.oauthManager.isAuthenticated('google');
      console.log('[OAuthGoogleDriveProvider] Authentication status:', isAuth);

      return isAuth;

    } catch (error) {
      console.error('Error checking authentication status:', error);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    try {
      console.log('[OAuthGoogleDriveProvider] Disconnecting...');

      // Use OAuth manager to logout
      await this.oauthManager.logout('google');

      console.log('[OAuthGoogleDriveProvider] Successfully disconnected');

    } catch (error) {
      console.error('Error during disconnect:', error);
      throw error;
    }
  }

  async createApplicationFolder(): Promise<string> {
    try {
      console.log('[OAuthGoogleDriveProvider] Creating application folder...');
      const accessToken = await this.getValidAccessToken();
      console.log('[OAuthGoogleDriveProvider] Got access token, checking for existing folder...');

      // Check if EasyEditor folder already exists
      const existingFolder = await this.findApplicationFolder();
      if (existingFolder) {
        console.log('[OAuthGoogleDriveProvider] Found existing folder:', existingFolder);
        return existingFolder;
      }

      console.log('[OAuthGoogleDriveProvider] No existing folder found, creating new one...');

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

      console.log('[OAuthGoogleDriveProvider] Create folder response:', response);

      if (!response.id) {
        throw new Error('Failed to create application folder - no ID returned');
      }

      console.log('[OAuthGoogleDriveProvider] Successfully created folder with ID:', response.id);
      return response.id;

    } catch (error) {
      console.error('[OAuthGoogleDriveProvider] Error creating application folder:', error);
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

      console.log(`[OAuthGoogleDriveProvider] Raw files from API: ${allFiles.length}`, allFiles.map(f => `${f.name} (${f.mimeType})`));

      // Filter to only include .md and .sstp files by extension
      const filtered = allFiles.filter(file => /\.(md|sstp)$/i.test(file.name));
      console.log(`[OAuthGoogleDriveProvider] After extension filter: ${filtered.length} files`);

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
        // For binary content, we need a different approach because we can't just append Uint8Array to string
        // We'll use Blob to combine parts
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
   * Get a valid access token using OAuth manager
   */
  private async getValidAccessToken(): Promise<string> {
    const tokens = await this.oauthManager.getValidTokens('google');

    if (!tokens) {
      throw new Error('No valid OAuth tokens found. Please authenticate first.');
    }

    return tokens.accessToken;
  }

  /**
   * Find existing EasyEditor application folder
   */
  private async findApplicationFolder(): Promise<string | null> {
    try {
      console.log('[OAuthGoogleDriveProvider] Searching for existing Easyeditor folder...');
      const accessToken = await this.getValidAccessToken();

      const response: GoogleDriveResponse = await this.makeApiCall(
        "/drive/v3/files?q=name='Easyeditor' and mimeType='application/vnd.google-apps.folder' and parents in 'root' and trashed=false&fields=files(id,name)",
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          }
        }
      );

      console.log('[OAuthGoogleDriveProvider] Search response:', response);

      if (response.files && response.files.length > 0) {
        console.log('[OAuthGoogleDriveProvider] Found existing folder:', response.files[0]);
        return response.files[0].id;
      }

      console.log('[OAuthGoogleDriveProvider] No existing folder found');
      return null;

    } catch (error) {
      console.error('[OAuthGoogleDriveProvider] Error finding application folder:', error);
      return null;
    }
  }
}