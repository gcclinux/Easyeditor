/**
 * BoxProvider - Web implementation for Box cloud storage
 * 
 * This provider implements the CloudProvider interface for Box using
 * OAuth 2.0 with PKCE for secure authentication in web environments.
 */

import { CloudProvider, CloudFile, AuthResult } from '../interfaces/CloudProvider';
import { BOX_CONFIG, isBoxConfigured, getConfigurationErrorMessage } from '../config/box-credentials';
import { cloudCredentialManager } from '../managers/CloudCredentialManager';
import LicenseManager from '../../premium/LicenseManager';

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

interface BoxTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

interface PKCEChallenge {
  verifier: string;
  challenge: string;
}

const BOX_AUTH_URL = 'https://account.box.com/api/oauth2/authorize';
const BOX_TOKEN_URL = '/api/box-oauth/oauth2/token';
const BOX_REVOKE_URL = '/api/box-oauth/oauth2/revoke';
const BOX_API_BASE = 'https://api.box.com/2.0';
const BOX_UPLOAD_BASE = 'https://upload.box.com/api/2.0';
const APPLICATION_FOLDER_NAME = 'Easyeditor';

export class BoxProvider implements CloudProvider {
  readonly name = 'box';
  readonly displayName = 'Box';
  readonly icon = '📦';

  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  private scopes: string[];
  private applicationFolderId: string | null = null;

  constructor() {
    if (!isBoxConfigured()) {
      const errorMessage = getConfigurationErrorMessage();
      console.warn('[BoxProvider] Configuration warning:', errorMessage);
    }

    this.clientId = BOX_CONFIG.CLIENT_ID;
    this.clientSecret = BOX_CONFIG.CLIENT_SECRET;
    this.redirectUri = BOX_CONFIG.REDIRECT_URI;
    this.scopes = BOX_CONFIG.SCOPES;

    console.log('[BoxProvider] Initialized with config:', {
      clientIdConfigured: !!this.clientId && !this.clientId.includes('your-'),
      redirectUri: this.redirectUri,
      scopes: this.scopes
    });
  }

