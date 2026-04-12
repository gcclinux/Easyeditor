/**
 * OAuth-enabled Dropbox Provider for Tauri environment
 * Uses the OAuth system for authentication instead of web-based OAuth flow
 * 
 * Requirements:
 * - 2.1: Implement CloudProvider interface
 * - 2.4: Support Tauri environment
 * - 3.1: OAuth 2.0 authentication with PKCE
 * - 3.3: Store tokens securely
 */

import type { CloudProvider, CloudFile, AuthResult } from '../interfaces/CloudProvider';
import { OAuthManager } from '../../services/oauth/core/OAuthManager';
import { getSharedOAuthManager } from '../../services/oauth/tauri/SharedOAuthManager';
import { DropboxOAuthProvider } from '../../services/oauth/providers/DropboxOAuthProvider';
import { DROPBOX_CONFIG, isDropboxConfigured, getConfigurationErrorMessage } from '../config/dropbox-credentials';
import LicenseManager from '../../premium/LicenseManager';

interface DropboxFileMetadata {
  '.tag': 'file' | 'folder';
  name: string;
  id: string;
  client_modified?: string;
  server_modified?: string;
  size?: number;
  path_lower?: string;
  path_display?: string;
}

interface DropboxListFolderResponse {
  entries: DropboxFileMetadata[];
  cursor: string;
  has_more: boolean;
}

const DROPBOX_API_BASE = 'https://api.dropboxapi.com/2';
const DROPBOX_CONTENT_API_BASE = 'https://content.dropboxapi.com/2';
const APPLICATION_FOLDER_NAME = 'Easyeditor';

export class OAuthDropboxProvider implements CloudProvider {
  readonly name = 'dropbox';
  readonly displayName = 'Dropbox';
  readonly icon = '📂';

  private oauthManager: OAuthManager;
  private dropboxProvider: DropboxOAuthProvider;

  constructor() {
    // Validate configuration on initialization
    if (!isDropboxConfigured()) {
      const errorMessage = getConfigurationErrorMessage();
      console.warn('[OAuthDropboxProvider] Configuration warning:', errorMessage);
    }

    // Get shared OAuth manager (reuses existing instance)
    this.oauthManager = getSharedOAuthManager();

    // Create and register Dropbox OAuth provider with credentials
    this.dropboxProvider = new DropboxOAuthProvider({
      clientId: DROPBOX_CONFIG.CLIENT_ID,
      clientSecret: DROPBOX_CONFIG.CLIENT_SECRET,
      scope: DROPBOX_CONFIG.SCOPES,
      authorizationUrl: 'https://www.dropbox.com/oauth2/authorize',
      tokenUrl: 'https://api.dropboxapi.com/oauth2/token',
      enabled: true
    });
    this.oauthManager.registerProvider(this.dropboxProvider);

    console.log('[OAuthDropboxProvider] Initialized with shared OAuth manager');
  }

