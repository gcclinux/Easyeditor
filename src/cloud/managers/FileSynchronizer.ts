/**
 * FileSynchronizer - Handles file upload, download, and conflict resolution
 * Implements checksum-based conflict detection and retry mechanisms
 */

import type { CloudProvider, CloudFile, NoteMetadata, SyncResult } from '../interfaces';
import { ErrorHandler } from '../utils/ErrorHandler';
import * as CryptoJS from 'crypto-js';
import { createLogger } from '../../utils/logger';

const logger = createLogger('FileSynchronizer');

export interface RetryOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
}

export class FileSynchronizer {
  constructor(private retryOptions: RetryOptions = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000
  }) { }

  /**
   * Downloads a note from cloud storage with retry mechanism and progress tracking
   */
  async downloadNote(provider: CloudProvider, cloudFile: CloudFile, onProgress?: (progress: number) => void): Promise<string | Uint8Array> {
    return ErrorHandler.withRetry(async () => {
      // Report download start
      if (onProgress) onProgress(0);

      const content = await ErrorHandler.withTimeout(
        provider.downloadFile(cloudFile.id),
        30000 // 30 second timeout
      );

      // Report download progress (simulated for now since we don't have streaming)
      if (onProgress) onProgress(75);

      // Validate downloaded content
      if (typeof content !== 'string' && !(content instanceof Uint8Array)) {
        throw ErrorHandler.enhanceError(
          new Error('Downloaded content is not a valid string or Uint8Array'),
          { operation: 'downloadNote', fileName: cloudFile.name }
        );
      }

      // Report completion
      if (onProgress) onProgress(100);

      return content;
    },
      { operation: 'downloadNote', fileName: cloudFile.name },
      this.retryOptions
    );
  }

  /**
   * Uploads a new note to cloud storage with retry mechanism and progress tracking
   */
  async uploadNote(provider: CloudProvider, folderId: string, fileName: string, content: string | Uint8Array, onProgress?: (progress: number) => void): Promise<CloudFile> {
    return ErrorHandler.withRetry(async () => {
      // Validate inputs
      if (!fileName || fileName.trim().length === 0) {
        throw ErrorHandler.enhanceError(
          new Error('File name cannot be empty'),
          { operation: 'uploadNote', fileName }
        );
      }

      if (!content || (typeof content !== 'string' && !(content instanceof Uint8Array))) {
        throw ErrorHandler.enhanceError(
          new Error('Content must be a non-empty string or Uint8Array'),
          { operation: 'uploadNote', fileName }
        );
      }

      // Report upload start
      if (onProgress) onProgress(0);

      // Ensure file has .md extension if it is a string (assuming text content is markdown)
      // If it is binary (Uint8Array), we probably shouldn't force extension, but for now this method is called 'uploadNote'
      // Ideally we should have a separate 'uploadFile' method that is generic.
      // For now, let's relax the .md check if it's not string or if filename already has extension
      let normalizedFileName = fileName;
      if (typeof content === 'string' && !fileName.includes('.')) {
        normalizedFileName = `${fileName}.md`;
      }

      // Report preparation complete
      if (onProgress) onProgress(25);

      const cloudFile = await ErrorHandler.withTimeout(
        provider.uploadFile(folderId, normalizedFileName, content),
        60000 // 60 second timeout for uploads
      );

      // Report upload progress (simulated)
      if (onProgress) onProgress(90);

      // Validate returned cloud file
      if (!cloudFile || !cloudFile.id || !cloudFile.name) {
        throw ErrorHandler.enhanceError(
          new Error('Invalid cloud file returned from upload'),
          { operation: 'uploadNote', fileName: normalizedFileName }
        );
      }

      // Report completion
      if (onProgress) onProgress(100);

      return cloudFile;
    },
      { operation: 'uploadNote', fileName },
      this.retryOptions
    );
  }

  /**
   * Updates an existing note in cloud storage with retry mechanism and progress tracking
   */
  async updateNote(provider: CloudProvider, fileId: string, content: string | Uint8Array, onProgress?: (progress: number) => void): Promise<CloudFile> {
    return ErrorHandler.withRetry(async () => {
      // Validate inputs
      if (!fileId || fileId.trim().length === 0) {
        throw ErrorHandler.enhanceError(
          new Error('File ID cannot be empty'),
          { operation: 'updateNote' }
        );
      }

      if (!content || (typeof content !== 'string' && !(content instanceof Uint8Array))) {
        throw ErrorHandler.enhanceError(
          new Error('Content must be a non-empty string or Uint8Array'),
          { operation: 'updateNote' }
        );
      }

      // Report update start
      if (onProgress) onProgress(0);

      // Report preparation
      if (onProgress) onProgress(25);

      const cloudFile = await ErrorHandler.withTimeout(
        provider.updateFile(fileId, content),
        60000 // 60 second timeout for updates
      );

      // Report upload progress
      if (onProgress) onProgress(90);

      // Validate returned cloud file
      if (!cloudFile || !cloudFile.id || !cloudFile.name) {
        throw ErrorHandler.enhanceError(
          new Error('Invalid cloud file returned from update'),
          { operation: 'updateNote' }
        );
      }

      // Report completion
      if (onProgress) onProgress(100);

      return cloudFile;
    },
      { operation: 'updateNote' },
      this.retryOptions
    );
  }

  /**
   * Synchronizes a note between local and cloud storage with conflict detection
   */
  async syncNote(provider: CloudProvider, metadata: NoteMetadata, _localContent?: string | Uint8Array): Promise<SyncResult> {
    const errors: string[] = [];
    let filesProcessed = 0;

    try {
      logger.log(`Syncing note: ${metadata.title} (${metadata.id})`);

      // Create a CloudFile object from metadata to download content
      const cloudFile: CloudFile = {
        id: metadata.cloudFileId,
        name: metadata.fileName,
        modifiedTime: metadata.lastModified,
        size: metadata.size,
        mimeType: 'text/markdown'
      };

      logger.log(`Downloading cloud content for file: ${cloudFile.id}`);
      const cloudContent = await this.downloadNote(provider, cloudFile);
      const cloudChecksum = this.calculateChecksum(cloudContent);

      // If no local content provided, just return cloud content
      if (!_localContent) {
        filesProcessed = 1;
        return {
          success: true,
          filesProcessed,
          errors,
          lastSyncTime: new Date()
        };
      }

      const localChecksum = this.calculateChecksum(_localContent);

      // Check for conflicts using checksums
      if (metadata.checksum !== localChecksum && metadata.checksum !== cloudChecksum) {
        // Both local and cloud have changed since last sync - conflict!
        const resolvedContent = await this.resolveConflict(_localContent, cloudContent, metadata);

        // Upload resolved content
        await this.updateNote(provider, metadata.cloudFileId, resolvedContent);
        filesProcessed = 1;
      } else if (localChecksum !== cloudChecksum) {
        // Only one side has changed
        if (metadata.checksum === cloudChecksum) {
          // Local has changed, upload to cloud
          await this.updateNote(provider, metadata.cloudFileId, _localContent);
          filesProcessed = 1;
        } else if (metadata.checksum === localChecksum) {
          // Cloud has changed, local is up to date - no action needed
          filesProcessed = 1;
        }
      }
      // If checksums match, no sync needed

      return {
        success: true,
        filesProcessed,
        errors,
        lastSyncTime: new Date()
      };

    } catch (error) {
      logger.error(`Error syncing note ${metadata.title}:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown sync error';
      errors.push(errorMessage);

      return {
        success: false,
        filesProcessed,
        errors,
        lastSyncTime: new Date()
      };
    }
  }

  /**
   * Calculates SHA-256 checksum of content for conflict detection
   */
  /**
   * Calculates SHA-256 checksum of content for conflict detection
   */
  private calculateChecksum(content: string | Uint8Array): string {
    if (!content) {
      return 'sha256:empty';
    }

    let input: any = content;
    if (content instanceof Uint8Array) {
      // Convert Uint8Array to WordArray for CryptoJS
      input = CryptoJS.lib.WordArray.create(content);
    } else if (typeof content !== 'string') {
      return 'sha256:empty';
    }

    const hash = CryptoJS.SHA256(input);
    return `sha256:${hash.toString(CryptoJS.enc.Hex)}`;
  }

  /**
   * Resolves conflicts between local and cloud content
   * Currently implements a simple "cloud wins" strategy
   */
  private async resolveConflict(_localContent: string | Uint8Array, cloudContent: string | Uint8Array, metadata: NoteMetadata): Promise<string | Uint8Array> {
    // Simple conflict resolution: cloud content wins
    // In a more sophisticated implementation, this could:
    // - Show a diff to the user
    // - Attempt automatic merging
    // - Create backup copies
    // - Use timestamps to determine which is newer

    logger.warn(`Conflict detected for note ${metadata.title}. Using cloud version.`);

    // For now, prioritize cloud data as specified in requirements 7.5
    return cloudContent;
  }

  // Removed withRetry method - now using ErrorHandler.withRetry
}