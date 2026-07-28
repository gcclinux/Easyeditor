/**
 * LocalLibraryProvider - Implementation of CloudProvider interface for persistent Local Libraries
 * Supports multiple local libraries across Tauri, Web, and Docker environments.
 */

import type { CloudProvider, CloudFile, AuthResult } from '../interfaces';
import { isTauriEnvironment } from '../../utils/environment';
import { openDirectoryDialog, readDirectory, readFileContent, writeTauriFile } from '../../tauriFileHandler';
import { createLogger } from '../../utils/logger';

const logger = createLogger('LocalLibraryProvider');

const STORAGE_KEY_LIBRARIES = 'easynotes_local_libraries';
const LEGACY_STORAGE_KEY_PATH = 'easynotes_locallibrary_path';
const LEGACY_STORAGE_KEY_NAME = 'easynotes_locallibrary_name';
const DB_NAME = 'EasyEditorDB';
const DB_VERSION = 1;
const STORE_NAME = 'handles';

export interface LocalLibraryConfig {
  id: string;
  name: string;
  path: string;
  createdAt: string;
}

export interface ExtendedCloudFile extends CloudFile {
  libraryId?: string;
  libraryName?: string;
}

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

const saveHandleToIDB = async (libraryId: string, handle: FileSystemDirectoryHandle): Promise<void> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(handle, `locallibrary_handle_${libraryId}`);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    logger.warn(`Failed to save directory handle for library ${libraryId} to IndexedDB:`, err);
  }
};

const getHandleFromIDB = async (libraryId: string): Promise<FileSystemDirectoryHandle | null> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(`locallibrary_handle_${libraryId}`);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    logger.warn(`Failed to retrieve directory handle for library ${libraryId} from IndexedDB:`, err);
    return null;
  }
};

const removeHandleFromIDB = async (libraryId: string): Promise<void> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(`locallibrary_handle_${libraryId}`);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    logger.warn(`Failed to delete directory handle for library ${libraryId} from IndexedDB:`, err);
  }
};

export interface StoredWebFile {
  name: string;
  content: string;
  modifiedTime: string;
  size: number;
  libraryId: string;
}

const saveWebFilesToIDB = async (libraryId: string, files: StoredWebFile[]): Promise<void> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(files, `web_files_${libraryId}`);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    logger.warn(`Failed to save web files for library ${libraryId} to IndexedDB:`, err);
  }
};