  /**
   * Authenticate with Dropbox using OAuth manager
   * Requirements: 2.1, 3.1, 3.3
   */
  async authenticate(): Promise<AuthResult> {
    console.log('[OAuthDropboxProvider] Starting OAuth authentication');

    // Check for premium license first
    if (!LicenseManager.hasActiveLicense()) {
      console.warn('[OAuthDropboxProvider] Premium license required for Dropbox integration');
      return {
        success: false,
        error: 'Premium license required. Please upgrade to use Dropbox integration.'
      };
    }

    if (!isDropboxConfigured()) {
      const errorMessage = getConfigurationErrorMessage();
      console.error('[OAuthDropboxProvider] Cannot authenticate - not configured:', errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    }

    try {
      // Use OAuth manager to authenticate
      const oauthResult = await this.oauthManager.authenticate('dropbox');

      if (!oauthResult.success) {
        console.error('[OAuthDropboxProvider] OAuth authentication failed:', oauthResult.errorDescription);
        return {
          success: false,
          error: oauthResult.errorDescription || 'OAuth authentication failed'
        };
      }

      if (!oauthResult.tokens) {
        console.error('[OAuthDropboxProvider] OAuth authentication succeeded but no tokens received');
        return {
          success: false,
          error: 'OAuth authentication succeeded but no tokens received'
        };
      }

      console.log('[OAuthDropboxProvider] OAuth authentication completed successfully');

      return {
        success: true,
        accessToken: oauthResult.tokens.accessToken,
        refreshToken: oauthResult.tokens.refreshToken,
        expiresAt: oauthResult.tokens.expiresAt
      };
    } catch (error) {
      console.error('[OAuthDropboxProvider] Authentication error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed'
      };
    }
  }

  /**
   * Check if user is authenticated with Dropbox using OAuth manager
   * Requirements: 2.1
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      console.log('[OAuthDropboxProvider] Checking authentication status');

      // Use OAuth manager to check authentication
      const isAuth = await this.oauthManager.isAuthenticated('dropbox');
      console.log('[OAuthDropboxProvider] Authentication status:', isAuth);

      return isAuth || false;
    } catch (error) {
      console.error('[OAuthDropboxProvider] Error checking authentication:', error);
      return false;
    }
  }

  /**
   * Disconnect from Dropbox using OAuth manager
   * Requirements: 2.1
   */
  async disconnect(): Promise<void> {
    console.log('[OAuthDropboxProvider] Disconnecting from Dropbox');

    try {
      // Use OAuth manager to logout
      await this.oauthManager.logout('dropbox');

      console.log('[OAuthDropboxProvider] Successfully disconnected');
    } catch (error) {
      console.error('[OAuthDropboxProvider] Error during disconnect:', error);
      throw error;
    }
  }

  /**
   * Create or find the application folder in Dropbox
   * Requirements: 4.1, 4.2, 4.3
   */
  async createApplicationFolder(): Promise<string> {
    console.log('[OAuthDropboxProvider] Creating/finding application folder');

    try {
      // First, try to find existing folder
      const existingFolderId = await this.findApplicationFolder();

      if (existingFolderId) {
        console.log('[OAuthDropboxProvider] Found existing application folder:', existingFolderId);
        return existingFolderId;
      }

      // Create new folder
      const response = await this.makeApiCall(`${DROPBOX_API_BASE}/files/create_folder_v2`, {
        method: 'POST',
        body: JSON.stringify({
          path: `/${APPLICATION_FOLDER_NAME}`,
          autorename: false
        })
      });

      const folderId = response.metadata.path_display;
      console.log('[OAuthDropboxProvider] Created application folder:', folderId);

      return folderId;
    } catch (error: any) {
      // If folder already exists (409 conflict), that's okay
      if (error.status === 409 || error.statusCode === 409) {
        console.log('[OAuthDropboxProvider] Folder already exists, using existing folder');
        return `/${APPLICATION_FOLDER_NAME}`;
      }

      console.error('[OAuthDropboxProvider] Error creating application folder:', error);
      throw error;
    }
  }

  /**
   * List all markdown files in the application folder
   * Requirements: 5.5
   */
  async listFiles(folderId: string): Promise<CloudFile[]> {
    console.log('[OAuthDropboxProvider] Listing files in folder:', folderId);

    try {
      const response: DropboxListFolderResponse = await this.makeApiCall(
        `${DROPBOX_API_BASE}/files/list_folder`,
        {
          method: 'POST',
          body: JSON.stringify({
            path: folderId,
            recursive: false,
            include_deleted: false
          })
        }
      );

      // Filter for markdown and encrypted files
      const files = response.entries
        .filter(entry => entry['.tag'] === 'file' && (entry.name.endsWith('.md') || entry.name.endsWith('.sstp')))
        .map(entry => this.mapDropboxFileToCloudFile(entry));

      console.log('[OAuthDropboxProvider] Found', files.length, 'markdown files');
      return files;
    } catch (error) {
      console.error('[OAuthDropboxProvider] Error listing files:', error);
      throw error;
    }
  }

  /**
   * Download file content from Dropbox
   * Requirements: 5.2
   */
  async downloadFile(fileId: string): Promise<string | Uint8Array> {
    console.log('[OAuthDropboxProvider] Downloading file:', fileId);

    try {
      const accessToken = await this.getValidAccessToken();

      const response = await fetch(`${DROPBOX_CONTENT_API_BASE}/files/download`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Dropbox-API-Arg': JSON.stringify({ path: fileId })
        }
      });

      if (!response.ok) {
        throw new Error(`Download failed: ${response.status} ${response.statusText}`);
      }

      const resultHeader = response.headers.get('Dropbox-API-Result');
      let isBinary = false;
      if (resultHeader) {
        try {
          const metadata = JSON.parse(resultHeader);
          if (metadata.name && metadata.name.endsWith('.sstp')) {
            isBinary = true;
          }
        } catch (e) {
          console.warn('[OAuthDropboxProvider] Failed to parse Dropbox-API-Result header', e);
        }
      }

      if (isBinary) {
        const buffer = await response.arrayBuffer();
        const content = new Uint8Array(buffer);
        console.log('[OAuthDropboxProvider] Downloaded binary file successfully, size:', content.length);
        return content;
      } else {
        const content = await response.text();
        console.log('[OAuthDropboxProvider] Downloaded file successfully, size:', content.length);
        return content;
      }
    } catch (error) {
      console.error('[OAuthDropboxProvider] Error downloading file:', error);
      throw error;
    }
  }

  /**
   * Upload a new file to Dropbox
   * Requirements: 5.1
   */
  async uploadFile(folderId: string, fileName: string, content: string | Uint8Array): Promise<CloudFile> {
    console.log('[OAuthDropboxProvider] Uploading file:', fileName, 'to folder:', folderId);

    try {
      const accessToken = await this.getValidAccessToken();
      const filePath = `${folderId}/${fileName}`;

      const response = await fetch(`${DROPBOX_CONTENT_API_BASE}/files/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/octet-stream',
          'Dropbox-API-Arg': JSON.stringify({
            path: filePath,
            mode: 'add',
            autorename: false,
            mute: false
          })
        },
        body: content as BodyInit
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const metadata: DropboxFileMetadata = await response.json();
      const cloudFile = this.mapDropboxFileToCloudFile(metadata);

      console.log('[OAuthDropboxProvider] Uploaded file successfully:', cloudFile.id);
      return cloudFile;
    } catch (error) {
      console.error('[OAuthDropboxProvider] Error uploading file:', error);
      throw error;
    }
  }

  /**
   * Update an existing file in Dropbox
   * Requirements: 5.3
   */
  async updateFile(fileId: string, content: string | Uint8Array): Promise<CloudFile> {
    console.log('[OAuthDropboxProvider] Updating file:', fileId);

    try {
      const accessToken = await this.getValidAccessToken();

      const response = await fetch(`${DROPBOX_CONTENT_API_BASE}/files/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/octet-stream',
          'Dropbox-API-Arg': JSON.stringify({
            path: fileId,
            mode: 'overwrite',
            autorename: false,
            mute: false
          })
        },
        body: content as BodyInit
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Update failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const metadata: DropboxFileMetadata = await response.json();
      const cloudFile = this.mapDropboxFileToCloudFile(metadata);

      console.log('[OAuthDropboxProvider] Updated file successfully');
      return cloudFile;
    } catch (error) {
      console.error('[OAuthDropboxProvider] Error updating file:', error);
      throw error;
    }
  }

  /**
   * Delete a file from Dropbox
   * Requirements: 5.4
   */
  async deleteFile(fileId: string): Promise<void> {
    console.log('[OAuthDropboxProvider] Deleting file:', fileId);

    try {
      await this.makeApiCall(`${DROPBOX_API_BASE}/files/delete_v2`, {
        method: 'POST',
        body: JSON.stringify({
          path: fileId
        })
      });

      console.log('[OAuthDropboxProvider] Deleted file successfully');
    } catch (error) {
      console.error('[OAuthDropboxProvider] Error deleting file:', error);
      throw error;
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Get a valid access token using OAuth manager
   */
  private async getValidAccessToken(): Promise<string> {
    const tokens = await this.oauthManager.getValidTokens('dropbox');

    if (!tokens) {
      throw new Error('No valid OAuth tokens found. Please authenticate first.');
    }

    return tokens.accessToken;
  }

  /**
   * Find existing application folder
   */
  private async findApplicationFolder(): Promise<string | null> {
    try {
      const response = await this.makeApiCall(`${DROPBOX_API_BASE}/files/get_metadata`, {
        method: 'POST',
        body: JSON.stringify({
          path: `/${APPLICATION_FOLDER_NAME}`
        })
      });

      if (response['.tag'] === 'folder') {
        return response.path_display;
      }

      return null;
    } catch (error: any) {
      // 409 means path not found
      if (error.status === 409 || error.statusCode === 409) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Make an authenticated API call to Dropbox with enhanced error handling
   */
  private async makeApiCall(url: string, options: RequestInit): Promise<any> {
    const accessToken = await this.getValidAccessToken();

    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers
    };

    const response = await fetch(url, {
      ...options,
      headers
    });

    if (!response.ok) {
      const errorText = await response.text();
      const error: any = new Error(this.mapDropboxErrorToMessage(response.status, errorText));
      error.status = response.status;
      error.statusCode = response.status;
      error.response = errorText;

      // Log detailed error information for debugging
      console.error('[OAuthDropboxProvider] API error:', {
        url,
        status: response.status,
        statusText: response.statusText,
        errorText,
        operation: options.method || 'GET'
      });

      throw error;
    }

    return response.json();
  }

  /**
   * Map Dropbox error codes to user-friendly messages
   */
  private mapDropboxErrorToMessage(statusCode: number, errorText: string): string {
    // Parse Dropbox error response if available
    let dropboxError: any = null;
    try {
      dropboxError = JSON.parse(errorText);
    } catch {
      // Not JSON, use raw error text
    }

    switch (statusCode) {
      case 401:
        return 'Your Dropbox session has expired. Please reconnect.';

      case 403:
        return 'EasyEditor doesn\'t have permission to access Dropbox. Please reconnect and grant permissions.';

      case 404:
        return 'The requested file or folder was not found in Dropbox.';

      case 409:
        // Dropbox uses 409 for various conflicts
        if (dropboxError?.error_summary?.includes('not_found')) {
          return 'The requested file or folder was not found in Dropbox.';
        }
        if (dropboxError?.error_summary?.includes('conflict')) {
          return 'A file with this name already exists in Dropbox.';
        }
        return 'A conflict occurred with Dropbox. Please try again.';

      case 413:
        return 'File is too large for Dropbox. Please reduce the file size.';

      case 429:
        return 'Dropbox rate limit reached. Please try again in a few minutes.';

      case 500:
      case 502:
      case 503:
      case 504:
        return 'Dropbox is experiencing issues. Please try again later.';

      default:
        if (statusCode >= 500) {
          return 'Dropbox server error. Please try again later.';
        }
        if (statusCode >= 400) {
          return `Dropbox API error (${statusCode}). Please try again.`;
        }
        return `Dropbox API error: ${statusCode}`;
    }
  }

  /**
   * Map Dropbox file metadata to CloudFile interface
   */
  private mapDropboxFileToCloudFile(metadata: DropboxFileMetadata): CloudFile {
    return {
      id: metadata.path_display || metadata.id,
      name: metadata.name,
      modifiedTime: new Date(metadata.server_modified || metadata.client_modified || Date.now()),
      size: metadata.size || 0,
      mimeType: 'text/markdown'
    };
  }
}
