/**
 * LocalLibraryProvider - Implementation of CloudProvider interface for persistent Local Library
 * Supports Tauri (desktop filesystem), Web, and Docker (File System Access API + IndexedDB persistence)
 */

import type { CloudProvider, CloudFile, AuthResult } from '../interfaces';
import { isTauriEnvironment } from '../../utils/environment';
import { openDirectoryDialog, readDirectory, readFileContent, writeTauriFile } from '../../tauriFileHandler';
import { createLogger } from '../../utils/logger';

const logger = createLogger('LocalLibraryProvider');

const STORAGE_KEY_PATH = 'easynotes_locallibrary_path';
const STORAGE_KEY_NAME = 'easynotes_locallibrary_name';
const DB_NAME = 'EasyEditorDB';
const DB_VERSION = 1;
const STORE_NAME = 'handles';
const HANDLE_KEY = 'locallibrary_handle';

// IndexedDB Helper functions for Web & Docker directory handles
const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB is not supported in this environment'));
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const saveHandleToIDB = async (handle: FileSystemDirectoryHandle): Promise<void> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(handle, HANDLE_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    logger.warn('Failed to save directory handle to IndexedDB:', err);
  }
};

const getHandleFromIDB = async (): Promise<FileSystemDirectoryHandle | null> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(HANDLE_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    logger.warn('Failed to retrieve directory handle from IndexedDB:', err);
    return null;
  }
};

const removeHandleFromIDB = async (): Promise<void> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(HANDLE_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    logger.warn('Failed to delete directory handle from IndexedDB:', err);
  }
};

export class LocalLibraryProvider implements CloudProvider {
  readonly name = 'locallibrary';
  readonly displayName = 'Local Library';
  readonly icon = '📁';

  private webDirHandle: FileSystemDirectoryHandle | null = null;

  constructor() {
    // Attempt to load existing web handle if in web environment
    if (!isTauriEnvironment() && typeof window !== 'undefined') {
      getHandleFromIDB().then(handle => {
        if (handle) {
          this.webDirHandle = handle;
        }
      }).catch(err => {
        logger.warn('Could not restore Web directory handle on init:', err);
      });
    }
  }