  /**
   * Authenticate with Box using OAuth 2.0 + PKCE
   */
  async authenticate(): Promise<AuthResult> {
    console.log('[BoxProvider] Starting authentication flow');

    // Check for premium license first
    if (!LicenseManager.hasActiveLicense()) {
      console.warn('[BoxProvider] Premium license required for Box integration');
      return {
        success: false,
        error: 'Premium license required. Please upgrade to use Box integration.'
      };
    }

    if (!isBoxConfigured()) {
      const errorMessage = getConfigurationErrorMessage();
      console.error('[BoxProvider] Cannot authenticate - not configured:', errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    }

    try {
      // Generate PKCE challenge
      const pkce = await this.generatePKCEChallenge();

      // Store verifier in sessionStorage for later use
      sessionStorage.setItem('box_pkce_verifier', pkce.verifier);
      sessionStorage.setItem('box_auth_state', this.generateRandomState());

      // Build authorization URL
      const authUrl = this.buildAuthorizationUrl(pkce.challenge);

      console.log('[BoxProvider] Opening authorization URL');

      // Open authorization URL in new window
      const authWindow = window.open(authUrl, 'box_auth', 'width=600,height=700,noopener=no');

      if (!authWindow) {
        throw new Error('Failed to open authorization window. Please allow popups for this site.');
      }

      // Wait for OAuth callback
      const result = await this.waitForOAuthCallback(authWindow);

      return result;
    } catch (error) {
      console.error('[BoxProvider] Authentication error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed'
      };
    }
  }

  /**
   * Check if user is authenticated with Box
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      const credentials = await cloudCredentialManager.getCredentials(this.name);

      if (!credentials || !credentials.accessToken) {
        console.log('[BoxProvider] No credentials found');
        return false;
      }

      // Check if token is expired
      if (credentials.expiresAt && credentials.expiresAt <= new Date()) {
        console.log('[BoxProvider] Token expired, attempting refresh');

        // Try to refresh token
        if (credentials.refreshToken) {
          try {
            await this.refreshAccessToken(credentials.refreshToken);
            return true;
          } catch (error) {
            console.error('[BoxProvider] Token refresh failed:', error);
            return false;
          }
        }

        return false;
      }

      console.log('[BoxProvider] User is authenticated');
      return true;
    } catch (error) {
      console.error('[BoxProvider] Error checking authentication:', error);
      return false;
    }
  }

  /**
   * Disconnect from Box and revoke tokens
   */
  async disconnect(): Promise<void> {
    console.log('[BoxProvider] Disconnecting from Box');

    try {
      const credentials = await cloudCredentialManager.getCredentials(this.name);

      if (credentials?.accessToken) {
        // Revoke the access token via Box revocation endpoint
        try {
          await this.revokeToken(credentials.accessToken);
          console.log('[BoxProvider] Token revoked successfully');
        } catch (error) {
          console.warn('[BoxProvider] Token revocation failed:', error);
          // Continue with credential removal even if revocation fails
        }
      }

      // Remove stored credentials
      await cloudCredentialManager.removeCredentials(this.name);

      // Reset internal state
      this.applicationFolderId = null;

      console.log('[BoxProvider] Disconnected successfully');
    } catch (error) {
      console.error('[BoxProvider] Error during disconnect:', error);
      // Always clear credentials even if something fails
      await cloudCredentialManager.removeCredentials(this.name);
      this.applicationFolderId = null;
      throw error;
    }
  }

  /**
   * Create or find the application folder in Box
   */
  async createApplicationFolder(): Promise<string> {
    console.log('[BoxProvider] Creating/finding application folder');

    // Return cached folder ID if available
    if (this.applicationFolderId) {
      return this.applicationFolderId;
    }

    try {
      // First, try to find existing folder in root (folder ID "0")
      const existingFolderId = await this.findApplicationFolder();

      if (existingFolderId) {
        console.log('[BoxProvider] Found existing application folder:', existingFolderId);
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
          console.log('[BoxProvider] Folder already exists, searching again');
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
      console.log('[BoxProvider] Created application folder:', this.applicationFolderId);

      return this.applicationFolderId!;
    } catch (error) {
      console.error('[BoxProvider] Error creating application folder:', error);
      throw error;
    }
  }

  /**
   * List files in a Box folder
   */
  async listFiles(folderId: string): Promise<CloudFile[]> {
    console.log('[BoxProvider] Listing files in folder:', folderId);

    try {
      const response = await this.makeApiCall(
        `${BOX_API_BASE}/folders/${folderId}/items?fields=id,type,name,modified_at,size`,
        { method: 'GET' }
      );

      const data: BoxListItemsResponse = response;

      const files = data.entries
        .filter(entry => entry.type === 'file')
        .map(entry => this.mapBoxFileToCloudFile(entry));

      console.log('[BoxProvider] Found', files.length, 'files');
      return files;
    } catch (error) {
      console.error('[BoxProvider] Error listing files:', error);
      throw error;
    }
  }

  /**
   * Download file content from Box
   */
  async downloadFile(fileId: string): Promise<string | Uint8Array> {
    console.log('[BoxProvider] Downloading file:', fileId);

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
        // Non-fatal — fall back to content-type detection
      }

      const isBinary = fileName.endsWith('.sstp');

      const response = await fetch(`${BOX_API_BASE}/files/${fileId}/content`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Attempt token refresh and retry once
          const credentials = await cloudCredentialManager.getCredentials(this.name);
          if (credentials?.refreshToken) {
            await this.refreshAccessToken(credentials.refreshToken);
            const newToken = await this.getValidAccessToken();
            const retryResponse = await fetch(`${BOX_API_BASE}/files/${fileId}/content`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${newToken}`
              }
            });
            if (!retryResponse.ok) {
              throw new Error(`Download failed: ${retryResponse.status} ${retryResponse.statusText}`);
            }
            const content = await retryResponse.text();
            console.log('[BoxProvider] Downloaded file successfully (after refresh), size:', content.length);
            return content;
          }
          throw new Error(`Download failed: ${response.status} Unauthorized`);
        }
        throw new Error(`Download failed: ${response.status} ${response.statusText}`);
      }

      // Use filename extension to determine if binary (same approach as DropboxProvider)
      // Box always returns application/octet-stream so Content-Type is not reliable
      if (isBinary) {
        const buffer = await response.arrayBuffer();
        const content = new Uint8Array(buffer);
        console.log('[BoxProvider] Downloaded binary file successfully, size:', content.length);
        return content;
      }

      const content = await response.text();
      console.log('[BoxProvider] Downloaded file successfully, size:', content.length);
      return content;
    } catch (error) {
      console.error('[BoxProvider] Error downloading file:', error);
      throw error;
    }
  }

  /**
   * Upload a new file to Box
   */
  async uploadFile(folderId: string, fileName: string, content: string | Uint8Array): Promise<CloudFile> {
    console.log('[BoxProvider] Uploading file:', fileName, 'to folder:', folderId);

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
            console.log('[BoxProvider] File already exists, updating existing file:', conflictFileId);
            return await this.updateFile(conflictFileId, content);
          }
        }
        if (response.status === 401) {
          // Attempt token refresh and retry once
          const credentials = await cloudCredentialManager.getCredentials(this.name);
          if (credentials?.refreshToken) {
            await this.refreshAccessToken(credentials.refreshToken);
            const newToken = await this.getValidAccessToken();
            const retryFormData = new FormData();
            retryFormData.append('attributes', attributes);
            retryFormData.append('file', blob, fileName);
            const retryResponse = await fetch(`${BOX_UPLOAD_BASE}/files/content`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${newToken}`
              },
              body: retryFormData
            });
            if (!retryResponse.ok) {
              const errorText = await retryResponse.text();
              throw new Error(`Upload failed: ${retryResponse.status} ${errorText}`);
            }
            const retryData = await retryResponse.json();
            const retryFile = retryData.entries[0];
            return this.mapBoxFileToCloudFile(retryFile);
          }
        }
        const errorText = await response.text();
        throw new Error(`Upload failed: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      const uploadedFile = data.entries[0];
      const cloudFile = this.mapBoxFileToCloudFile(uploadedFile);

      console.log('[BoxProvider] Uploaded file successfully:', cloudFile.id);
      return cloudFile;
    } catch (error) {
      console.error('[BoxProvider] Error uploading file:', error);
      throw error;
    }
  }

  /**
   * Update an existing file in Box (upload new version)
   */
  async updateFile(fileId: string, content: string | Uint8Array): Promise<CloudFile> {
    console.log('[BoxProvider] Updating file:', fileId);

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
        if (response.status === 401) {
          // Attempt token refresh and retry once
          const credentials = await cloudCredentialManager.getCredentials(this.name);
          if (credentials?.refreshToken) {
            await this.refreshAccessToken(credentials.refreshToken);
            const newToken = await this.getValidAccessToken();
            const retryResponse = await fetch(`${BOX_UPLOAD_BASE}/files/${fileId}/content`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${newToken}`
              },
              body: formData
            });
            if (!retryResponse.ok) {
              const errorText = await retryResponse.text();
              throw new Error(`Update failed: ${retryResponse.status} ${errorText}`);
            }
            const retryData = await retryResponse.json();
            const retryFile = retryData.entries[0];
            return this.mapBoxFileToCloudFile(retryFile);
          }
        }
        const errorText = await response.text();
        throw new Error(`Update failed: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      const updatedFile = data.entries[0];
      const cloudFile = this.mapBoxFileToCloudFile(updatedFile);

      console.log('[BoxProvider] Updated file successfully');
      return cloudFile;
    } catch (error) {
      console.error('[BoxProvider] Error updating file:', error);
      throw error;
    }
  }

  /**
   * Delete a file from Box
   */
  async deleteFile(fileId: string): Promise<void> {
    console.log('[BoxProvider] Deleting file:', fileId);

    try {
      const accessToken = await this.getValidAccessToken();

      const response = await fetch(`${BOX_API_BASE}/files/${fileId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Attempt token refresh and retry once
          const credentials = await cloudCredentialManager.getCredentials(this.name);
          if (credentials?.refreshToken) {
            await this.refreshAccessToken(credentials.refreshToken);
            const newToken = await this.getValidAccessToken();
            const retryResponse = await fetch(`${BOX_API_BASE}/files/${fileId}`, {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${newToken}`
              }
            });
            if (!retryResponse.ok && retryResponse.status !== 204) {
              const errorText = await retryResponse.text();
              throw new Error(`Delete failed: ${retryResponse.status} ${errorText}`);
            }
            console.log('[BoxProvider] Deleted file successfully (after refresh)');
            return;
          }
        }
        if (response.status !== 204) {
          const errorText = await response.text();
          throw new Error(`Delete failed: ${response.status} ${errorText}`);
        }
      }

      console.log('[BoxProvider] Deleted file successfully');
    } catch (error) {
      console.error('[BoxProvider] Error deleting file:', error);
      throw error;
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Generate PKCE code verifier and challenge
   */
  private async generatePKCEChallenge(): Promise<PKCEChallenge> {
    // Generate random verifier (43-128 characters)
    const verifier = this.generateRandomString(128);

    // Create SHA-256 hash of verifier
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);

    // Convert to base64url
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashBase64 = btoa(String.fromCharCode(...hashArray))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    return {
      verifier,
      challenge: hashBase64
    };
  }

  /**
   * Generate random string for PKCE and state
   */
  private generateRandomString(length: number): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    const randomValues = new Uint8Array(length);
    crypto.getRandomValues(randomValues);

    return Array.from(randomValues)
      .map(value => charset[value % charset.length])
      .join('');
  }

  /**
   * Generate random state for OAuth
   */
  private generateRandomState(): string {
    return this.generateRandomString(32);
  }

  /**
   * Build OAuth authorization URL for Box
   */
  private buildAuthorizationUrl(codeChallenge: string): string {
    const state = sessionStorage.getItem('box_auth_state') || this.generateRandomState();

    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: this.redirectUri,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state: state,
      scope: this.scopes.join(' ')
    });

    return `${BOX_AUTH_URL}?${params.toString()}`;
  }

  /**
   * Wait for OAuth callback and exchange code for token
   */
  private async waitForOAuthCallback(authWindow: Window): Promise<AuthResult> {
    return new Promise((resolve) => {
      let messageReceived = false;

      // Listen for OAuth callback message
      const messageHandler = async (event: MessageEvent) => {
        console.log('[BoxProvider] Received message:', {
          origin: event.origin,
          type: event.data?.type,
          hasCode: !!event.data?.code
        });

        // Verify origin for security
        const isAuthorizedOrigin = BOX_CONFIG.AUTHORIZED_DOMAINS.some(domain =>
          event.origin === domain || event.origin.startsWith(domain)
        );

        if (!isAuthorizedOrigin) {
          console.warn('[BoxProvider] Received message from unauthorized origin:', event.origin);
        }

        if (event.data.type === 'box_oauth_callback') {
          console.log('[BoxProvider] Valid OAuth callback message received');
          messageReceived = true;
          window.removeEventListener('message', messageHandler);
          clearInterval(pollInterval);

          const { code, error } = event.data;

          if (error) {
            resolve({
              success: false,
              error: error
            });
            return;
          }

          if (code) {
            const verifier = sessionStorage.getItem('box_pkce_verifier');

            if (!verifier) {
              resolve({
                success: false,
                error: 'PKCE verifier not found'
              });
              return;
            }

            try {
              const result = await this.exchangeCodeForToken(code, verifier);

              // Clean up session storage
              sessionStorage.removeItem('box_pkce_verifier');
              sessionStorage.removeItem('box_auth_state');

              resolve(result);
            } catch (error) {
              resolve({
                success: false,
                error: error instanceof Error ? error.message : 'Token exchange failed'
              });
            }
          }
        }
      };

      console.log('[BoxProvider] Setting up message listener');
      window.addEventListener('message', messageHandler);

      // Poll the popup window to check if it has navigated to callback URL
      const pollInterval = setInterval(() => {
        // Check sessionStorage for code
        const storedCode = sessionStorage.getItem('box_oauth_code');
        const storedTimestamp = sessionStorage.getItem('box_oauth_timestamp');

        if (storedCode && storedTimestamp) {
          const timestamp = parseInt(storedTimestamp, 10);
          const age = Date.now() - timestamp;

          if (age < 60000) {
            console.log('[BoxProvider] Found OAuth code in sessionStorage');
            clearInterval(pollInterval);
            window.removeEventListener('message', messageHandler);

            if (authWindow && !authWindow.closed) {
              authWindow.close();
            }

            sessionStorage.removeItem('box_oauth_code');
            sessionStorage.removeItem('box_oauth_timestamp');

            const verifier = sessionStorage.getItem('box_pkce_verifier');

            if (!verifier) {
              resolve({
                success: false,
                error: 'PKCE verifier not found'
              });
              return;
            }

            this.exchangeCodeForToken(storedCode, verifier).then(result => {
              sessionStorage.removeItem('box_pkce_verifier');
              sessionStorage.removeItem('box_auth_state');
              resolve(result);
            }).catch(error => {
              resolve({
                success: false,
                error: error instanceof Error ? error.message : 'Token exchange failed'
              });
            });
            return;
          }
        }

        if (!authWindow || authWindow.closed) {
          console.log('[BoxProvider] Popup window was closed');
          clearInterval(pollInterval);
          window.removeEventListener('message', messageHandler);

          // Check one more time for stored code before giving up
          const finalCode = sessionStorage.getItem('box_oauth_code');
          if (finalCode && !messageReceived) {
            sessionStorage.removeItem('box_oauth_code');
            sessionStorage.removeItem('box_oauth_timestamp');

            const verifier = sessionStorage.getItem('box_pkce_verifier');
            if (verifier) {
              this.exchangeCodeForToken(finalCode, verifier).then(result => {
                sessionStorage.removeItem('box_pkce_verifier');
                sessionStorage.removeItem('box_auth_state');
                resolve(result);
              }).catch(error => {
                resolve({
                  success: false,
                  error: error instanceof Error ? error.message : 'Token exchange failed'
                });
              });
              return;
            }
          }

          if (!messageReceived) {
            resolve({
              success: false,
              error: 'Authentication window was closed'
            });
          }
          return;
        }

        try {
          const popupUrl = authWindow.location.href;

          if (popupUrl.includes('/box-oauth-callback.html')) {
            console.log('[BoxProvider] Detected callback URL in popup');

            const url = new URL(popupUrl);
            const code = url.searchParams.get('code');
            const error = url.searchParams.get('error');

            clearInterval(pollInterval);
            window.removeEventListener('message', messageHandler);
            authWindow.close();

            if (error) {
              resolve({
                success: false,
                error: url.searchParams.get('error_description') || error
              });
              return;
            }

            if (code) {
              const verifier = sessionStorage.getItem('box_pkce_verifier');

              if (!verifier) {
                resolve({
                  success: false,
                  error: 'PKCE verifier not found'
                });
                return;
              }

              this.exchangeCodeForToken(code, verifier).then(result => {
                sessionStorage.removeItem('box_pkce_verifier');
                sessionStorage.removeItem('box_auth_state');
                resolve(result);
              }).catch(error => {
                resolve({
                  success: false,
                  error: error instanceof Error ? error.message : 'Token exchange failed'
                });
              });
            }
          }
        } catch (e) {
          // Expected error when popup is on different origin (Box domain)
          // Just continue polling
        }
      }, 500);

      // Timeout after 5 minutes
      setTimeout(() => {
        console.log('[BoxProvider] OAuth timeout reached');
        clearInterval(pollInterval);
        window.removeEventListener('message', messageHandler);

        if (!messageReceived && authWindow && !authWindow.closed) {
          authWindow.close();
        }

        resolve({
          success: false,
          error: 'Authentication timeout'
        });
      }, 5 * 60 * 1000);
    });
  }

  /**
   * Exchange authorization code for access token
   */
  private async exchangeCodeForToken(code: string, verifier: string): Promise<AuthResult> {
    console.log('[BoxProvider] Exchanging code for token');

    try {
      const params = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        code_verifier: verifier
      });

      const response = await fetch(BOX_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
      }

      const data: BoxTokenResponse = await response.json();

      // Calculate expiry time
      const expiresAt = new Date(Date.now() + (data.expires_in * 1000));

      // Store credentials
      await cloudCredentialManager.saveCredentials({
        provider: this.name,
        accessToken: data.access_token,
        refreshToken: data.refresh_token || '',
        expiresAt,
        scope: this.scopes.join(' '),
        userId: ''
      });

      console.log('[BoxProvider] Token exchange successful');

      return {
        success: true,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt
      };
    } catch (error) {
      console.error('[BoxProvider] Token exchange error:', error);
      throw error;
    }
  }

  /**
   * Get a valid access token, refreshing if necessary
   */
  private async getValidAccessToken(): Promise<string> {
    const credentials = await cloudCredentialManager.getCredentials(this.name);

    if (!credentials || !credentials.accessToken) {
      throw new Error('Not authenticated with Box');
    }

    // Check if token is expired or will expire soon (within 5 minutes)
    const expiryBuffer = 5 * 60 * 1000;
    if (credentials.expiresAt && credentials.expiresAt.getTime() - Date.now() < expiryBuffer) {
      console.log('[BoxProvider] Token expired or expiring soon, refreshing');

      if (!credentials.refreshToken) {
        throw new Error('No refresh token available');
      }

      const newToken = await this.refreshAccessToken(credentials.refreshToken);
      return newToken;
    }

    return credentials.accessToken;
  }

  /**
   * Refresh access token using refresh token
   */
  private async refreshAccessToken(refreshToken: string): Promise<string> {
    console.log('[BoxProvider] Refreshing access token');

    try {
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret
      });

      const response = await fetch(BOX_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Token refresh failed: ${response.status} ${errorText}`);
      }

      const data: BoxTokenResponse = await response.json();

      // Calculate expiry time
      const expiresAt = new Date(Date.now() + (data.expires_in * 1000));

      // Update stored credentials
      await cloudCredentialManager.updateCredentials(this.name, {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || refreshToken,
        expiresAt
      });

      console.log('[BoxProvider] Token refreshed successfully');

      return data.access_token;
    } catch (error) {
      console.error('[BoxProvider] Token refresh error:', error);
      throw error;
    }
  }

  /**
   * Revoke access token via Box revocation endpoint
   */
  private async revokeToken(accessToken: string): Promise<void> {
    console.log('[BoxProvider] Revoking token');

    try {
      const params = new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        token: accessToken
      });

      const response = await fetch(BOX_REVOKE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });

      if (!response.ok) {
        throw new Error(`Token revocation failed: ${response.status}`);
      }

      console.log('[BoxProvider] Token revoked successfully');
    } catch (error) {
      console.error('[BoxProvider] Token revocation error:', error);
      throw error;
    }
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
      console.error('[BoxProvider] Error finding application folder:', error);
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
      // On 401, attempt token refresh and retry once
      if (response.status === 401) {
        console.log('[BoxProvider] Got 401, attempting token refresh and retry');
        const credentials = await cloudCredentialManager.getCredentials(this.name);
        if (credentials?.refreshToken) {
          try {
            await this.refreshAccessToken(credentials.refreshToken);
            const newToken = await this.getValidAccessToken();

            const retryHeaders: Record<string, string> = {
              'Authorization': `Bearer ${newToken}`,
              ...(options.headers as Record<string, string> || {})
            };
            if (options.method !== 'GET' && options.body) {
              retryHeaders['Content-Type'] = 'application/json';
            }

            const retryResponse = await fetch(url, {
              ...options,
              headers: retryHeaders
            });

            if (!retryResponse.ok) {
              const errorText = await retryResponse.text();
              const error: any = new Error(this.mapBoxErrorToMessage(retryResponse.status, errorText));
              error.status = retryResponse.status;
              error.statusCode = retryResponse.status;
              throw error;
            }

            return retryResponse.json();
          } catch (refreshError) {
            // If refresh also fails, throw the original error
            const errorText = await response.text().catch(() => '');
            const error: any = new Error(this.mapBoxErrorToMessage(response.status, errorText));
            error.status = response.status;
            error.statusCode = response.status;
            throw error;
          }
        }
      }

      const errorText = await response.text();
      const error: any = new Error(this.mapBoxErrorToMessage(response.status, errorText));
      error.status = response.status;
      error.statusCode = response.status;
      error.response = errorText;

      console.error('[BoxProvider] API error:', {
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
