/**
 * SimpleGoogleDriveProvider - Simplified Google Drive implementation
 * Uses manual token input to bypass OAuth popup issues
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

export class SimpleGoogleDriveProvider implements CloudProvider {
  readonly name = 'googledrive';
  readonly displayName = 'Google Drive';
  readonly icon = '🗂️';
  
  private clientId: string;
  private apiKey: string;
  private scope: string = 'https://www.googleapis.com/auth/drive.file';
  
  constructor(clientId?: string, apiKey?: string) {
    this.clientId = clientId || GOOGLE_DRIVE_CONFIG.CLIENT_ID;
    this.apiKey = apiKey || GOOGLE_DRIVE_CONFIG.API_KEY;
    this.scope = GOOGLE_DRIVE_CONFIG.SCOPES.join(' ');
    
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
      console.log('[SimpleGoogleDriveProvider] Starting simplified authentication...');
      
      // Validate configuration before attempting authentication
      const validation = validateGoogleDriveConfiguration();
      if (!validation.isValid) {
        const error = getConfigurationErrorMessage();
        console.error('[SimpleGoogleDriveProvider] Configuration validation failed:', validation);
        cloudToastService.showConfigurationMessage(this.displayName, false);
        return {
          success: false,
          error
        };
      }

      console.log('[SimpleGoogleDriveProvider] Configuration valid');

      return await ErrorHandler.withRetry(async () => {
        // For now, create a manual token input method
        const accessToken = await this.getAccessTokenManually();
        
        if (!accessToken) {
          throw new Error('No access token provided');
        }

        // Test the token by making a simple API call
        const isValid = await this.testAccessToken(accessToken);
        if (!isValid) {
          throw new Error('Invalid access token');
        }
        
        const result: AuthResult = {
          success: true,
          accessToken: accessToken,
          expiresAt: new Date(Date.now() + 3600000) // 1 hour from now
        };

        // Save credentials
        await this.saveCredentials(result);
        console.log('[SimpleGoogleDriveProvider] Authentication completed and credentials saved');
        return result;
      },
      { operation: 'authenticate', provider: this.name },
      { maxRetries: 1 }
      );
      
    } catch (error) {
      console.error('[SimpleGoogleDriveProvider] Authentication failed:', error);
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

  private async getAccessTokenManually(): Promise<string | null> {
    // For now, return a prompt-based token input
    // In a real implementation, this would open a modal or redirect to a manual auth page
    const token = prompt(`
Google Drive OAuth is having issues with popups.

To get an access token manually:
1. Go to: https://developers.google.com/oauthplayground/
2. In "Step 1", find "Drive API v3" and select "https://www.googleapis.com/auth/drive.file"
3. Click "Authorize APIs" and sign in with your Google account
4. In "Step 2", click "Exchange authorization code for tokens"
5. Copy the "Access token" value and paste it here:
    `);
    
    return token?.trim() || null;
  }

  private async testAccessToken(accessToken: string): Promise<boolean> {
    try {
      const response = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        }
      });
      
      return response.ok;
    } catch (error) {
      console.error('Error testing access token:', error);
      return false;
    }
  }
  
  async isAuthenticated(): Promise<boolean> {
    try {
      const credentials = await cloudCredentialManager.getCredentials(this.name);
      if (!credentials) {
        return false;
      }

      // Check if credentials are expired
      if (credentials.expiresAt && credentials.expiresAt <= new Date()) {
        return false; // Token expired
      }

      return true;
      
    } catch (error) {
      console.error('Error checking authentication status:', error);
      return false;
    }
  }
  
  async disconnect(): Promise<void> {
    try {
      // Remove stored credentials
      await cloudCredentialManager.removeCredentials(this.name);
      
    } catch (error) {
      console.error('Error during disconnect:', error);
      // Still remove credentials even if other cleanup fails
      await cloudCredentialManager.removeCredentials(this.name);
    }
  }
  
  // All the file operation methods remain the same as the original GoogleDriveProvider
  async createApplicationFolder(): Promise<string> {
    try {
      console.log('[SimpleGoogleDriveProvider] Creating application folder...');
      const accessToken = await this.getValidAccessToken();
      
      // Check if EasyEditor folder already exists
      const existingFolder = await this.findApplicationFolder();
      if (existingFolder) {
        console.log('[SimpleGoogleDriveProvider] Found existing folder:', existingFolder);
        return existingFolder;
      }

      console.log('[SimpleGoogleDriveProvider] No existing folder found, creating new one...');
      
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

      console.log('[SimpleGoogleDriveProvider] Create folder response:', response);

      if (!response.id) {
        throw new Error('Failed to create application folder - no ID returned');
      }

      console.log('[SimpleGoogleDriveProvider] Successfully created folder with ID:', response.id);
      return response.id;
      
    } catch (error) {
      console.error('[SimpleGoogleDriveProvider] Error creating application folder:', error);
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

      console.log(`[SimpleGoogleDriveProvider] Raw files from API: ${allFiles.length}`, allFiles.map(f => `${f.name} (${f.mimeType})`));

      // Filter to only include .md and .sstp files by extension
      const filtered = allFiles.filter(file => /\.(md|sstp)$/i.test(file.name));
      console.log(`[SimpleGoogleDriveProvider] After extension filter: ${filtered.length} files`);

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
  
  async downloadFile(fileId: string): Promise<string> {
    try {
      const accessToken = await this.getValidAccessToken();
      
      const response = await this.makeApiCall(`/drive/v3/files/${fileId}?alt=media`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        }
      });

      if (typeof response === 'string') {
        return response;
      }
      
      throw new Error('Invalid file content received');
      
    } catch (error) {
      throw new Error(`Failed to download file: ${(error as Error).message}`);
    }
  }
  
  async uploadFile(folderId: string, fileName: string, content: string): Promise<CloudFile> {
    try {
      const accessToken = await this.getValidAccessToken();
      
      const finalFileName = fileName.endsWith('.md') ? fileName : `${fileName}.md`;
      
      const metadata = {
        name: finalFileName,
        parents: [folderId],
        mimeType: 'text/markdown'
      };

      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', new Blob([content], { type: 'text/markdown' }));

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
        size: parseInt(response.size) || content.length,
        mimeType: response.mimeType
      };
      
    } catch (error) {
      throw new Error(`Failed to upload file: ${(error as Error).message}`);
    }
  }
  
  async updateFile(fileId: string, content: string): Promise<CloudFile> {
    try {
      const accessToken = await this.getValidAccessToken();
      
      const response = await this.makeApiCall(`/upload/drive/v3/files/${fileId}?uploadType=media&fields=id,name,modifiedTime,size,mimeType`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'text/markdown',
        },
        body: content
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
  
  // Helper methods (same as original GoogleDriveProvider)
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
      throw error;
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    } else {
      return await response.text();
    }
  }
  
  private async getValidAccessToken(): Promise<string> {
    const credentials = await cloudCredentialManager.getCredentials(this.name);
    
    if (!credentials) {
      throw new Error('No credentials found. Please authenticate first.');
    }

    if (credentials.expiresAt && credentials.expiresAt <= new Date()) {
      throw new Error('Access token expired. Please re-authenticate.');
    }

    return credentials.accessToken;
  }
  
  private async saveCredentials(authResult: AuthResult): Promise<void> {
    if (!authResult.success || !authResult.accessToken) {
      return;
    }

    await cloudCredentialManager.saveCredentials({
      provider: this.name,
      accessToken: authResult.accessToken,
      refreshToken: authResult.refreshToken,
      expiresAt: authResult.expiresAt,
      scope: this.scope
    });
  }
  
  private async findApplicationFolder(): Promise<string | null> {
    try {
      console.log('[SimpleGoogleDriveProvider] Searching for existing Easyeditor folder...');
      const accessToken = await this.getValidAccessToken();
      
      const response: GoogleDriveResponse = await this.makeApiCall(
        "/drive/v3/files?q=name='Easyeditor' and mimeType='application/vnd.google-apps.folder' and parents in 'root' and trashed=false&fields=files(id,name)",
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          }
        }
      );

      console.log('[SimpleGoogleDriveProvider] Search response:', response);

      if (response.files && response.files.length > 0) {
        console.log('[SimpleGoogleDriveProvider] Found existing folder:', response.files[0]);
        return response.files[0].id;
      }

      console.log('[SimpleGoogleDriveProvider] No existing folder found');
      return null;
      
    } catch (error) {
      console.error('[SimpleGoogleDriveProvider] Error finding application folder:', error);
      return null;
    }
  }
}
