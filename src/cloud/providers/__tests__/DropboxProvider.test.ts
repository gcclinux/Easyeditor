/**
 * Tests for DropboxProvider
 */

import { DropboxProvider } from '../DropboxProvider';
import { cloudCredentialManager } from '../../managers/CloudCredentialManager';

// Mock LicenseManager
jest.mock('../../../premium/LicenseManager', () => ({
  __esModule: true,
  default: {
    hasActiveLicense: jest.fn(() => true)
  }
}));

// Mock the credential manager
jest.mock('../../managers/CloudCredentialManager', () => ({
  cloudCredentialManager: {
    getCredentials: jest.fn(),
    saveCredentials: jest.fn(),
    removeCredentials: jest.fn(),
    updateCredentials: jest.fn()
  }
}));

// Mock fetch
global.fetch = jest.fn();

describe('DropboxProvider', () => {
  let provider: DropboxProvider;

  beforeEach(() => {
    provider = new DropboxProvider();
    jest.clearAllMocks();
  });

  describe('Provider Constants', () => {
    it('should have correct provider name', () => {
      expect(provider.name).toBe('dropbox');
    });

    it('should have correct display name', () => {
      expect(provider.displayName).toBe('Dropbox');
    });

    it('should have correct icon', () => {
      expect(provider.icon).toBe('📦');
    });
  });

  describe('isAuthenticated', () => {
    it('should return false when no credentials exist', async () => {
      (cloudCredentialManager.getCredentials as jest.Mock).mockResolvedValue(null);

      const result = await provider.isAuthenticated();

      expect(result).toBe(false);
      expect(cloudCredentialManager.getCredentials).toHaveBeenCalledWith('dropbox');
    });

    it('should return false when credentials have no access token', async () => {
      (cloudCredentialManager.getCredentials as jest.Mock).mockResolvedValue({
        provider: 'dropbox',
        accessToken: '',
        scope: 'files.content.write files.content.read'
      });

      const result = await provider.isAuthenticated();

      expect(result).toBe(false);
    });

    it('should return true when valid credentials exist', async () => {
      const futureDate = new Date(Date.now() + 3600000); // 1 hour from now
      (cloudCredentialManager.getCredentials as jest.Mock).mockResolvedValue({
        provider: 'dropbox',
        accessToken: 'valid-token',
        expiresAt: futureDate,
        scope: 'files.content.write files.content.read'
      });

      const result = await provider.isAuthenticated();

      expect(result).toBe(true);
    });

    it('should return false when credentials are expired', async () => {
      const pastDate = new Date(Date.now() - 3600000); // 1 hour ago
      (cloudCredentialManager.getCredentials as jest.Mock).mockResolvedValue({
        provider: 'dropbox',
        accessToken: 'expired-token',
        expiresAt: pastDate,
        refreshToken: undefined,
        scope: 'files.content.write files.content.read'
      });

      const result = await provider.isAuthenticated();

      expect(result).toBe(false);
    });
  });

  describe('disconnect', () => {
    it('should remove credentials when disconnecting', async () => {
      (cloudCredentialManager.getCredentials as jest.Mock).mockResolvedValue({
        provider: 'dropbox',
        accessToken: 'test-token',
        scope: 'files.content.write files.content.read'
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({})
      });

      await provider.disconnect();

      expect(cloudCredentialManager.removeCredentials).toHaveBeenCalledWith('dropbox');
    });

    it('should remove credentials even if token revocation fails', async () => {
      (cloudCredentialManager.getCredentials as jest.Mock).mockResolvedValue({
        provider: 'dropbox',
        accessToken: 'test-token',
        scope: 'files.content.write files.content.read'
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      });

      await provider.disconnect();

      expect(cloudCredentialManager.removeCredentials).toHaveBeenCalledWith('dropbox');
    });
  });

  describe('File Operations', () => {
    beforeEach(() => {
      const futureDate = new Date(Date.now() + 3600000);
      (cloudCredentialManager.getCredentials as jest.Mock).mockResolvedValue({
        provider: 'dropbox',
        accessToken: 'valid-token',
        expiresAt: futureDate,
        scope: 'files.content.write files.content.read'
      });
    });

    describe('listFiles', () => {
      it('should list markdown files from folder', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: async () => ({
            entries: [
              {
                '.tag': 'file',
                name: 'note1.md',
                id: 'id:123',
                path_display: '/Easyeditor/note1.md',
                server_modified: '2024-01-15T10:00:00Z',
                size: 1024
              },
              {
                '.tag': 'file',
                name: 'note2.md',
                id: 'id:456',
                path_display: '/Easyeditor/note2.md',
                server_modified: '2024-01-15T11:00:00Z',
                size: 2048
              },
              {
                '.tag': 'file',
                name: 'document.txt',
                id: 'id:789',
                path_display: '/Easyeditor/document.txt',
                server_modified: '2024-01-15T12:00:00Z',
                size: 512
              }
            ],
            cursor: 'cursor-123',
            has_more: false
          })
        });

        const files = await provider.listFiles('/Easyeditor');

        expect(files).toHaveLength(2); // Only .md files
        expect(files[0].name).toBe('note1.md');
        expect(files[0].id).toBe('/Easyeditor/note1.md');
        expect(files[0].size).toBe(1024);
        expect(files[1].name).toBe('note2.md');
      });

      it('should filter out non-markdown files', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: async () => ({
            entries: [
              {
                '.tag': 'file',
                name: 'document.txt',
                id: 'id:123',
                path_display: '/Easyeditor/document.txt',
                server_modified: '2024-01-15T10:00:00Z',
                size: 512
              },
              {
                '.tag': 'folder',
                name: 'subfolder',
                id: 'id:456',
                path_display: '/Easyeditor/subfolder'
              }
            ],
            cursor: 'cursor-123',
            has_more: false
          })
        });

        const files = await provider.listFiles('/Easyeditor');

        expect(files).toHaveLength(0);
      });
    });

    describe('downloadFile', () => {
      it('should download file content', async () => {
        const fileContent = '# My Note\n\nThis is the content.';
        
        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          text: async () => fileContent
        });

        const content = await provider.downloadFile('/Easyeditor/note.md');

        expect(content).toBe(fileContent);
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('content.dropboxapi.com'),
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Authorization': 'Bearer valid-token',
              'Dropbox-API-Arg': JSON.stringify({ path: '/Easyeditor/note.md' })
            })
          })
        );
      });
    });

    describe('uploadFile', () => {
      it('should upload new file', async () => {
        const fileContent = '# New Note\n\nContent here.';
        
        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: async () => ({
            name: 'new-note.md',
            id: 'id:123',
            path_display: '/Easyeditor/new-note.md',
            server_modified: '2024-01-15T10:00:00Z',
            size: fileContent.length
          })
        });

        const result = await provider.uploadFile('/Easyeditor', 'new-note.md', fileContent);

        expect(result.name).toBe('new-note.md');
        expect(result.id).toBe('/Easyeditor/new-note.md');
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('content.dropboxapi.com'),
          expect.objectContaining({
            method: 'POST',
            body: fileContent
          })
        );
      });
    });

    describe('updateFile', () => {
      it('should update existing file', async () => {
        const updatedContent = '# Updated Note\n\nNew content.';
        
        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: async () => ({
            name: 'note.md',
            id: 'id:123',
            path_display: '/Easyeditor/note.md',
            server_modified: '2024-01-15T11:00:00Z',
            size: updatedContent.length
          })
        });

        const result = await provider.updateFile('/Easyeditor/note.md', updatedContent);

        expect(result.name).toBe('note.md');
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('content.dropboxapi.com'),
          expect.objectContaining({
            method: 'POST',
            body: updatedContent,
            headers: expect.objectContaining({
              'Dropbox-API-Arg': expect.stringContaining('"mode":"overwrite"')
            })
          })
        );
      });
    });

    describe('deleteFile', () => {
      it('should delete file', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: async () => ({
            metadata: {
              '.tag': 'file',
              name: 'note.md',
              path_display: '/Easyeditor/note.md'
            }
          })
        });

        await provider.deleteFile('/Easyeditor/note.md');

        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('api.dropboxapi.com'),
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ path: '/Easyeditor/note.md' })
          })
        );
      });
    });
  });

  describe('createApplicationFolder', () => {
    beforeEach(() => {
      const futureDate = new Date(Date.now() + 3600000);
      (cloudCredentialManager.getCredentials as jest.Mock).mockResolvedValue({
        provider: 'dropbox',
        accessToken: 'valid-token',
        expiresAt: futureDate,
        scope: 'files.content.write files.content.read'
      });
    });

    it('should create new application folder', async () => {
      // First call to check if folder exists (returns 409 not found)
      // Second call to create folder
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 409,
          json: async () => ({ error: { '.tag': 'path', 'path': { '.tag': 'not_found' } } }),
          text: async () => JSON.stringify({ error: { '.tag': 'path', 'path': { '.tag': 'not_found' } } })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            metadata: {
              '.tag': 'folder',
              name: 'Easyeditor',
              id: 'id:folder123',
              path_display: '/Easyeditor'
            }
          })
        });

      const folderId = await provider.createApplicationFolder();

      expect(folderId).toBe('/Easyeditor');
    });

    it('should use existing folder if it already exists', async () => {
      // First call finds existing folder
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          '.tag': 'folder',
          name: 'Easyeditor',
          id: 'id:folder123',
          path_display: '/Easyeditor'
        })
      });

      const folderId = await provider.createApplicationFolder();

      expect(folderId).toBe('/Easyeditor');
      // Should only call once to check, not create
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });
});
