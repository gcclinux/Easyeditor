/**
 * OAuth-enabled Box Provider for Tauri environment
 * Uses the OAuth system for authentication instead of web-based OAuth flow
 * 
 * Requirements:
 * - 2.1: Implement CloudProvider interface
 * - 2.2: Support Tauri environment with native OAuth
 * - 3.1: OAuth 2.0 authentication with PKCE
 * - 3.3: Store tokens securely
 */

import type { CloudProvider, CloudFile, AuthResult } from '../interfaces/CloudProvider';
import { OAuthManager } from '../../services/oauth/core/OAuthManager';
import { getSharedOAuthManager } from '../../services/oauth/tauri/SharedOAuthManager';
import { BoxOAuthProvider } from '../../services/oauth/providers/BoxOAuthProvider';
import { BOX_CONFIG, isBoxConfigured, getConfigurationErrorMessage } from '../config/box-credentials';
import LicenseManager from '../../premium/LicenseManager';
import { createLogger } from '../../utils/logger';

const logger = createLogger('OAuthBoxProvider');

interface BoxItemMetadata {
  type: 'file' | 'folder';
  id: string;
  name: string;
  modified_at?: string;
  size?: number;
  parent?: { id: string; name: string };
  sequence_id?: string;
  etag?: string;
}

interface BoxListItemsResponse {
  total_count: number;
  entries: BoxItemMetadata[];
  offset: number;
  limit: number;
}

const BOX_API_BASE = 'https://api.box.com/2.0';
const BOX_UPLOAD_BASE = 'https://upload.box.com/api/2.0';
const APPLICATION_FOLDER_NAME = 'Easyeditor';

export class OAuthBoxProvider implements CloudProvider {
  readonly name = 'box';
  readonly displayName = 'Box';
  readonly icon = '📦';

  private oauthManager: OAuthManager;
  private boxProvider: BoxOAuthProvider;
  private applicationFolderId: string | null = null;

  constructor() {
    if (!isBoxConfigured()) {
      const errorMessage = getConfigurationErrorMessage();
      logger.warn('Configuration warning:', errorMessage);
    }

    // Get shared OAuth manager (reuses existing instance)
    this.oauthManager = getSharedOAuthManager();

    // Create and register Box OAuth provider with credentials
    this.boxProvider = new BoxOAuthProvider({
      clientId: BOX_CONFIG.CLIENT_ID,
      clientSecret: BOX_CONFIG.CLIENT_SECRET,
      scope: BOX_CONFIG.SCOPES,
      authorizationUrl: 'https://account.box.com/api/oauth2/authorize',
      tokenUrl: 'https://api.box.com/oauth2/token',
      enabled: true
    });
    this.oauthManager.registerProvider(this.boxProvider);

    logger.log('Initialized with shared OAuth manager');
  }