const getWebFilesFromIDB = async (libraryId: string): Promise<StoredWebFile[]> => {
  try {
    const db = await initDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(`web_files_${libraryId}`);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch (err) {
    return [];
  }
};

const removeWebFilesFromIDB = async (libraryId: string): Promise<void> => {
  try {
    const db = await initDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(`web_files_${libraryId}`);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch (err) {
    logger.warn(`Failed to remove web files for library ${libraryId} from IndexedDB:`, err);
  }
};

export class LocalLibraryProvider implements CloudProvider {
  readonly name = 'locallibrary';
  readonly displayName = 'Local Library';
  readonly icon = '📁';

  private webDirHandles: Map<string, FileSystemDirectoryHandle> = new Map();

  constructor() {
    this.migrateLegacyConfig();
  }

  /**
   * Helper function for browser folder selection using File System Access API.
   * showDirectoryPicker gives BOTH read AND write access so files are saved to disk.
   * The browser shows its permission dialog once when picking the folder — this is unavoidable
   * for write access, but the handle is stored in IndexedDB so it's not needed again.
   */
  private async selectDirectoryViaWebInput(): Promise<{ folderName: string; files: StoredWebFile[]; handle?: FileSystemDirectoryHandle } | null> {
    if (typeof window === 'undefined') return null;

    // Use File System Access API if available (Chrome 86+, Edge 86+)
    if ('showDirectoryPicker' in window) {
      try {
        const handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
        const folderName = handle.name || 'Local Library';
        const processedFiles: StoredWebFile[] = [];

        // Read existing files from the directory
        for await (const entry of (handle as any).values()) {
          if (entry.kind === 'file') {
            const name: string = entry.name;
            if (name.endsWith('.md') || name.endsWith('.markdown') || name.endsWith('.txt') || name.endsWith('.sstp')) {
              try {
                const fileObj: File = await entry.getFile();
                const content = await fileObj.text();
                processedFiles.push({
                  name,
                  content,
                  modifiedTime: new Date(fileObj.lastModified).toISOString(),
                  size: fileObj.size,
                  libraryId: ''
                });
              } catch (e) {
                logger.warn('Could not read file during folder scan:', name, e);
              }
            }
          }
        }

        return { folderName, files: processedFiles, handle };
      } catch (err: any) {
        // User cancelled the picker
        if (err?.name === 'AbortError') return null;
        logger.warn('showDirectoryPicker failed, falling back to webkitdirectory:', err);
      }
    }

    // Fallback: webkitdirectory (read-only — files stored in IndexedDB only)
    return new Promise((resolve) => {
      if (typeof document === 'undefined') { resolve(null); return; }
      const input = document.createElement('input');
      input.type = 'file';
      (input as any).webkitdirectory = true;
      (input as any).directory = true;

      input.onchange = async (e) => {
        const fileList = (e.target as HTMLInputElement).files;
        if (!fileList || fileList.length === 0) {
          const inputValue = (e.target as HTMLInputElement).value || '';
          const folderName = inputValue
            ? inputValue.replace(/\\/g, '/').split('/').filter(Boolean).pop() || 'Local Library'
            : 'Local Library';
          resolve({ folderName, files: [] });
          return;
        }
        const filesArray = Array.from(fileList);
        const firstPath = filesArray[0].webkitRelativePath || filesArray[0].name;
        const folderName = firstPath.split('/')[0] || 'Local Library';
        const processedFiles: StoredWebFile[] = [];
        for (const file of filesArray) {
          const name = file.name;
          if (name.endsWith('.md') || name.endsWith('.markdown') || name.endsWith('.txt') || name.endsWith('.sstp')) {
            const relPath = file.webkitRelativePath
              ? file.webkitRelativePath.split('/').slice(1).join('/')
              : file.name;
            const content = await file.text();
            processedFiles.push({
              name: relPath || file.name,
              content,
              modifiedTime: new Date(file.lastModified).toISOString(),
              size: file.size,
              libraryId: ''
            });
          }
        }
        resolve({ folderName, files: processedFiles });
      };
      input.oncancel = () => resolve(null);
      input.click();
    });
  }

  /**
   * Migrate legacy single library setup to new multi-library array structure
   */
  private migrateLegacyConfig(): void {
    if (typeof localStorage === 'undefined') return;
    const existing = localStorage.getItem(STORAGE_KEY_LIBRARIES);
    if (!existing) {
      const legacyPath = localStorage.getItem(LEGACY_STORAGE_KEY_PATH);
      if (legacyPath) {
        const legacyName = localStorage.getItem(LEGACY_STORAGE_KEY_NAME) || 'Local Library';
        const defaultLib: LocalLibraryConfig = {
          id: 'default',
          name: legacyName,
          path: legacyPath,
          createdAt: new Date().toISOString()
        };
        localStorage.setItem(STORAGE_KEY_LIBRARIES, JSON.stringify([defaultLib]));

        // Migrate handle in IndexedDB
        if (!isTauriEnvironment()) {
          initDB().then(db => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const req = store.get('locallibrary_handle');
            req.onsuccess = () => {
              if (req.result) {
                saveHandleToIDB('default', req.result);
              }
            };
          }).catch(err => logger.warn('Legacy handle migration error:', err));
        }
      }
    }
  }

  /**
   * Get all configured local libraries
   */
  getLibraries(): LocalLibraryConfig[] {
    if (typeof localStorage === 'undefined') return [];
    try {
      const stored = localStorage.getItem(STORAGE_KEY_LIBRARIES);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (err) {
      logger.error('Failed to parse local libraries from storage:', err);
    }
    return [];
  }

  /**
   * Save libraries array to localStorage
   */
  private saveLibraries(libraries: LocalLibraryConfig[]): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_LIBRARIES, JSON.stringify(libraries));
    }
  }

  /**
   * Add a new Local Library
   */
  async addLibrary(customName?: string, initialFiles?: StoredWebFile[]): Promise<LocalLibraryConfig | null> {
    try {
      const libraryId = `locallib_${Date.now()}`;

      if (isTauriEnvironment()) {
        const path = await openDirectoryDialog();
        if (!path) return null;

        const folderName = path.split(/[/\\]/).filter(Boolean).pop() || 'Local Library';
        const libName = customName && customName.trim() ? customName.trim() : folderName;

        const newLib: LocalLibraryConfig = {
          id: libraryId,
          name: libName,
          path,
          createdAt: new Date().toISOString()
        };

        const libraries = this.getLibraries();
        libraries.push(newLib);
        this.saveLibraries(libraries);
        logger.log('Added new Tauri local library:', newLib);
        return newLib;
      } else {
        // If initialFiles were provided directly (from modal drag-drop or file picker), use them
        if (initialFiles !== undefined) {
          const libName = customName && customName.trim() ? customName.trim() : 'Local Library';
          const newLib: LocalLibraryConfig = {
            id: libraryId,
            name: libName,
            path: libName,
            createdAt: new Date().toISOString()
          };
          const filesWithLibId = initialFiles.map(f => ({ ...f, libraryId }));
          await saveWebFilesToIDB(libraryId, filesWithLibId);
          const libraries = this.getLibraries();
          libraries.push(newLib);
          this.saveLibraries(libraries);
          logger.log('Added new Web local library (from modal):', newLib);
          return newLib;
        }

        // Web / Docker mode: Use File System Access API (showDirectoryPicker) for read+write access!
        const result = await this.selectDirectoryViaWebInput();
        if (!result) return null;

        const libName = customName && customName.trim() ? customName.trim() : (result.folderName || 'Local Library');
        const newLib: LocalLibraryConfig = {
          id: libraryId,
          name: libName,
          path: result.folderName,
          createdAt: new Date().toISOString()
        };

        const filesWithLibId = result.files.map(f => ({ ...f, libraryId }));
        await saveWebFilesToIDB(libraryId, filesWithLibId);

        // CRITICAL: store the writable directory handle so future saves write to disk
        if (result.handle) {
          this.webDirHandles.set(libraryId, result.handle);
          await saveHandleToIDB(libraryId, result.handle);
          logger.log('Stored writable directory handle for library:', libName);
        }

        const libraries = this.getLibraries();
        libraries.push(newLib);
        this.saveLibraries(libraries);
        logger.log('Added new Web local library:', newLib);
        return newLib;
      }
    } catch (error) {
      logger.error('Failed to add local library:', error);
      return null;
    }
  }

  /**
   * Remove a specific local library by ID
   */
  async removeLibrary(libraryId: string): Promise<void> {
    const libraries = this.getLibraries().filter(lib => lib.id !== libraryId);
    this.saveLibraries(libraries);

    if (!isTauriEnvironment()) {
      this.webDirHandles.delete(libraryId);
      await removeHandleFromIDB(libraryId);
      await removeWebFilesFromIDB(libraryId);
    }
    logger.log(`Removed local library configuration: ${libraryId}`);
  }

  /**
   * Configure legacy / default method
   */
  async configure(customName?: string): Promise<boolean> {
    const result = await this.addLibrary(customName);
    return !!result;
  }

  getStoredPath(): string | null {
    const libs = this.getLibraries();
    if (libs.length > 0) return libs[0].path;
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(LEGACY_STORAGE_KEY_PATH);
    }
    return null;
  }

  getStoredName(): string | null {
    const libs = this.getLibraries();
    if (libs.length > 0) return libs[0].name;
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(LEGACY_STORAGE_KEY_NAME);
    }
    return null;
  }

  async authenticate(customName?: string): Promise<AuthResult> {
    const libs = this.getLibraries();
    if (libs.length > 0 && !customName) {
      return { success: true };
    }
    const configured = await this.configure(customName);
    return {
      success: configured,
      error: configured ? undefined : 'Local Library configuration cancelled or failed'
    };
  }

  async isAuthenticated(): Promise<boolean> {
    return this.getLibraries().length > 0 || !!this.getStoredPath();
  }

  async disconnect(): Promise<void> {
    const libs = this.getLibraries();
    for (const lib of libs) {
      await this.removeLibrary(lib.id);
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY_LIBRARIES);
      localStorage.removeItem(LEGACY_STORAGE_KEY_PATH);
      localStorage.removeItem(LEGACY_STORAGE_KEY_NAME);
    }
  }

  async createApplicationFolder(): Promise<string> {
    const path = this.getStoredPath();
    return path || 'locallibrary';
  }

  /**
   * Verify and request permission for web directory handle if needed
   */
  private async verifyWebPermission(handle: FileSystemDirectoryHandle, mode: 'read' | 'readwrite' = 'read'): Promise<boolean> {
    try {
      if ((handle as any).queryPermission) {
        const status = await (handle as any).queryPermission({ mode });
        if (status === 'granted') return true;
        if ((handle as any).requestPermission) {
          const reqStatus = await (handle as any).requestPermission({ mode });
          return reqStatus === 'granted';
        }
      }
      return true;
    } catch (err) {
      logger.warn('Error checking web directory permission:', err);
      return true;
    }
  }

  private async getWebHandleForLibrary(libraryId: string, mode: 'read' | 'readwrite' = 'read'): Promise<FileSystemDirectoryHandle | null> {
    if (this.webDirHandles.has(libraryId)) {
      const handle = this.webDirHandles.get(libraryId)!;
      await this.verifyWebPermission(handle, mode);
      return handle;
    }
    const handle = await getHandleFromIDB(libraryId);
    if (handle) {
      this.webDirHandles.set(libraryId, handle);
      await this.verifyWebPermission(handle, mode);
      return handle;
    }
    return null;
  }

  /**
   * Helper to parse file ID into libraryId and fileName
   */
  private parseFileId(fileId: string): { libraryId: string; fileName: string } {
    if (fileId.includes('::')) {
      const parts = fileId.split('::');
      return { libraryId: parts[0], fileName: parts.slice(1).join('::') };
    }
    const libs = this.getLibraries();
    const defaultId = libs.length > 0 ? libs[0].id : 'default';
    return { libraryId: defaultId, fileName: fileId };
  }

  async listFiles(folderId?: string): Promise<ExtendedCloudFile[]> {
    const files: ExtendedCloudFile[] = [];
    const libraries = this.getLibraries();

    // If folderId matches a library ID, list only that library; otherwise list all libraries
    const targetLibs = folderId && libraries.some(l => l.id === folderId)
      ? libraries.filter(l => l.id === folderId)
      : libraries;

    for (const lib of targetLibs) {
      if (isTauriEnvironment()) {
        if (!lib.path) continue;
        try {
          const relativeFiles = await readDirectory(lib.path);
          for (const relPath of relativeFiles) {
            const name = relPath.split(/[/\\]/).pop() || relPath;
            files.push({
              id: `${lib.id}::${relPath}`,
              name: name,
              modifiedTime: new Date(),
              size: 1024,
              mimeType: name.endsWith('.sstp') ? 'application/octet-stream' : 'text/markdown',
              libraryId: lib.id,
              libraryName: lib.name
            });
          }
        } catch (err) {
          logger.warn(`Failed to list files for library ${lib.name} (${lib.path}):`, err);
        }
      } else {
        const seenNames = new Set<string>();

        // Check IndexedDB stored web files
        const storedWebFiles = await getWebFilesFromIDB(lib.id);
        for (const sf of storedWebFiles) {
          seenNames.add(sf.name);
          files.push({
            id: `${lib.id}::${sf.name}`,
            name: sf.name,
            modifiedTime: new Date(sf.modifiedTime),
            size: sf.size,
            mimeType: sf.name.endsWith('.sstp') ? 'application/octet-stream' : 'text/markdown',
            libraryId: lib.id,
            libraryName: lib.name
          });
        }

        // Check directory handle if available
        const handle = await this.getWebHandleForLibrary(lib.id);
        if (handle) {
          try {
            for await (const entry of (handle as any).values()) {
              if (entry.kind === 'file') {
                const name = entry.name;
                if (!seenNames.has(name) && (name.endsWith('.md') || name.endsWith('.markdown') || name.endsWith('.txt') || name.endsWith('.sstp'))) {
                  try {
                    const fileObj = await entry.getFile();
                    files.push({
                      id: `${lib.id}::${name}`,
                      name: name,
                      modifiedTime: new Date(fileObj.lastModified),
                      size: fileObj.size,
                      mimeType: name.endsWith('.sstp') ? 'application/octet-stream' : 'text/markdown',
                      libraryId: lib.id,
                      libraryName: lib.name
                    });
                  } catch (e) {
                    logger.warn(`Could not read stat for ${name}:`, e);
                    files.push({
                      id: `${lib.id}::${name}`,
                      name: name,
                      modifiedTime: new Date(),
                      size: 0,
                      mimeType: name.endsWith('.sstp') ? 'application/octet-stream' : 'text/markdown',
                      libraryId: lib.id,
                      libraryName: lib.name
                    });
                  }
                }
              }
            }
          } catch (err) {
            logger.warn(`Failed to list web files for library ${lib.name}:`, err);
          }
        }
      }
    }

    return files;
  }

  async downloadFile(fileId: string): Promise<string | Uint8Array> {
    const { libraryId, fileName } = this.parseFileId(fileId);
    const lib = this.getLibraries().find(l => l.id === libraryId);

    if (isTauriEnvironment()) {
      const folderPath = lib ? lib.path : this.getStoredPath();
      if (!folderPath) throw new Error('Local library path not configured');

      const fullPath = `${folderPath}/${fileName}`.replace(/\/+/g, '/');
      const content = await readFileContent(fullPath);
      if (content === null) throw new Error(`Failed to read file: ${fileName}`);
      return content;
    } else {
      const storedWebFiles = await getWebFilesFromIDB(libraryId);
      const sf = storedWebFiles.find(f => f.name === fileName);
      if (sf) {
        return sf.content;
      }

      const handle = await this.getWebHandleForLibrary(libraryId);
      if (!handle) throw new Error('Local library directory handle not available');

      const fileHandle = await handle.getFileHandle(fileName);
      const fileObj = await fileHandle.getFile();
      return await fileObj.text();
    }
  }

  async uploadFile(folderId: string, fileName: string, content: string | Uint8Array): Promise<ExtendedCloudFile> {
    const textContent = typeof content === 'string' ? content : new TextDecoder().decode(content);

    // folderId specifies target libraryId or default
    const libraries = this.getLibraries();
    const targetLib = libraries.find(l => l.id === folderId) || libraries[0];
    const libraryId = targetLib ? targetLib.id : 'default';

    if (isTauriEnvironment()) {
      const folderPath = targetLib ? targetLib.path : this.getStoredPath();
      if (!folderPath) throw new Error('Local library path not configured');

      const fullPath = `${folderPath}/${fileName}`.replace(/\/+/g, '/');
      const success = await writeTauriFile(fullPath, textContent);
      if (!success) throw new Error(`Failed to write file: ${fileName}`);

      return {
        id: `${libraryId}::${fileName}`,
        name: fileName,
        modifiedTime: new Date(),
        size: new TextEncoder().encode(textContent).length,
        mimeType: fileName.endsWith('.sstp') ? 'application/octet-stream' : 'text/markdown',
        libraryId,
        libraryName: targetLib?.name
      };
    } else {
      const storedWebFiles = await getWebFilesFromIDB(libraryId);
      const newFileItem: StoredWebFile = {
        name: fileName,
        content: textContent,
        modifiedTime: new Date().toISOString(),
        size: new TextEncoder().encode(textContent).length,
        libraryId
      };
      const existingIdx = storedWebFiles.findIndex(f => f.name === fileName);
      if (existingIdx >= 0) {
        storedWebFiles[existingIdx] = newFileItem;
      } else {
        storedWebFiles.push(newFileItem);
      }
      await saveWebFilesToIDB(libraryId, storedWebFiles);

      const handle = await this.getWebHandleForLibrary(libraryId, 'readwrite');
      if (handle) {
        try {
          const fileHandle = await handle.getFileHandle(fileName, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(textContent);
          await writable.close();
        } catch (err) {
          console.error(`[LocalLibraryProvider] Could not write to web handle for ${fileName}:`, err);
        }
      }

      return {
        id: `${libraryId}::${fileName}`,
        name: fileName,
        modifiedTime: new Date(),
        size: new TextEncoder().encode(textContent).length,
        mimeType: fileName.endsWith('.sstp') ? 'application/octet-stream' : 'text/markdown',
        libraryId,
        libraryName: targetLib?.name
      };
    }
  }

  async updateFile(fileId: string, content: string | Uint8Array): Promise<CloudFile> {
    const { libraryId, fileName } = this.parseFileId(fileId);
    return this.uploadFile(libraryId, fileName, content);
  }

  async deleteFile(fileId: string): Promise<void> {
    const { libraryId, fileName } = this.parseFileId(fileId);
    const lib = this.getLibraries().find(l => l.id === libraryId);

    if (isTauriEnvironment()) {
      const folderPath = lib ? lib.path : this.getStoredPath();
      if (!folderPath) throw new Error('Local library path not configured');

      const fullPath = `${folderPath}/${fileName}`.replace(/\/+/g, '/');
      const { remove } = await import('@tauri-apps/plugin-fs');
      await remove(fullPath);
    } else {
      const storedWebFiles = await getWebFilesFromIDB(libraryId);
      const updatedFiles = storedWebFiles.filter(f => f.name !== fileName);
      await saveWebFilesToIDB(libraryId, updatedFiles);

      const handle = await this.getWebHandleForLibrary(libraryId);
      if (handle) {
        try {
          await handle.removeEntry(fileName);
        } catch (err) {
          logger.warn(`Could not remove file from web handle: ${fileName}`, err);
        }
      }
    }
  }
}
