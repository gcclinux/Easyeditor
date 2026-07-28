/**
 * MSALOneDriveProvider - Web implementation for OneDrive cloud storage
 *
 * This provider implements the CloudProvider interface for OneDrive using
 * Microsoft Authentication Library (MSAL) for secure authentication in web environments
 * and the Microsoft Graph API for file operations.
 */

import { PublicClientApplication, Configuration, AuthenticationResult } from '@azure/msal-browser';
import { CloudProvider, CloudFile, AuthResult } from '../interfaces/CloudProvider';
import { ONEDRIVE_CONFIG, isOneDriveConfigured, getConfigurationErrorMessage } from '../config/onedrive-credentials';
import { cloudCredentialManager } from '../managers/CloudCredentialManager';
import { createLogger } from '../../utils/logger';

const logger = createLogger('MSALOneDriveProvider');

interface GraphDriveItem {
  id: string;
  name: string;
  lastModifiedDateTime: string;
  size: number;
  file?: {
    mimeType: string;
  };
  folder?: Record<string, unknown>;
}

interface GraphChildrenResponse {
  value: GraphDriveItem[];
}

const GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0';
const APPLICATION_FOLDER_NAME = 'Easyeditor';
const MAX_UPLOAD_SIZE = 4 * 1024 * 1024; // 4MB

export class MSALOneDriveProvider implements CloudProvider {
  readonly name = 'onedrive';
  readonly displayName = 'OneDrive';
  readonly icon = '☁️';

  private msalInstance: PublicClientApplication | null = null;
  private applicationFolderId: string | null = null;

  constructor() {
    if (!isOneDriveConfigured()) {
      const errorMessage = getConfigurationErrorMessage();
      logger.warn('Configuration warning:', errorMessage);
    }

    try {
      this.getMsalInstance();
      logger.log('Initialized with config:', {
        clientIdConfigured: !!ONEDRIVE_CONFIG.CLIENT_ID && !ONEDRIVE_CONFIG.CLIENT_ID.includes('your-'),
        redirectUri: ONEDRIVE_CONFIG.REDIRECT_URI,
        scopes: ONEDRIVE_CONFIG.SCOPES
      });
    } catch (err) {
      logger.warn('MSAL pre-initialization deferred until authentication:', err);
    }
  }

  private getMsalInstance(): PublicClientApplication {
    if (!this.msalInstance) {
      const msalConfig: Configuration = {
        auth: {
          clientId: ONEDRIVE_CONFIG.CLIENT_ID || 'your-development-client-id',
          authority: 'https://login.microsoftonline.com/consumers',
          redirectUri: ONEDRIVE_CONFIG.REDIRECT_URI || (typeof window !== 'undefined' ? window.location.origin : '')
        },
        cache: {
          cacheLocation: 'sessionStorage'
        }
      };
      this.msalInstance = new PublicClientApplication(msalConfig);
    }
    return this.msalInstance;
  }

