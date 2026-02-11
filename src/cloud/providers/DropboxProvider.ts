/**
 * DropboxProvider - Web implementation for Dropbox cloud storage
 * 
 * This provider implements the CloudProvider interface for Dropbox using
 * OAuth 2.0 with PKCE for secure authentication in web environments.
 */

import { CloudProvider, CloudFile, AuthResult } from '../interfaces/CloudProvider';
import { DROPBOX_CONFIG, isDropboxConfigured, getConfigurationErrorMessage } from '../config/dropbox-credentials';
import { cloudCredentialManager } from '../managers/CloudCredentialManager';
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

interface PKCEChallenge {
  verifier: string;
  challenge: string;
}

const DROPBOX_API_BASE = 'https://api.dropboxapi.com/2';
const DROPBOX_CONTENT_API_BASE = 'https://content.dropboxapi.com/2';
const DROPBOX_AUTH_BASE = 'https://www.dropbox.com/oauth2';
const APPLICATION_FOLDER_NAME = 'Easyeditor';

export class DropboxProvider implements CloudProvider {
  readonly name = 'dropbox';
  readonly displayName = 'Dropbox';
  readonly icon = '📦';

  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  private scopes: string[];

  constructor() {
    // Validate configuration on initialization
    if (!isDropboxConfigured()) {
      const errorMessage = getConfigurationErrorMessage();
      console.warn('[DropboxProvider] Configuration warning:', errorMessage);
    }

    this.clientId = DROPBOX_CONFIG.CLIENT_ID;
    this.clientSecret = DROPBOX_CONFIG.CLIENT_SECRET;
    this.redirectUri = DROPBOX_CONFIG.REDIRECT_URI;
    this.scopes = DROPBOX_CONFIG.SCOPES;

    console.log('[DropboxProvider] Initialized with config:', {
      clientIdConfigured: !!this.clientId && !this.clientId.includes('your-'),
      redirectUri: this.redirectUri,
      scopes: this.scopes
    });
  }

