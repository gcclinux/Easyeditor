/**
 * OAuth-enabled OneDrive Provider for Tauri environment
 * Uses the OAuth system for authentication instead of web-based MSAL flow
 * 
 * Requirements:
 * - 1.1: Register in CloudManager for Tauri environment
 * - 1.3: Implement all CloudProvider interface methods
 * - 1.5: name property set to "onedrive"
 * - 1.6: displayName property set to "OneDrive"
 * - 2.2: OAuth 2.0 with PKCE via system browser
 * - 2.3: Store tokens via CloudCredentialManager
 * - 2.4: Return well-formed AuthResult on success
 * - 2.5: Return well-formed AuthResult on failure
 * - 2.6: Request Files.ReadWrite.AppFolder scope
 * - 2.7: Automatic token refresh within 5 minutes of expiration
 * - 2.8: 5-minute authentication timeout
 * - 2.9: Handle refresh token failure
 * - 4.1-4.6: Folder management via Graph API
 * - 5.1-5.9: File operations via Graph API
 * - 11.1-11.4: Disconnect and cleanup
 */

import type { CloudProvider, CloudFile, AuthResult } from '../interfaces/CloudProvider';
import { OAuthManager } from '../../services/oauth/core/OAuthManager';
import { getSharedOAuthManager } from '../../services/oauth/tauri/SharedOAuthManager';
import { OneDriveOAuthProvider } from '../../services/oauth/providers/OneDriveOAuthProvider';
import { ONEDRIVE_CONFIG, isOneDriveConfigured, getConfigurationErrorMessage } from '../config/onedrive-credentials';
import { createLogger } from '../../utils/logger';

const logger = createLogger('OAuthOneDriveProvider');

interface GraphDriveItem {
  id: string;
  name: string;
  lastModifiedDateTime: string;
  size: number;
  file?: {
    mimeType: string;
  };
  folder?: {};
}

interface GraphListChildrenResponse {
  value: GraphDriveItem[];
}

const GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0';
const APPLICATION_FOLDER_NAME = 'Easyeditor';
const MAX_UPLOAD_SIZE = 4 * 1024 * 1024; // 4MB
const AUTH_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export class OAuthOneDriveProvider implements CloudProvider {
  readonly name = 'onedrive';
  readonly displayName = 'OneDrive';
  readonly icon = '☁️';

  private oauthManager: OAuthManager;
  private oneDriveProvider: OneDriveOAuthProvider;
  private applicationFolderId: string | null = null;

  constructor() {
    if (!isOneDriveConfigured()) {
      const errorMessage = getConfigurationErrorMessage();
      logger.warn('Configuration warning:', errorMessage);
    }

    // Get shared OAuth manager (reuses existing instance)
    this.oauthManager = getSharedOAuthManager();

    // Create and register OneDrive OAuth provider with credentials
    this.oneDriveProvider = new OneDriveOAuthProvider({
      clientId: ONEDRIVE_CONFIG.CLIENT_ID,
      clientSecret: ONEDRIVE_CONFIG.CLIENT_SECRET,
      scope: ONEDRIVE_CONFIG.SCOPES,
      authorizationUrl: 'https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize',
      tokenUrl: 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token',
      enabled: true
    });
    this.oauthManager.registerProvider(this.oneDriveProvider);

    logger.log('Initialized with shared OAuth manager');
  }

  /**
   * Authenticate with OneDrive using OAuth manager
   * Requirements: 2.2, 2.4, 2.5, 2.8
   */
  async authenticate(): Promise<AuthResult> {
    logger.log('Starting OAuth authentication');

    if (!isOneDriveConfigured()) {
      const errorMessage = getConfigurationErrorMessage();
      logger.error('Cannot authenticate - not configured:', errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    }

    try {
      // Use OAuth manager to authenticate with 5-minute timeout
      const authPromise = this.oauthManager.authenticate('onedrive');
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Authentication timeout')), AUTH_TIMEOUT_MS);
      });

      const oauthResult = await Promise.race([authPromise, timeoutPromise]);

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

      if (error instanceof Error && error.message === 'Authentication timeout') {
        return {
          success: false,
          error: 'Authentication timeout'
        };
      }

      // Handle user cancellation
      if (error instanceof Error && (
        error.message.includes('cancelled') ||
        error.message.includes('canceled') ||
        error.message.includes('closed')
      )) {
        return {
          success: false,
          error: 'Authentication window was closed'
        };
      }

      // Handle network errors
      if (error instanceof Error && (
        error.message.includes('network') ||
        error.message.includes('Network') ||
        error.message.includes('ENOTFOUND') ||
        error.message.includes('ECONNREFUSED')
      )) {
        return {
          success: false,
          error: `Network error: ${error.message}`
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed'
      };
    }
  }

  /**
   * Check if user is authenticated with OneDrive using OAuth manager
   * Triggers refresh if token is within 5 minutes of expiration
   * Requirements: 2.7
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      logger.log('Checking authentication status');

      const isAuth = await this.oauthManager.isAuthenticated('onedrive');
      logger.log('Authentication status:', isAuth);

      return isAuth || false;
    } catch (error) {
      logger.error('Error checking authentication:', error);
      return false;
    }
  }

  /**
   * Disconnect from OneDrive using OAuth manager
   * Requirements: 11.1, 11.2, 11.4
   */
  async disconnect(): Promise<void> {
    logger.log('Disconnecting from OneDrive');

    try {
      // Attempt token revocation via OAuth manager logout
      await this.oauthManager.logout('onedrive');

      // Reset internal state
      this.applicationFolderId = null;

      logger.log('Successfully disconnected');
    } catch (error) {
      logger.warn('Error during disconnect, clearing local state:', error);
      // Always reset local state even if logout/revocation fails (Requirement 11.2)
      this.applicationFolderId = null;
    }
  }

  /**
   * Create or find the application folder in OneDrive.
   * With Files.ReadWrite.AppFolder scope, the app folder is automatically
   * provisioned at /me/drive/special/approot — no manual creation needed.
   * Requirements: 4.1, 4.2, 4.3, 4.5
   */
  async createApplicationFolder(): Promise<string> {
    logger.log('Creating/finding application folder');

    // Return cached folder ID if available
    if (this.applicationFolderId) {
      return this.applicationFolderId;
    }

    try {
      // With AppFolder scope, the app root is at /me/drive/special/approot
      // This endpoint auto-creates the folder on first access
      const response = await this.makeApiCall(
        `${GRAPH_API_BASE}/me/drive/special/approot`,
        { method: 'GET' }
      );

      this.applicationFolderId = response.id;
      logger.log('Got application folder:', this.applicationFolderId);

      return this.applicationFolderId!;
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Network request could not be completed');
      }
      logger.error('Error creating application folder:', error);
      throw error;
    }
  }

  /**
   * List files in a OneDrive folder
   * Requirements: 5.3
   */
  async listFiles(folderId: string): Promise<CloudFile[]> {
    logger.log('Listing files in folder:', folderId);

    try {
      const response = await this.makeApiCall(
        `${GRAPH_API_BASE}/me/drive/items/${folderId}/children`,
        { method: 'GET' }
      );

      const data: GraphListChildrenResponse = response;

      const files = data.value
        .filter((item: GraphDriveItem) => item.file !== undefined)
        .map((item: GraphDriveItem) => this.mapGraphItemToCloudFile(item));

      logger.log('Found', files.length, 'files');
      return files;
    } catch (error) {
      logger.error('Error listing files:', error);
      throw error;
    }
  }

  /**
   * Download file content from OneDrive
   * Requirements: 5.4
   */
  async downloadFile(fileId: string): Promise<string | Uint8Array> {
    logger.log('Downloading file:', fileId);

    try {
      const accessToken = await this.getValidAccessToken();

      // First get file metadata to determine content type
      const metaResponse = await fetch(`${GRAPH_API_BASE}/me/drive/items/${fileId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      let mimeType = 'text/plain';
      let fileName = '';
      if (metaResponse.ok) {
        const meta = await metaResponse.json();
        mimeType = meta.file?.mimeType || 'text/plain';
        fileName = meta.name || '';
      }

      // Download the file content
      const response = await fetch(`${GRAPH_API_BASE}/me/drive/items/${fileId}/content`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw this.createApiError(response.status, errorText, 'download file');
      }

      // Determine if binary based on mimeType or file extension
      const isBinary = !mimeType.startsWith('text/') || fileName.endsWith('.sstp');

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
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Network request could not be completed');
      }
      logger.error('Error downloading file:', error);
      throw error;
    }
  }

  /**
   * Upload a new file to OneDrive
   * Requirements: 5.1, 5.2, 5.9
   */
  async uploadFile(folderId: string, fileName: string, content: string | Uint8Array): Promise<CloudFile> {
    logger.log('Uploading file:', fileName, 'to folder:', folderId);

    // Validate file size (Requirement 5.9)
    const contentSize = content instanceof Uint8Array ? content.length : new TextEncoder().encode(content).length;
    if (contentSize > MAX_UPLOAD_SIZE) {
      throw new Error('File exceeds maximum upload size (4MB) for simple upload');
    }

    try {
      const accessToken = await this.getValidAccessToken();

      const contentType = content instanceof Uint8Array
        ? 'application/octet-stream'
        : 'text/plain';

      const response = await fetch(
        `${GRAPH_API_BASE}/me/drive/items/${folderId}:/${encodeURIComponent(fileName)}:/content`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': contentType
          },
          body: content as BodyInit
        }
      );

      if (!response.ok) {
        if (response.status === 409) {
          // File already exists, update it instead
          logger.log('File already exists, attempting update');
          const errorData = await response.json().catch(() => null);
          // Try to find the existing file and update it
          const existingFiles = await this.listFiles(folderId);
          const existingFile = existingFiles.find(f => f.name === fileName);
          if (existingFile) {
            return await this.updateFile(existingFile.id, content);
          }
        }
        const errorText = await response.text();
        throw this.createApiError(response.status, errorText, 'upload file');
      }

      const data: GraphDriveItem = await response.json();
      const cloudFile = this.mapGraphItemToCloudFile(data);

      logger.log('Uploaded file successfully:', cloudFile.id);
      return cloudFile;
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Network request could not be completed');
      }
      logger.error('Error uploading file:', error);
      throw error;
    }
  }

  /**
   * Update an existing file in OneDrive
   * Requirements: 5.5
   */
  async updateFile(fileId: string, content: string | Uint8Array): Promise<CloudFile> {
    logger.log('Updating file:', fileId);

    // Validate file size
    const contentSize = content instanceof Uint8Array ? content.length : new TextEncoder().encode(content).length;
    if (contentSize > MAX_UPLOAD_SIZE) {
      throw new Error('File exceeds maximum upload size (4MB) for simple upload');
    }

    try {
      const accessToken = await this.getValidAccessToken();

      const contentType = content instanceof Uint8Array
        ? 'application/octet-stream'
        : 'text/plain';

      const response = await fetch(
        `${GRAPH_API_BASE}/me/drive/items/${fileId}/content`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': contentType
          },
          body: content as BodyInit
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw this.createApiError(response.status, errorText, 'update file');
      }

      const data: GraphDriveItem = await response.json();
      const cloudFile = this.mapGraphItemToCloudFile(data);

      logger.log('Updated file successfully');
      return cloudFile;
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Network request could not be completed');
      }
      logger.error('Error updating file:', error);
      throw error;
    }
  }

  /**
   * Delete a file from OneDrive
   * Requirements: 5.6
   */
  async deleteFile(fileId: string): Promise<void> {
    logger.log('Deleting file:', fileId);

    try {
      const accessToken = await this.getValidAccessToken();

      const response = await fetch(`${GRAPH_API_BASE}/me/drive/items/${fileId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok && response.status !== 204) {
        const errorText = await response.text();
        throw this.createApiError(response.status, errorText, 'delete file');
      }

      logger.log('Deleted file successfully');
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Network request could not be completed');
      }
      logger.error('Error deleting file:', error);
      throw error;
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Get a valid access token using OAuth manager
   * Requirements: 2.7, 4.5
   */
  private async getValidAccessToken(): Promise<string> {
    const tokens = await this.oauthManager.getValidTokens('onedrive');

    if (!tokens) {
      throw new Error('Authentication required. Please connect to OneDrive first.');
    }

    return tokens.accessToken;
  }

  /**
   * Find existing application folder in OneDrive.
   * With AppFolder scope, the app root is at /me/drive/special/approot.
   */
  private async findApplicationFolder(): Promise<string | null> {
    try {
      const response = await this.makeApiCall(
        `${GRAPH_API_BASE}/me/drive/special/approot`,
        { method: 'GET' }
      );

      return response?.id || null;
    } catch (error) {
      logger.error('Error finding application folder:', error);
      return null;
    }
  }

  /**
   * Make an authenticated API call to Microsoft Graph with error handling
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

    let response: Response;
    try {
      response = await fetch(url, {
        ...options,
        headers
      });
    } catch (error) {
      if (error instanceof TypeError) {
        throw new Error('Network request could not be completed');
      }
      throw error;
    }

    if (!response.ok) {
      // On 401, attempt token refresh and retry once
      if (response.status === 401) {
        logger.log('Received 401, attempting token refresh and retry');
        const refreshed = await this.oauthManager.refreshTokens('onedrive');
        if (refreshed) {
          const newAccessToken = await this.getValidAccessToken();
          headers['Authorization'] = `Bearer ${newAccessToken}`;

          let retryResponse: Response;
          try {
            retryResponse = await fetch(url, {
              ...options,
              headers
            });
          } catch (error) {
            if (error instanceof TypeError) {
              throw new Error('Network request could not be completed');
            }
            throw error;
          }

          if (!retryResponse.ok) {
            const errorText = await retryResponse.text();
            throw this.createApiError(retryResponse.status, errorText, options.method || 'GET');
          }

          // Handle 204 No Content
          if (retryResponse.status === 204) {
            return null;
          }

          return retryResponse.json();
        }
      }

      const errorText = await response.text();
      throw this.createApiError(response.status, errorText, options.method || 'GET');
    }

    // Handle 204 No Content (e.g., delete operations)
    if (response.status === 204) {
      return null;
    }

    return response.json();
  }

  /**
   * Create a structured API error with status code and description
   * Requirements: 4.4, 5.7
   */
  private createApiError(statusCode: number, errorText: string, operation: string): Error {
    let graphError: any = null;
    try {
      graphError = JSON.parse(errorText);
    } catch {
      // Not JSON, use raw error text
    }

    const description = this.mapGraphErrorToMessage(statusCode, graphError, errorText);
    const error: any = new Error(description);
    error.status = statusCode;
    error.statusCode = statusCode;
    error.response = errorText;

    logger.error('API error:', {
      status: statusCode,
      operation,
      description
    });

    return error;
  }

  /**
   * Map Microsoft Graph error codes to user-friendly messages
   */
  private mapGraphErrorToMessage(statusCode: number, graphError: any, rawText: string): string {
    const errorMessage = graphError?.error?.message || rawText || 'Unknown error';

    switch (statusCode) {
      case 401:
        return `OneDrive authentication expired (${statusCode}). Please reconnect. ${errorMessage}`;

      case 403:
        return `Permission denied (${statusCode}). ${errorMessage}`;

      case 404:
        return `File or folder not found (${statusCode}). ${errorMessage}`;

      case 409:
        return `Conflict occurred (${statusCode}). ${errorMessage}`;

      case 429:
        return `Rate limited (${statusCode}). Please try again in a few minutes. ${errorMessage}`;

      case 500:
      case 502:
      case 503:
      case 504:
        return `OneDrive server error (${statusCode}). ${errorMessage}`;

      default:
        if (statusCode >= 500) {
          return `OneDrive server error (${statusCode}). ${errorMessage}`;
        }
        if (statusCode >= 400) {
          return `OneDrive API error (${statusCode}). ${errorMessage}`;
        }
        return `OneDrive API error (${statusCode}). ${errorMessage}`;
    }
  }

  /**
   * Map Microsoft Graph DriveItem to CloudFile interface
   */
  private mapGraphItemToCloudFile(item: GraphDriveItem): CloudFile {
    return {
      id: item.id,
      name: item.name,
      modifiedTime: new Date(item.lastModifiedDateTime),
      size: item.size,
      mimeType: item.file?.mimeType || 'application/octet-stream'
    };
  }
}