  /**
   * Get configured local library path or directory name
   */
  getStoredPath(): string | null {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(STORAGE_KEY_PATH);
    }
    return null;
  }

  /**
   * Get configured custom library name
   */
  getStoredName(): string | null {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(STORAGE_KEY_NAME);
    }
    return null;
  }

  /**
   * Configure a local library folder (triggers folder picker UI)
   */
  async configure(customName?: string): Promise<boolean> {
    try {
      if (typeof localStorage !== 'undefined') {
        if (customName) {
          localStorage.setItem(STORAGE_KEY_NAME, customName);
        } else {
          localStorage.removeItem(STORAGE_KEY_NAME);
        }
      }
      if (isTauriEnvironment()) {
        const path = await openDirectoryDialog();
        if (path) {
          localStorage.setItem(STORAGE_KEY_PATH, path);
          logger.log('Configured Tauri local library path:', path);
          return true;
        }
        return false;
      } else {
        if (!('showDirectoryPicker' in window)) {
          throw new Error('Directory picker is not supported in this browser');
        }
        const handle: FileSystemDirectoryHandle = await (window as any).showDirectoryPicker({
          mode: 'readwrite'
        });
        if (handle) {
          this.webDirHandle = handle;
          await saveHandleToIDB(handle);
          localStorage.setItem(STORAGE_KEY_PATH, handle.name);
          logger.log('Configured Web local library directory handle:', handle.name);
          return true;
        }
        return false;
      }
    } catch (error) {
      logger.error('Failed to configure local library:', error);
      return false;
    }
  }

  async authenticate(customName?: string): Promise<AuthResult> {
    const isAuth = await this.isAuthenticated();
    if (isAuth && !customName) {
      return { success: true };
    }
    const configured = await this.configure(customName);
    return {
      success: configured,
      error: configured ? undefined : 'Local Library configuration cancelled or failed'
    };
  }

  async isAuthenticated(): Promise<boolean> {
    if (isTauriEnvironment()) {
      const path = this.getStoredPath();
      return !!path;
    } else {
      if (this.webDirHandle) return true;
      const handle = await getHandleFromIDB();
      if (handle) {
        this.webDirHandle = handle;
        return true;
      }
      return !!this.getStoredPath();
    }
  }

  async disconnect(): Promise<void> {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY_PATH);
      localStorage.removeItem(STORAGE_KEY_NAME);
    }
    if (!isTauriEnvironment()) {
      this.webDirHandle = null;
      await removeHandleFromIDB();
    }
    logger.log('Disconnected Local Library configuration');
  }

  async createApplicationFolder(): Promise<string> {
    const path = this.getStoredPath();
    return path || 'locallibrary';
  }

  /**
   * Verify and request permission for web directory handle if needed
   */
  private async verifyWebPermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
    try {
      if ((handle as any).queryPermission) {
        const status = await (handle as any).queryPermission({ mode: 'readwrite' });
        if (status === 'granted') return true;
        if ((handle as any).requestPermission) {
          const reqStatus = await (handle as any).requestPermission({ mode: 'readwrite' });
          return reqStatus === 'granted';
        }
      }
      return true;
    } catch (err) {
      logger.warn('Error checking web directory permission:', err);
      return true;
    }
  }

  private async getWebHandle(): Promise<FileSystemDirectoryHandle | null> {
    if (this.webDirHandle) {
      await this.verifyWebPermission(this.webDirHandle);
      return this.webDirHandle;
    }
    const handle = await getHandleFromIDB();
    if (handle) {
      this.webDirHandle = handle;
      await this.verifyWebPermission(handle);
      return handle;
    }
    return null;
  }

  async listFiles(_folderId?: string): Promise<CloudFile[]> {
    const files: CloudFile[] = [];

    if (isTauriEnvironment()) {
      const folderPath = this.getStoredPath();
      if (!folderPath) return [];

      const relativeFiles = await readDirectory(folderPath);
      for (const relPath of relativeFiles) {
        const fullPath = `${folderPath}/${relPath}`.replace(/\/+/g, '/');
        const name = relPath.split(/[/\\]/).pop() || relPath;
        files.push({
          id: relPath,
          name: name,
          modifiedTime: new Date(),
          size: 1024,
          mimeType: name.endsWith('.sstp') ? 'application/octet-stream' : 'text/markdown'
        });
      }
    } else {
      const handle = await this.getWebHandle();
      if (!handle) return [];

      for await (const entry of (handle as any).values()) {
        if (entry.kind === 'file') {
          const name = entry.name;
          if (name.endsWith('.md') || name.endsWith('.markdown') || name.endsWith('.txt') || name.endsWith('.sstp')) {
            try {
              const fileObj = await entry.getFile();
              files.push({
                id: name,
                name: name,
                modifiedTime: new Date(fileObj.lastModified),
                size: fileObj.size,
                mimeType: name.endsWith('.sstp') ? 'application/octet-stream' : 'text/markdown'
              });
            } catch (e) {
              logger.warn(`Could not read stat for ${name}:`, e);
              files.push({
                id: name,
                name: name,
                modifiedTime: new Date(),
                size: 0,
                mimeType: 'text/markdown'
              });
            }
          }
        }
      }
    }

    return files;
  }

  async downloadFile(fileId: string): Promise<string | Uint8Array> {
    if (isTauriEnvironment()) {
      const folderPath = this.getStoredPath();
      if (!folderPath) throw new Error('Local library path not configured');

      const fullPath = `${folderPath}/${fileId}`.replace(/\/+/g, '/');
      const content = await readFileContent(fullPath);
      if (content === null) throw new Error(`Failed to read file: ${fileId}`);
      return content;
    } else {
      const handle = await this.getWebHandle();
      if (!handle) throw new Error('Local library directory handle not available');

      const fileHandle = await handle.getFileHandle(fileId);
      const fileObj = await fileHandle.getFile();
      return await fileObj.text();
    }
  }

  async uploadFile(_folderId: string, fileName: string, content: string | Uint8Array): Promise<CloudFile> {
    const textContent = typeof content === 'string' ? content : new TextDecoder().decode(content);

    if (isTauriEnvironment()) {
      const folderPath = this.getStoredPath();
      if (!folderPath) throw new Error('Local library path not configured');

      const fullPath = `${folderPath}/${fileName}`.replace(/\/+/g, '/');
      const success = await writeTauriFile(fullPath, textContent);
      if (!success) throw new Error(`Failed to write file: ${fileName}`);

      return {
        id: fileName,
        name: fileName,
        modifiedTime: new Date(),
        size: new TextEncoder().encode(textContent).length,
        mimeType: fileName.endsWith('.sstp') ? 'application/octet-stream' : 'text/markdown'
      };
    } else {
      const handle = await this.getWebHandle();
      if (!handle) throw new Error('Local library directory handle not available');

      const fileHandle = await handle.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(textContent);
      await writable.close();

      return {
        id: fileName,
        name: fileName,
        modifiedTime: new Date(),
        size: new TextEncoder().encode(textContent).length,
        mimeType: fileName.endsWith('.sstp') ? 'application/octet-stream' : 'text/markdown'
      };
    }
  }

  async updateFile(fileId: string, content: string | Uint8Array): Promise<CloudFile> {
    return this.uploadFile('', fileId, content);
  }

  async deleteFile(fileId: string): Promise<void> {
    if (isTauriEnvironment()) {
      const folderPath = this.getStoredPath();
      if (!folderPath) throw new Error('Local library path not configured');

      const fullPath = `${folderPath}/${fileId}`.replace(/\/+/g, '/');
      const { remove } = await import('@tauri-apps/plugin-fs');
      await remove(fullPath);
    } else {
      const handle = await this.getWebHandle();
      if (!handle) throw new Error('Local library directory handle not available');

      await handle.removeEntry(fileId);
    }
  }
}
