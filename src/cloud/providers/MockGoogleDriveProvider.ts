/**
 * MockGoogleDriveProvider - Temporary mock implementation for testing
 * This bypasses OAuth and creates fake credentials so we can test the note functionality
 */

import type { CloudProvider, CloudFile, AuthResult } from '../interfaces';
import { cloudCredentialManager } from '../managers/CloudCredentialManager';

export class MockGoogleDriveProvider implements CloudProvider {
  readonly name = 'googledrive';
  readonly displayName = 'Google Drive (Mock)';
  readonly icon = '🗂️';

  async authenticate(): Promise<AuthResult> {
    console.log('[MockGoogleDriveProvider] Mock authentication - always succeeds');

    // Create fake credentials
    const fakeCredentials = {
      provider: this.name,
      accessToken: 'fake-access-token-' + Date.now(),
      expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
      scope: 'https://www.googleapis.com/auth/drive'
    };

    // Save the fake credentials
    await cloudCredentialManager.saveCredentials(fakeCredentials);

    return {
      success: true,
      accessToken: fakeCredentials.accessToken,
      expiresAt: fakeCredentials.expiresAt
    };
  }

  async isAuthenticated(): Promise<boolean> {
    console.log('[MockGoogleDriveProvider] Checking mock authentication');
    const credentials = await cloudCredentialManager.getCredentials(this.name);
    return credentials !== null;
  }

  async disconnect(): Promise<void> {
    console.log('[MockGoogleDriveProvider] Mock disconnect');
    await cloudCredentialManager.removeCredentials(this.name);
  }

  async createApplicationFolder(): Promise<string> {
    console.log('[MockGoogleDriveProvider] Creating mock application folder');
    // Return a fake folder ID
    return 'mock-folder-id-' + Date.now();
  }

  async listFiles(folderId: string): Promise<CloudFile[]> {
    console.log('[MockGoogleDriveProvider] Listing mock files in folder:', folderId);
    // Return some fake files for testing
    return [
      {
        id: 'mock-file-1',
        name: 'Test Note 1.md',
        modifiedTime: new Date(),
        size: 1024,
        mimeType: 'text/markdown'
      },
      {
        id: 'mock-file-2',
        name: 'Test Note 2.md',
        modifiedTime: new Date(Date.now() - 86400000), // 1 day ago
        size: 2048,
        mimeType: 'text/markdown'
      },
      {
        id: 'mock-file-3',
        name: 'Encrypted Note.sstp',
        modifiedTime: new Date(),
        size: 3072,
        mimeType: 'application/octet-stream'
      }
    ];
  }

  async downloadFile(fileId: string): Promise<string | Uint8Array> {
    console.log('[MockGoogleDriveProvider] Downloading mock file:', fileId);

    // Simulate finding the file (in reality we would lookup in listFiles response)
    if (fileId === 'mock-file-3') {
      const encoder = new TextEncoder();
      return encoder.encode('MOCK-ENCRYPTED-CONTENT');
    }

    // Return fake markdown content
    return `# Mock Note Content\n\nThis is a mock note with ID: ${fileId}\n\nCreated at: ${new Date().toISOString()}`;
  }

  async uploadFile(folderId: string, fileName: string, content: string | Uint8Array): Promise<CloudFile> {
    console.log('[MockGoogleDriveProvider] Uploading mock file:', fileName, 'to folder:', folderId);

    // Simulate upload delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Return fake file metadata
    return {
      id: 'mock-file-' + Date.now(),
      name: fileName.endsWith('.md') ? fileName : fileName + '.md',
      modifiedTime: new Date(),
      size: typeof content === 'string' ? content.length : content.byteLength,
      mimeType: typeof content === 'string' ? 'text/markdown' : 'application/octet-stream'
    };
  }

  async updateFile(fileId: string, content: string | Uint8Array): Promise<CloudFile> {
    console.log('[MockGoogleDriveProvider] Updating mock file:', fileId);

    // Simulate update delay
    await new Promise(resolve => setTimeout(resolve, 300));

    // Return fake updated file metadata
    return {
      id: fileId,
      name: 'Updated Note.md',
      modifiedTime: new Date(),
      size: typeof content === 'string' ? content.length : content.byteLength,
      mimeType: typeof content === 'string' ? 'text/markdown' : 'application/octet-stream'
    };
  }

  async deleteFile(fileId: string): Promise<void> {
    console.log('[MockGoogleDriveProvider] Deleting mock file:', fileId);

    // Simulate delete delay
    await new Promise(resolve => setTimeout(resolve, 200));
  }
}