  /**
   * Authenticate with OneDrive using MSAL popup
   */
  async authenticate(): Promise<AuthResult> {
    logger.log('Starting authentication flow');

    if (!isOneDriveConfigured()) {
      const errorMessage = getConfigurationErrorMessage();
      logger.error('Cannot authenticate - not configured:', errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    }

    try {
      const msal = this.getMsalInstance();
      // MSAL requires initialize() before any auth methods can be used
      await msal.initialize();

      // Process any pending redirect responses (required for MSAL v5 bridge page flow).
      // This also clears any stuck interaction_in_progress state from previous failed attempts.
      try {
        await msal.handleRedirectPromise();
      } catch (redirectError) {
        logger.warn('handleRedirectPromise error (clearing state):', redirectError);
      }

      const loginRequest = {
        scopes: ['Files.ReadWrite.AppFolder', 'offline_access'],
        redirectUri: ONEDRIVE_CONFIG.REDIRECT_URI
      };

      const response: AuthenticationResult = await msal.loginPopup(loginRequest);

      if (!response || !response.accessToken) {
        return {
          success: false,
          error: 'Authentication failed: no access token received'
        };
      }

      const expiresAt = response.expiresOn ? new Date(response.expiresOn) : new Date(Date.now() + 3600 * 1000);

      // Store credentials via CloudCredentialManager
      await cloudCredentialManager.saveCredentials({
        provider: this.name,
        accessToken: response.accessToken,
        refreshToken: response.idToken || '',
        expiresAt,
        scope: loginRequest.scopes.join(' ')
      });

      logger.log('Authentication successful');

      return {
        success: true,
        accessToken: response.accessToken,
        refreshToken: response.idToken || '',
        expiresAt
      };
    } catch (error) {
      logger.error('Authentication error:', error);

      if (error instanceof Error) {
        // MSAL-specific error handling
        if (error.message.includes('user_cancelled') || error.message.includes('popup_window_error')) {
          return {
            success: false,
            error: 'Authentication window was closed'
          };
        }
        if (error.message.includes('network')) {
          return {
            success: false,
            error: 'Network error: ' + error.message
          };
        }
        return {
          success: false,
          error: error.message
        };
      }

      return {
        success: false,
        error: 'Authentication failed'
      };
    }
  }

  /**
   * Check if user is authenticated with OneDrive
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      const credentials = await cloudCredentialManager.getCredentials(this.name);

      if (!credentials || !credentials.accessToken) {
        logger.log('No credentials found');
        return false;
      }

      // Check if token expires within 5 minutes
      if (credentials.expiresAt) {
        const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);

        if (credentials.expiresAt <= fiveMinutesFromNow) {
          logger.log('Token expiring soon, attempting silent refresh');

          try {
            const refreshed = await this.refreshToken();
            return refreshed;
          } catch (error) {
            logger.error('Token refresh failed:', error);
            return false;
          }
        }
      }

      logger.log('User is authenticated');
      return true;
    } catch (error) {
      logger.error('Error checking authentication:', error);
      return false;
    }
  }

  /**
   * Disconnect from OneDrive and revoke tokens
   */
  async disconnect(): Promise<void> {
    logger.log('Disconnecting from OneDrive');

    try {
      // Attempt token revocation via MSAL logout
      try {
        const msal = this.getMsalInstance();
        await msal.initialize();
        const accounts = msal.getAllAccounts();
        if (accounts.length > 0) {
          await msal.logoutPopup({
            account: accounts[0]
          });
        }
        logger.log('Token revoked successfully');
      } catch (error) {
        logger.warn('Token revocation failed:', error);
        // Continue with credential removal even if revocation fails
      }

      // Remove stored credentials
      await cloudCredentialManager.removeCredentials(this.name);

      // Reset internal state
      this.applicationFolderId = null;

      logger.log('Disconnected successfully');
    } catch (error) {
      logger.error('Error during disconnect:', error);
      // Always clear credentials even if something fails
      await cloudCredentialManager.removeCredentials(this.name);
      this.applicationFolderId = null;
      throw error;
    }
  }

  /**
   * Create or find the application folder in OneDrive.
   * With Files.ReadWrite.AppFolder scope, the app folder is at /me/drive/special/approot.
   */
  async createApplicationFolder(): Promise<string> {
    logger.log('Creating/finding application folder');

    // Return cached folder ID if available
    if (this.applicationFolderId) {
      return this.applicationFolderId;
    }

    try {
      const accessToken = await this.getValidAccessToken();

      // With AppFolder scope, the app root is at /me/drive/special/approot
      // This endpoint auto-creates the folder on first access
      const response = await this.makeGraphRequest(
        `${GRAPH_API_BASE}/me/drive/special/approot`,
        { method: 'GET' },
        accessToken
      );

      const folderData = response as GraphDriveItem;
      this.applicationFolderId = folderData.id;
      logger.log('Got application folder:', this.applicationFolderId);

      return this.applicationFolderId;
    } catch (error) {
      logger.error('Error creating application folder:', error);
      throw error;
    }
  }

  /**
   * List files in a OneDrive folder
   */
  async listFiles(folderId: string): Promise<CloudFile[]> {
    logger.log('Listing files in folder:', folderId);

    try {
      const accessToken = await this.getValidAccessToken();

      const response = await this.makeGraphRequest(
        `${GRAPH_API_BASE}/me/drive/items/${folderId}/children`,
        { method: 'GET' },
        accessToken
      );

      const data = response as GraphChildrenResponse;

      const files = (data.value || [])
        .filter(item => item.file !== undefined)
        .map(item => this.mapGraphItemToCloudFile(item));

      logger.log('Found', files.length, 'files');
      return files;
    } catch (error) {
      logger.error('Error listing files:', error);
      throw error;
    }
  }

  /**
   * Download file content from OneDrive
   */
  async downloadFile(fileId: string): Promise<string | Uint8Array> {
    logger.log('Downloading file:', fileId);

    try {
      const accessToken = await this.getValidAccessToken();

      // First get file metadata to determine content type
      const metaResponse = await this.makeGraphRequest(
        `${GRAPH_API_BASE}/me/drive/items/${fileId}`,
        { method: 'GET' },
        accessToken
      );

      const metadata = metaResponse as GraphDriveItem;
      const mimeType = metadata.file?.mimeType || 'application/octet-stream';

      // Download the file content
      const response = await fetch(`${GRAPH_API_BASE}/me/drive/items/${fileId}/content`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Attempt token refresh and retry once
          const refreshed = await this.refreshToken();
          if (refreshed) {
            const newToken = await this.getValidAccessToken();
            const retryResponse = await fetch(`${GRAPH_API_BASE}/me/drive/items/${fileId}/content`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${newToken}`
              }
            });
            if (!retryResponse.ok) {
              await this.handleHttpError(retryResponse);
            }
            if (mimeType.startsWith('text/')) {
              return await retryResponse.text();
            }
            const buffer = await retryResponse.arrayBuffer();
            return new Uint8Array(buffer);
          }
        }
        await this.handleHttpError(response);
      }

      // Return string for text/* content types, Uint8Array otherwise
      if (mimeType.startsWith('text/')) {
        const content = await response.text();
        logger.log('Downloaded text file successfully, size:', content.length);
        return content;
      }

      const buffer = await response.arrayBuffer();
      const content = new Uint8Array(buffer);
      logger.log('Downloaded binary file successfully, size:', content.length);
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
   */
  async uploadFile(folderId: string, fileName: string, content: string | Uint8Array): Promise<CloudFile> {
    logger.log('Uploading file:', fileName, 'to folder:', folderId);

    // Validate file size (≤4MB)
    const contentSize = content instanceof Uint8Array ? content.length : new TextEncoder().encode(content).length;
    if (contentSize > MAX_UPLOAD_SIZE) {
      throw new Error('File exceeds maximum upload size of 4MB');
    }

    try {
      const accessToken = await this.getValidAccessToken();

      // Use simple upload: PUT /me/drive/items/{folder-id}:/{filename}:/content
      const uploadUrl = `${GRAPH_API_BASE}/me/drive/items/${folderId}:/${encodeURIComponent(fileName)}:/content`;

      const contentType = content instanceof Uint8Array ? 'application/octet-stream' : 'text/plain';
      const body: Blob = content instanceof Uint8Array
        ? new Blob([content as BlobPart], { type: contentType })
        : new Blob([content], { type: contentType });

      const response = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': contentType
        },
        body
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Attempt token refresh and retry once
          const refreshed = await this.refreshToken();
          if (refreshed) {
            const newToken = await this.getValidAccessToken();
            const retryResponse = await fetch(uploadUrl, {
              method: 'PUT',
              headers: {
                'Authorization': `Bearer ${newToken}`,
                'Content-Type': contentType
              },
              body
            });
            if (!retryResponse.ok) {
              await this.handleHttpError(retryResponse);
            }
            const retryData = await retryResponse.json() as GraphDriveItem;
            return this.mapGraphItemToCloudFile(retryData);
          }
        }
        await this.handleHttpError(response);
      }

      const data = await response.json() as GraphDriveItem;
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
   */
  async updateFile(fileId: string, content: string | Uint8Array): Promise<CloudFile> {
    logger.log('Updating file:', fileId);

    try {
      const accessToken = await this.getValidAccessToken();

      // PUT /me/drive/items/{item-id}/content
      const updateUrl = `${GRAPH_API_BASE}/me/drive/items/${fileId}/content`;

      const contentType = content instanceof Uint8Array ? 'application/octet-stream' : 'text/plain';
      const body: Blob = content instanceof Uint8Array
        ? new Blob([content as BlobPart], { type: contentType })
        : new Blob([content], { type: contentType });

      const response = await fetch(updateUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': contentType
        },
        body
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Attempt token refresh and retry once
          const refreshed = await this.refreshToken();
          if (refreshed) {
            const newToken = await this.getValidAccessToken();
            const retryResponse = await fetch(updateUrl, {
              method: 'PUT',
              headers: {
                'Authorization': `Bearer ${newToken}`,
                'Content-Type': contentType
              },
              body
            });
            if (!retryResponse.ok) {
              await this.handleHttpError(retryResponse);
            }
            const retryData = await retryResponse.json() as GraphDriveItem;
            return this.mapGraphItemToCloudFile(retryData);
          }
        }
        await this.handleHttpError(response);
      }

      const data = await response.json() as GraphDriveItem;
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
        if (response.status === 401) {
          // Attempt token refresh and retry once
          const refreshed = await this.refreshToken();
          if (refreshed) {
            const newToken = await this.getValidAccessToken();
            const retryResponse = await fetch(`${GRAPH_API_BASE}/me/drive/items/${fileId}`, {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${newToken}`
              }
            });
            if (!retryResponse.ok && retryResponse.status !== 204) {
              await this.handleHttpError(retryResponse);
            }
            logger.log('Deleted file successfully (after refresh)');
            return;
          }
        }
        await this.handleHttpError(response);
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
   * Get a valid access token, refreshing if necessary
   */
  private async getValidAccessToken(): Promise<string> {
    const credentials = await cloudCredentialManager.getCredentials(this.name);

    if (!credentials || !credentials.accessToken) {
      throw new Error('Authentication required');
    }

    // Check if token expires within 5 minutes
    if (credentials.expiresAt) {
      const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
      if (credentials.expiresAt <= fiveMinutesFromNow) {
        const refreshed = await this.refreshToken();
        if (!refreshed) {
          throw new Error('Authentication required');
        }
        const newCredentials = await cloudCredentialManager.getCredentials(this.name);
        if (!newCredentials || !newCredentials.accessToken) {
          throw new Error('Authentication required');
        }
        return newCredentials.accessToken;
      }
    }

    return credentials.accessToken;
  }

  /**
   * Refresh the access token using MSAL silent acquisition
   */
  private async refreshToken(): Promise<boolean> {
    try {
      const msal = this.getMsalInstance();
      await msal.initialize();
      const accounts = msal.getAllAccounts();

      if (accounts.length === 0) {
        logger.log('No accounts found for silent refresh');
        return false;
      }

      const silentRequest = {
        scopes: ['Files.ReadWrite.AppFolder', 'offline_access'],
        account: accounts[0]
      };

      const response = await msal.acquireTokenSilent(silentRequest);

      if (response && response.accessToken) {
        const expiresAt = response.expiresOn ? new Date(response.expiresOn) : new Date(Date.now() + 3600 * 1000);

        await cloudCredentialManager.saveCredentials({
          provider: this.name,
          accessToken: response.accessToken,
          refreshToken: response.idToken || '',
          expiresAt,
          scope: silentRequest.scopes.join(' ')
        });

        logger.log('Token refreshed successfully');
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Silent token refresh failed:', error);
      return false;
    }
  }

  /**
   * Make a Graph API request with error handling
   */
  private async makeGraphRequest(
    url: string,
    options: RequestInit,
    accessToken: string
  ): Promise<unknown> {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          ...options.headers
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Attempt token refresh and retry once
          const refreshed = await this.refreshToken();
          if (refreshed) {
            const newToken = await this.getValidAccessToken();
            const retryResponse = await fetch(url, {
              ...options,
              headers: {
                'Authorization': `Bearer ${newToken}`,
                ...options.headers
              }
            });
            if (!retryResponse.ok) {
              await this.handleHttpError(retryResponse);
            }
            return await retryResponse.json();
          }
        }
        await this.handleHttpError(response);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Network request could not be completed');
      }
      throw error;
    }
  }

  /**
   * Handle HTTP error responses by throwing descriptive errors
   */
  private async handleHttpError(response: Response): Promise<never> {
    let errorDescription = '';

    try {
      const errorBody = await response.json();
      errorDescription = errorBody?.error?.message || errorBody?.error_description || JSON.stringify(errorBody);
    } catch {
      try {
        errorDescription = await response.text();
      } catch {
        errorDescription = response.statusText || 'Unknown error';
      }
    }

    if (!errorDescription) {
      errorDescription = response.statusText || 'Unknown error';
    }

    const errorMessage = `${response.status} ${errorDescription}`;

    switch (response.status) {
      case 403:
        throw new Error(`${response.status} Permission denied: ${errorDescription}`);
      case 404:
        throw new Error(`${response.status} File or folder not found: ${errorDescription}`);
      case 429:
        throw new Error(`${response.status} Rate limited: ${errorDescription}`);
      default:
        if (response.status >= 500) {
          throw new Error(`${response.status} OneDrive server error: ${errorDescription}`);
        }
        throw new Error(errorMessage);
    }
  }

  /**
   * Map a Graph API DriveItem to a CloudFile
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