  /**
   * Authenticate with Dropbox using OAuth 2.0 + PKCE
   */
  async authenticate(): Promise<AuthResult> {
    console.log('[DropboxProvider] Starting authentication flow');

    // Check for premium license first
    if (!LicenseManager.hasActiveLicense()) {
      console.warn('[DropboxProvider] Premium license required for Dropbox integration');
      return {
        success: false,
        error: 'Premium license required. Please upgrade to use Dropbox integration.'
      };
    }

    if (!isDropboxConfigured()) {
      const errorMessage = getConfigurationErrorMessage();
      console.error('[DropboxProvider] Cannot authenticate - not configured:', errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    }

    try {
      // Generate PKCE challenge
      const pkce = await this.generatePKCEChallenge();
      
      // Store verifier in sessionStorage for later use
      sessionStorage.setItem('dropbox_pkce_verifier', pkce.verifier);
      sessionStorage.setItem('dropbox_auth_state', this.generateRandomState());

      // Build authorization URL
      const authUrl = this.buildAuthorizationUrl(pkce.challenge);
      
      console.log('[DropboxProvider] Opening authorization URL');
      
      // Open authorization URL in new window
      // Note: Don't use 'noopener' to preserve window.opener relationship
      const authWindow = window.open(authUrl, 'dropbox_auth', 'width=600,height=700,noopener=no');
      
      if (!authWindow) {
        throw new Error('Failed to open authorization window. Please allow popups for this site.');
      }

      // Wait for OAuth callback
      const result = await this.waitForOAuthCallback(authWindow);
      
      return result;
    } catch (error) {
      console.error('[DropboxProvider] Authentication error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed'
      };
    }
  }

  /**
   * Check if user is authenticated with Dropbox
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      const credentials = await cloudCredentialManager.getCredentials(this.name);
      
      if (!credentials || !credentials.accessToken) {
        console.log('[DropboxProvider] No credentials found');
        return false;
      }

      // Check if token is expired
      if (credentials.expiresAt && credentials.expiresAt <= new Date()) {
        console.log('[DropboxProvider] Token expired, attempting refresh');
        
        // Try to refresh token
        if (credentials.refreshToken) {
          try {
            await this.refreshAccessToken(credentials.refreshToken);
            return true;
          } catch (error) {
            console.error('[DropboxProvider] Token refresh failed:', error);
            return false;
          }
        }
        
        return false;
      }

      console.log('[DropboxProvider] User is authenticated');
      return true;
    } catch (error) {
      console.error('[DropboxProvider] Error checking authentication:', error);
      return false;
    }
  }

  /**
   * Disconnect from Dropbox and revoke tokens
   */
  async disconnect(): Promise<void> {
    console.log('[DropboxProvider] Disconnecting from Dropbox');

    try {
      const credentials = await cloudCredentialManager.getCredentials(this.name);
      
      if (credentials?.accessToken) {
        // Revoke the access token
        try {
          await this.revokeToken(credentials.accessToken);
          console.log('[DropboxProvider] Token revoked successfully');
        } catch (error) {
          console.warn('[DropboxProvider] Token revocation failed:', error);
          // Continue with credential removal even if revocation fails
        }
      }

      // Remove stored credentials
      await cloudCredentialManager.removeCredentials(this.name);
      
      console.log('[DropboxProvider] Disconnected successfully');
    } catch (error) {
      console.error('[DropboxProvider] Error during disconnect:', error);
      throw error;
    }
  }

  /**
   * Create or find the application folder in Dropbox
   */
  async createApplicationFolder(): Promise<string> {
    console.log('[DropboxProvider] Creating/finding application folder');

    try {
      // First, try to find existing folder
      const existingFolderId = await this.findApplicationFolder();
      
      if (existingFolderId) {
        console.log('[DropboxProvider] Found existing application folder:', existingFolderId);
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
      console.log('[DropboxProvider] Created application folder:', folderId);
      
      return folderId;
    } catch (error: any) {
      // If folder already exists (409 conflict), that's okay
      if (error.status === 409) {
        console.log('[DropboxProvider] Folder already exists, using existing folder');
        return `/${APPLICATION_FOLDER_NAME}`;
      }
      
      console.error('[DropboxProvider] Error creating application folder:', error);
      throw error;
    }
  }

  /**
   * List all markdown files in the application folder
   */
  async listFiles(folderId: string): Promise<CloudFile[]> {
    console.log('[DropboxProvider] Listing files in folder:', folderId);

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

      // Filter for markdown files only
      const files = response.entries
        .filter(entry => entry['.tag'] === 'file' && entry.name.endsWith('.md'))
        .map(entry => this.mapDropboxFileToCloudFile(entry));

      console.log('[DropboxProvider] Found', files.length, 'markdown files');
      return files;
    } catch (error) {
      console.error('[DropboxProvider] Error listing files:', error);
      throw error;
    }
  }

  /**
   * Download file content from Dropbox
   */
  async downloadFile(fileId: string): Promise<string> {
    console.log('[DropboxProvider] Downloading file:', fileId);

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

      const content = await response.text();
      console.log('[DropboxProvider] Downloaded file successfully, size:', content.length);
      
      return content;
    } catch (error) {
      console.error('[DropboxProvider] Error downloading file:', error);
      throw error;
    }
  }