  /**
   * Authenticate with Box using OAuth manager
   */
  async authenticate(): Promise<AuthResult> {
    logger.log('Starting OAuth authentication');

    // Check for premium license first
    if (!LicenseManager.hasActiveLicense()) {
      logger.warn('Premium license required for Box integration');
      return {
        success: false,
        error: 'Premium license required. Please upgrade to use Box integration.'
      };
    }

    if (!isBoxConfigured()) {
      const errorMessage = getConfigurationErrorMessage();
      logger.error('Cannot authenticate - not configured:', errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    }

    try {
      // Use OAuth manager to authenticate
      const oauthResult = await this.oauthManager.authenticate('box');

      if (!oauthResult.success) {
        logger.error('OAuth authentication failed:', oauthResult.errorDescription);
        return {
          success: false,
          error: oauthResult.errorDescription || 'OAuth authentication failed'
        };
      }

      if (!oauthResult.tokens) {
        logger.error('OAuth authentication succeeded but no tokens received');
        return {
          success: false,
          error: 'OAuth authentication succeeded but no tokens received'
        };
      }

      logger.log('OAuth authentication completed successfully');

      return {
        success: true,
        accessToken: oauthResult.tokens.accessToken,
        refreshToken: oauthResult.tokens.refreshToken,
        expiresAt: oauthResult.tokens.expiresAt
      };
    } catch (error) {
      logger.error('Authentication error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed'
      };
    }
  }

  /**
   * Check if user is authenticated with Box using OAuth manager
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      logger.log('Checking authentication status');

      const isAuth = await this.oauthManager.isAuthenticated('box');
      logger.log('Authentication status:', isAuth);

      return isAuth || false;
    } catch (error) {
      logger.error('Error checking authentication:', error);
      return false;
    }
  }

  /**
   * Disconnect from Box using OAuth manager
   */
  async disconnect(): Promise<void> {
    logger.log('Disconnecting from Box');

    try {
      // Use OAuth manager to logout
      await this.oauthManager.logout('box');

      // Reset internal state
      this.applicationFolderId = null;

      logger.log('Successfully disconnected');
    } catch (error) {
      logger.error('Error during disconnect:', error);
      // Always reset local state even if logout fails
      this.applicationFolderId = null;
      throw error;
    }
  }

  /**
   * Create or find the application folder in Box
   */
  async createApplicationFolder(): Promise<string> {
    logger.log('Creating/finding application folder');

    // Return cached folder ID if available
    if (this.applicationFolderId) {
      return this.applicationFolderId;
    }

    try {
      // First, try to find existing folder in root (folder ID "0")
      const existingFolderId = await this.findApplicationFolder();

      if (existingFolderId) {
        logger.log('Found existing application folder:', existingFolderId);
        this.applicationFolderId = existingFolderId;
        return existingFolderId;
      }

      // Create new folder in root
      const accessToken = await this.getValidAccessToken();

      const response = await fetch(`${BOX_API_BASE}/folders`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: APPLICATION_FOLDER_NAME,
          parent: { id: '0' }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 409) {
          // Folder already exists (conflict), try to find it again
          logger.log('Folder already exists, searching again');
          const folderId = await this.findApplicationFolder();
          if (folderId) {
            this.applicationFolderId = folderId;
            return folderId;
          }
        }
        throw new Error(`Failed to create folder: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      this.applicationFolderId = data.id;
      logger.log('Created application folder:', this.applicationFolderId);

      return this.applicationFolderId!;
    } catch (error) {
      logger.error('Error creating application folder:', error);
      throw error;
    }
  }

  /**
   * List files in a Box folder
   */
  async listFiles(folderId: string): Promise<CloudFile[]> {
    logger.log('Listing files in folder:', folderId);

    try {
      const response = await this.makeApiCall(
        `${BOX_API_BASE}/folders/${folderId}/items?fields=id,type,name,modified_at,size`,
        { method: 'GET' }
      );

      const data: BoxListItemsResponse = response;

      const files = data.entries
        .filter(entry => entry.type === 'file')
        .map(entry => this.mapBoxFileToCloudFile(entry));

      logger.log('Found', files.length, 'files');
      return files;
    } catch (error) {
      logger.error('Error listing files:', error);
      throw error;
    }
  }

  /**
   * Download file content from Box
   */
  async downloadFile(fileId: string): Promise<string | Uint8Array> {
    logger.log('Downloading file:', fileId);

    try {
      const accessToken = await this.getValidAccessToken();

      // Fetch file metadata first to get the filename for extension-based type detection
      // (Box returns application/octet-stream for all files regardless of content type)
      let fileName = '';
      try {
        const metaResponse = await fetch(`${BOX_API_BASE}/files/${fileId}?fields=name`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (metaResponse.ok) {
          const meta = await metaResponse.json();
          fileName = meta.name || '';
        }
      } catch {
        // Non-fatal — fall back to text
      }

      const isBinary = fileName.endsWith('.sstp');

      const response = await fetch(`${BOX_API_BASE}/files/${fileId}/content`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error(`Download failed: ${response.status} ${response.statusText}`);
      }

      // Use filename extension to determine if binary (same approach as DropboxProvider)
      // Box always returns application/octet-stream so Content-Type is not reliable
      if (isBinary) {
        const buffer = await response.arrayBuffer();
        const content = new Uint8Array(buffer);
        logger.log('Downloaded binary file successfully, size:', content.length);
        return content;
      }

      const content = await response.text();
      logger.log('Downloaded file successfully, size:', content.length);
      return content;
    } catch (error) {
      logger.error('Error downloading file:', error);
      throw error;
    }
  }

  /**
   * Upload a new file to Box
   */
  async uploadFile(folderId: string, fileName: string, content: string | Uint8Array): Promise<CloudFile> {
    logger.log('Uploading file:', fileName, 'to folder:', folderId);

    try {
      const accessToken = await this.getValidAccessToken();

      // Box uses multipart form data for uploads with a separate upload endpoint
      const attributes = JSON.stringify({
        name: fileName,
        parent: { id: folderId }
      });

      const formData = new FormData();
      formData.append('attributes', attributes);

      // Create blob from content
      const blob = content instanceof Uint8Array
        ? new Blob([content], { type: 'application/octet-stream' })
        : new Blob([content], { type: 'text/plain' });
      formData.append('file', blob, fileName);

      const response = await fetch(`${BOX_UPLOAD_BASE}/files/content`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        body: formData
      });

      if (!response.ok) {
        if (response.status === 409) {
          // File with same name exists — update the existing file instead
          const errorData = await response.json();
          const conflictFileId = errorData?.context_info?.conflicts?.id;
          if (conflictFileId) {
            logger.log('File already exists, updating existing file:', conflictFileId);
            return await this.updateFile(conflictFileId, content);
          }
        }
        const errorText = await response.text();
        throw new Error(`Upload failed: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      const uploadedFile = data.entries[0];
      const cloudFile = this.mapBoxFileToCloudFile(uploadedFile);

      logger.log('Uploaded file successfully:', cloudFile.id);
      return cloudFile;
    } catch (error) {
      logger.error('Error uploading file:', error);
      throw error;
    }
  }

  /**
   * Update an existing file in Box (upload new version)
   */
  async updateFile(fileId: string, content: string | Uint8Array): Promise<CloudFile> {
    logger.log('Updating file:', fileId);

    try {
      const accessToken = await this.getValidAccessToken();

      // Box uses multipart form data for version uploads
      const formData = new FormData();

      const blob = content instanceof Uint8Array
        ? new Blob([content], { type: 'application/octet-stream' })
        : new Blob([content], { type: 'text/plain' });
      formData.append('file', blob, 'file');

      const response = await fetch(`${BOX_UPLOAD_BASE}/files/${fileId}/content`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Update failed: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      const updatedFile = data.entries[0];
      const cloudFile = this.mapBoxFileToCloudFile(updatedFile);

      logger.log('Updated file successfully');
      return cloudFile;
    } catch (error) {
      logger.error('Error updating file:', error);
      throw error;
    }
  }

  /**
   * Delete a file from Box
   */
  async deleteFile(fileId: string): Promise<void> {
    logger.log('Deleting file:', fileId);

    try {
      const accessToken = await this.getValidAccessToken();

      const response = await fetch(`${BOX_API_BASE}/files/${fileId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok && response.status !== 204) {
        const errorText = await response.text();
        throw new Error(`Delete failed: ${response.status} ${errorText}`);
      }

      logger.log('Deleted file successfully');
    } catch (error) {
      logger.error('Error deleting file:', error);
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
    const tokens = await this.oauthManager.getValidTokens('box');

    if (!tokens) {
      throw new Error('No valid OAuth tokens found. Please authenticate first.');
    }

    return tokens.accessToken;
  }

  /**
   * Find existing application folder in Box root
   */
  private async findApplicationFolder(): Promise<string | null> {
    try {
      const response = await this.makeApiCall(
        `${BOX_API_BASE}/folders/0/items?fields=id,type,name`,
        { method: 'GET' }
      );

      const data: BoxListItemsResponse = response;

      const folder = data.entries.find(
        entry => entry.type === 'folder' && entry.name === APPLICATION_FOLDER_NAME
      );

      return folder ? folder.id : null;
    } catch (error) {
      logger.error('Error finding application folder:', error);
      return null;
    }
  }

  /**
   * Make an authenticated API call to Box with error handling
   */
  private async makeApiCall(url: string, options: RequestInit): Promise<any> {
    const accessToken = await this.getValidAccessToken();

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${accessToken}`,
      ...(options.headers as Record<string, string> || {})
    };

    // Only set Content-Type for non-GET requests with a body
    if (options.method !== 'GET' && options.body) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
      ...options,
      headers
    });

    if (!response.ok) {
      const errorText = await response.text();
      const error: any = new Error(this.mapBoxErrorToMessage(response.status, errorText));
      error.status = response.status;
      error.statusCode = response.status;
      error.response = errorText;

      logger.error('API error:', {
        url,
        status: response.status,
        statusText: response.statusText,
        errorText,
        operation: options.method || 'GET'
      });

      throw error;
    }

    // Handle 204 No Content (e.g., delete operations)
    if (response.status === 204) {
      return null;
    }

    return response.json();
  }

  /**
   * Map Box error codes to user-friendly messages
   */
  private mapBoxErrorToMessage(statusCode: number, errorText: string): string {
    let boxError: any = null;
    try {
      boxError = JSON.parse(errorText);
    } catch {
      // Not JSON, use raw error text
    }

    switch (statusCode) {
      case 401:
        return `Box authentication expired (${statusCode}). Please reconnect.`;

      case 403:
        return `Permission denied (${statusCode}). EasyEditor doesn't have permission to access this resource.`;

      case 404:
        return `File or folder not found (${statusCode}).`;

      case 409:
        if (boxError?.code === 'item_name_in_use') {
          return `A file with this name already exists (${statusCode}).`;
        }
        return `Conflict occurred (${statusCode}). Please try again.`;

      case 429:
        return `Rate limited (${statusCode}). Please try again in a few minutes.`;

      case 500:
      case 502:
      case 503:
      case 504:
        return `Box server error (${statusCode}). Please try again later.`;

      default:
        if (statusCode >= 500) {
          return `Box server error (${statusCode}). Please try again later.`;
        }
        if (statusCode >= 400) {
          return `Box API error (${statusCode}). ${boxError?.message || 'Please try again.'}`;
        }
        return `Box API error: ${statusCode}`;
    }
  }

  /**
   * Map Box file metadata to CloudFile interface
   */
  private mapBoxFileToCloudFile(item: BoxItemMetadata): CloudFile {
    return {
      id: item.id,
      name: item.name,
      modifiedTime: new Date(item.modified_at || Date.now()),
      size: item.size || 0,
      mimeType: item.name.endsWith('.sstp') ? 'application/octet-stream' : 'text/markdown'
    };
  }
}