  /**
   * Upload a new file to Dropbox
   */
  async uploadFile(folderId: string, fileName: string, content: string): Promise<CloudFile> {
    console.log('[DropboxProvider] Uploading file:', fileName, 'to folder:', folderId);

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
        body: content
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const metadata: DropboxFileMetadata = await response.json();
      const cloudFile = this.mapDropboxFileToCloudFile(metadata);
      
      console.log('[DropboxProvider] Uploaded file successfully:', cloudFile.id);
      return cloudFile;
    } catch (error) {
      console.error('[DropboxProvider] Error uploading file:', error);
      throw error;
    }
  }

  /**
   * Update an existing file in Dropbox
   */
  async updateFile(fileId: string, content: string): Promise<CloudFile> {
    console.log('[DropboxProvider] Updating file:', fileId);

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
        body: content
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Update failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const metadata: DropboxFileMetadata = await response.json();
      const cloudFile = this.mapDropboxFileToCloudFile(metadata);
      
      console.log('[DropboxProvider] Updated file successfully');
      return cloudFile;
    } catch (error) {
      console.error('[DropboxProvider] Error updating file:', error);
      throw error;
    }
  }

  /**
   * Delete a file from Dropbox
   */
  async deleteFile(fileId: string): Promise<void> {
    console.log('[DropboxProvider] Deleting file:', fileId);

    try {
      await this.makeApiCall(`${DROPBOX_API_BASE}/files/delete_v2`, {
        method: 'POST',
        body: JSON.stringify({
          path: fileId
        })
      });

      console.log('[DropboxProvider] Deleted file successfully');
    } catch (error) {
      console.error('[DropboxProvider] Error deleting file:', error);
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
   * Build OAuth authorization URL
   */
  private buildAuthorizationUrl(codeChallenge: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: this.redirectUri,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      token_access_type: 'offline', // Request refresh token
      scope: this.scopes.join(' ')
    });

    return `${DROPBOX_AUTH_BASE}/authorize?${params.toString()}`;
  }

  /**
   * Wait for OAuth callback and exchange code for token
   */
  private async waitForOAuthCallback(authWindow: Window): Promise<AuthResult> {
    return new Promise((resolve) => {
      let messageReceived = false;
      
      // Listen for OAuth callback message
      const messageHandler = async (event: MessageEvent) => {
        console.log('[DropboxProvider] Received message:', { 
          origin: event.origin, 
          type: event.data?.type,
          hasCode: !!event.data?.code 
        });
        
        // Verify origin for security (check if it's from our authorized domains)
        const isAuthorizedOrigin = DROPBOX_CONFIG.AUTHORIZED_DOMAINS.some(domain => 
          event.origin === domain || event.origin.startsWith(domain)
        );
        
        if (!isAuthorizedOrigin) {
          console.warn('[DropboxProvider] Received message from unauthorized origin:', event.origin);
          console.warn('[DropboxProvider] Authorized domains:', DROPBOX_CONFIG.AUTHORIZED_DOMAINS);
          // Don't return immediately - check if it's a valid callback message
        }

        if (event.data.type === 'dropbox_oauth_callback') {
          console.log('[DropboxProvider] Valid OAuth callback message received');
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
            // Exchange code for token
            const verifier = sessionStorage.getItem('dropbox_pkce_verifier');
            
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
              sessionStorage.removeItem('dropbox_pkce_verifier');
              sessionStorage.removeItem('dropbox_auth_state');
              
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

      console.log('[DropboxProvider] Setting up message listener');
      window.addEventListener('message', messageHandler);

      // Poll the popup window to check if it has navigated to callback URL
      const pollInterval = setInterval(() => {
        console.log('[DropboxProvider] Polling popup window...', {
          windowExists: !!authWindow,
          windowClosed: authWindow?.closed
        });
        
        // Check sessionStorage for code (works even when window.opener is null)
        const storedCode = sessionStorage.getItem('dropbox_oauth_code');
        const storedTimestamp = sessionStorage.getItem('dropbox_oauth_timestamp');
        
        if (storedCode && storedTimestamp) {
          // Check if this is a recent code (within last 60 seconds)
          const timestamp = parseInt(storedTimestamp, 10);
          const age = Date.now() - timestamp;
          
          if (age < 60000) { // 60 seconds
            console.log('[DropboxProvider] Found OAuth code in sessionStorage');
            clearInterval(pollInterval);
            window.removeEventListener('message', messageHandler);
            
            if (authWindow && !authWindow.closed) {
              authWindow.close();
            }
            
            // Clean up sessionStorage
            sessionStorage.removeItem('dropbox_oauth_code');
            sessionStorage.removeItem('dropbox_oauth_timestamp');
            
            // Exchange code for token
            const verifier = sessionStorage.getItem('dropbox_pkce_verifier');
            
            if (!verifier) {
              resolve({
                success: false,
                error: 'PKCE verifier not found'
              });
              return;
            }

            this.exchangeCodeForToken(storedCode, verifier).then(result => {
              // Clean up session storage
              sessionStorage.removeItem('dropbox_pkce_verifier');
              sessionStorage.removeItem('dropbox_auth_state');
              
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
          console.log('[DropboxProvider] Popup window was closed');
          clearInterval(pollInterval);
          window.removeEventListener('message', messageHandler);
          
          // Check one more time for stored code before giving up
          const finalCode = sessionStorage.getItem('dropbox_oauth_code');
          if (finalCode && !messageReceived) {
            console.log('[DropboxProvider] Found code in sessionStorage after window closed');
            sessionStorage.removeItem('dropbox_oauth_code');
            sessionStorage.removeItem('dropbox_oauth_timestamp');
            
            const verifier = sessionStorage.getItem('dropbox_pkce_verifier');
            if (verifier) {
              this.exchangeCodeForToken(finalCode, verifier).then(result => {
                sessionStorage.removeItem('dropbox_pkce_verifier');
                sessionStorage.removeItem('dropbox_auth_state');
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
          // Try to access the popup's location
          // This will throw an error if it's on a different origin (Dropbox)
          // But will work when it redirects back to our callback URL
          const popupUrl = authWindow.location.href;
          
          console.log('[DropboxProvider] Successfully read popup URL:', popupUrl);
          console.log('[DropboxProvider] Popup location details:', {
            href: authWindow.location.href,
            origin: authWindow.location.origin,
            pathname: authWindow.location.pathname,
            search: authWindow.location.search
          });
          
          if (popupUrl.includes('/dropbox-oauth-callback.html')) {
            console.log('[DropboxProvider] Detected callback URL in popup');
            
            // Parse the URL to get the code
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
              console.log('[DropboxProvider] Extracted code from URL, exchanging for token');
              // Exchange code for token
              const verifier = sessionStorage.getItem('dropbox_pkce_verifier');
              
              if (!verifier) {
                resolve({
                  success: false,
                  error: 'PKCE verifier not found'
                });
                return;
              }

              this.exchangeCodeForToken(code, verifier).then(result => {
                // Clean up session storage
                sessionStorage.removeItem('dropbox_pkce_verifier');
                sessionStorage.removeItem('dropbox_auth_state');
                
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
          // Expected error when popup is on different origin (Dropbox domain)
          // Just continue polling
          console.log('[DropboxProvider] Cannot access popup URL (cross-origin), continuing to poll...', {
            errorType: e instanceof Error ? e.constructor.name : typeof e,
            errorMessage: e instanceof Error ? e.message : String(e)
          });
        }
      }, 500); // Poll every 500ms

      // Timeout after 5 minutes
      setTimeout(() => {
        console.log('[DropboxProvider] OAuth timeout reached');
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
    console.log('[DropboxProvider] Exchanging code for token');

    try {
      const params = new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        code_verifier: verifier
      });

      const response = await fetch(`${DROPBOX_AUTH_BASE}/token`, {
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

      const data = await response.json();
      
      // Calculate expiry time
      const expiresAt = new Date(Date.now() + (data.expires_in * 1000));

      // Store credentials
      await cloudCredentialManager.saveCredentials({
        provider: this.name,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt,
        scope: data.scope,
        userId: data.account_id
      });

      console.log('[DropboxProvider] Token exchange successful');

      return {
        success: true,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt
      };
    } catch (error) {
      console.error('[DropboxProvider] Token exchange error:', error);
      throw error;
    }
  }

  /**
   * Get a valid access token, refreshing if necessary
   */
  private async getValidAccessToken(): Promise<string> {
    const credentials = await cloudCredentialManager.getCredentials(this.name);
    
    if (!credentials || !credentials.accessToken) {
      throw new Error('Not authenticated with Dropbox');
    }

    // Check if token is expired or will expire soon (within 5 minutes)
    const expiryBuffer = 5 * 60 * 1000; // 5 minutes
    if (credentials.expiresAt && credentials.expiresAt.getTime() - Date.now() < expiryBuffer) {
      console.log('[DropboxProvider] Token expired or expiring soon, refreshing');
      
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
    console.log('[DropboxProvider] Refreshing access token');

    try {
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret
      });

      const response = await fetch(`${DROPBOX_AUTH_BASE}/token`, {
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

      const data = await response.json();
      
      // Calculate expiry time
      const expiresAt = new Date(Date.now() + (data.expires_in * 1000));

      // Update stored credentials
      await cloudCredentialManager.updateCredentials(this.name, {
        accessToken: data.access_token,
        expiresAt
      });

      console.log('[DropboxProvider] Token refreshed successfully');

      return data.access_token;
    } catch (error) {
      console.error('[DropboxProvider] Token refresh error:', error);
      throw error;
    }
  }

  /**
   * Revoke access token
   */
  private async revokeToken(accessToken: string): Promise<void> {
    console.log('[DropboxProvider] Revoking token');

    try {
      const response = await fetch(`${DROPBOX_API_BASE}/auth/token/revoke`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error(`Token revocation failed: ${response.status}`);
      }

      console.log('[DropboxProvider] Token revoked successfully');
    } catch (error) {
      console.error('[DropboxProvider] Token revocation error:', error);
      throw error;
    }
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
      if (error.status === 409) {
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
      console.error('[DropboxProvider] API error:', {
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
