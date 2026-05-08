/**
 * CloudManager - Central orchestrator for cloud note operations
 * Integrates all cloud components into unified interface for note lifecycle management
 */

import type { CloudProvider, NoteMetadata, SyncResult, ProviderMetadata } from '../interfaces';
import { MetadataManager } from './MetadataManager';
import { FileSynchronizer } from './FileSynchronizer';
// CloudCredentialManager is used by individual providers, not directly by CloudManager
// Providers are imported dynamically to avoid loading when feature is disabled
import { isTauriEnvironment } from '../../utils/environment';
import { ErrorHandler } from '../utils/ErrorHandler';
import { cloudToastService } from '../utils/CloudToastService';
import { offlineManager } from '../utils/OfflineManager';
import * as CryptoJS from 'crypto-js';
import { FEATURES } from '../../config/features';
import { createLogger } from '../../utils/logger';

const logger = createLogger('CloudManager');

export class CloudManager {
  private providers: Map<string, CloudProvider> = new Map();
  private metadataManager: MetadataManager;
  private fileSynchronizer: FileSynchronizer;
  private providersReady: Promise<void>;
  // Credential management is handled by individual providers

  constructor() {
    this.metadataManager = new MetadataManager();
    this.fileSynchronizer = new FileSynchronizer();
    // Credential management is handled by individual providers

    // Only register providers if the feature is enabled
    if (!FEATURES.EASY_NOTES) {
      logger.log('EASY_NOTES feature disabled, skipping provider registration');
      this.providersReady = Promise.resolve();
      return;
    }

    // Initialize providers asynchronously but track completion
    this.providersReady = this.initializeProviders();
  }

  /**
   * Initialize providers based on environment
   */
  private async initializeProviders(): Promise<void> {
    try {
      // Register providers based on environment
      if (isTauriEnvironment()) {
        logger.log('Detected Tauri environment, using OAuth providers');
        // Dynamically import OAuth providers to avoid loading OAuth system in web environment
        try {
          const { OAuthGoogleDriveProvider } = await import('../providers/OAuthGoogleDriveProvider');
          const { OAuthDropboxProvider } = await import('../providers/OAuthDropboxProvider');
          const { OAuthBoxProvider } = await import('../providers/OAuthBoxProvider');
          this.registerProvider(new OAuthGoogleDriveProvider());
          this.registerProvider(new OAuthDropboxProvider());
          this.registerProvider(new OAuthBoxProvider());
          logger.log('OAuth providers registered successfully');
        } catch (error) {
          logger.error('Failed to load OAuth provider, falling back to Tauri provider:', error);
          const { TauriGoogleDriveProvider } = await import('../providers/TauriGoogleDriveProvider');
          this.registerProvider(new TauriGoogleDriveProvider());
          logger.log('Tauri provider registered as fallback');
        }

        try {
          const { OAuthOneDriveProvider } = await import('../providers/OAuthOneDriveProvider');
          this.registerProvider(new OAuthOneDriveProvider());
          logger.log('OneDrive OAuth provider registered successfully');
        } catch (error) {
          logger.error('Failed to load OneDrive OAuth provider:', error);
        }
      } else {
        logger.log('Detected web environment, using web providers');
        const { GISGoogleDriveProvider } = await import('../providers/GISGoogleDriveProvider');
        const { DropboxProvider } = await import('../providers/DropboxProvider');
        const { BoxProvider } = await import('../providers/BoxProvider');
        this.registerProvider(new GISGoogleDriveProvider());
        this.registerProvider(new DropboxProvider());
        this.registerProvider(new BoxProvider());
        logger.log('Web providers registered successfully');

        try {
          const { MSALOneDriveProvider } = await import('../providers/MSALOneDriveProvider');
          this.registerProvider(new MSALOneDriveProvider());
          logger.log('OneDrive MSAL provider registered successfully');
        } catch (error) {
          logger.error('Failed to load OneDrive MSAL provider:', error);
        }
      }
    } catch (error) {
      logger.error('Failed to initialize providers:', error);
      // Don't throw - allow the manager to work without providers
    }
  }

  /**
   * Ensure providers are ready before operations
   */
  private async ensureProvidersReady(): Promise<void> {
    await this.providersReady;
  }

  /**
   * Register a cloud provider with the manager
   */
  registerProvider(provider: CloudProvider): void {
    this.providers.set(provider.name, provider);
  }

  /**
   * Get list of available providers
   */
  async getAvailableProviders(): Promise<CloudProvider[]> {
    await this.ensureProvidersReady();
    return Array.from(this.providers.values());
  }

  /**
   * Connect to a cloud provider by authenticating and setting up application folder
   * Requirements: 2.1, 3.1, 4.1, 5.1
   */
  async connectProvider(providerName: string): Promise<boolean> {
    await this.ensureProvidersReady();

    const provider = this.providers.get(providerName);
    if (!provider) {
      const error = new Error(`Provider ${providerName} not found`);
      cloudToastService.showError(error);
      throw error;
    }

    const operationId = `connect_${providerName}_${Date.now()}`;
    cloudToastService.showLoading(operationId, `Connecting to ${provider.displayName}...`, { showProgress: true });

    try {
      return await ErrorHandler.withRetry(async () => {
        // Check if offline
        if (!offlineManager.isCurrentlyOnline()) {
          throw ErrorHandler.enhanceError(
            new Error('Cannot connect while offline'),
            { operation: 'connectProvider', provider: providerName }
          );
        }

        // Update progress: Starting authentication
        cloudToastService.updateProgress(operationId, 25, `Authenticating with ${provider.displayName}...`);

        // Authenticate with the provider
        const authResult = await provider.authenticate();
        if (!authResult.success) {
          throw ErrorHandler.enhanceError(
            new Error(authResult.error || 'Authentication failed'),
            { operation: 'authenticate', provider: providerName }
          );
        }

        // Update progress: Setting up folder
        cloudToastService.updateProgress(operationId, 75, `Setting up application folder...`);

        // Create or find application folder
        logger.log('Creating application folder...');
        const applicationFolderId = await provider.createApplicationFolder();
        logger.log('Application folder ID:', applicationFolderId);

        // Update provider metadata
        const providerMetadata: ProviderMetadata = {
          connected: true,
          applicationFolderId,
          lastSync: new Date(),
          displayName: provider.displayName,
          icon: provider.icon
        };

        logger.log('Updating provider metadata:', providerMetadata);
        await this.metadataManager.updateProviderMetadata(providerName, providerMetadata);
        logger.log('Provider metadata updated successfully');

        cloudToastService.completeOperation(operationId, `Connected to ${provider.displayName}`, 'success');
        return true;
      },
        { operation: 'connectProvider', provider: providerName },
        { maxRetries: 2 } // Fewer retries for authentication
      );
    } catch (error) {
      const cloudError = ErrorHandler.enhanceError(error, {
        operation: 'connectProvider',
        provider: providerName
      });

      cloudToastService.completeOperation(operationId, ErrorHandler.getUserFriendlyMessage(cloudError), 'error');
      logger.error(`Failed to connect to ${providerName}:`, cloudError);
      return false;
    }
  }

  /**
   * Disconnect from a cloud provider and clean up credentials
   * Requirements: 6.4
   */
  async disconnectProvider(providerName: string): Promise<void> {
    await this.ensureProvidersReady();

    const provider = this.providers.get(providerName);
    if (!provider) {
      const error = new Error(`Provider ${providerName} not found`);
      cloudToastService.showError(error);
      throw error;
    }

    try {
      await ErrorHandler.withRetry(async () => {
        // Disconnect from provider
        await provider.disconnect();

        // Update provider metadata to disconnected state
        const providerMetadata: ProviderMetadata = {
          connected: false,
          displayName: provider.displayName,
          icon: provider.icon
        };

        await this.metadataManager.updateProviderMetadata(providerName, providerMetadata);

        // Remove notes for this provider from local metadata
        const notes = await this.metadataManager.findNotesByProvider(providerName);
        for (const note of notes) {
          await this.metadataManager.removeNote(note.id);
        }
      },
        { operation: 'disconnectProvider', provider: providerName },
        { maxRetries: 1 } // Single retry for disconnect
      );

      cloudToastService.showConnectionStatus(provider.displayName, false);

    } catch (error) {
      const cloudError = ErrorHandler.enhanceError(error, {
        operation: 'disconnectProvider',
        provider: providerName
      });

      cloudToastService.showError(cloudError);
      logger.error(`Failed to disconnect from ${providerName}:`, cloudError);
      throw cloudError;
    }
  }

  /**
   * Create a new note in the specified cloud provider
   * Requirements: 2.1, 2.2, 2.3, 2.5
   */
  async createNote(providerName: string, title: string): Promise<NoteMetadata> {
    await this.ensureProvidersReady();

    const provider = this.providers.get(providerName);
    if (!provider) {
      const error = new Error(`Provider ${providerName} not found`);
      cloudToastService.showError(error);
      throw error;
    }

    // Validate inputs
    if (!title || title.trim().length === 0) {
      const error = new Error('Note title cannot be empty');
      cloudToastService.showError(error);
      throw error;
    }

    const operationId = `create_note_${Date.now()}`;
    const sanitizedTitle = title.trim();
    cloudToastService.showLoading(operationId, `Creating note "${sanitizedTitle}"...`, { showProgress: true });

    try {
      return await ErrorHandler.withRetry(async () => {
        // Check if provider is connected
        const providerMetadata = await this.metadataManager.getProviderMetadata(providerName);
        if (!providerMetadata || !providerMetadata.connected || !providerMetadata.applicationFolderId) {
          throw ErrorHandler.enhanceError(
            new Error(`Provider ${providerName} is not connected`),
            { operation: 'createNote', provider: providerName }
          );
        }

        // Create initial content
        const initialContent = `# ${sanitizedTitle}\n\nCreated on ${new Date().toLocaleDateString()}\n`;

        // Update progress: Preparing file
        cloudToastService.updateProgress(operationId, 25, `Preparing file "${sanitizedTitle}"...`);

        // Generate filename from title
        const fileName = this.sanitizeFileName(sanitizedTitle);

        // Update progress: Uploading to cloud
        cloudToastService.updateProgress(operationId, 50, `Uploading to ${provider.displayName}...`);

        // Upload to cloud storage with offline fallback
        const cloudFile = await offlineManager.withOfflineFallback(
          () => this.fileSynchronizer.uploadNote(
            provider,
            providerMetadata.applicationFolderId!,
            fileName,
            initialContent
          ),
          () => {
            throw new Error('Cannot create notes while offline');
          },
          'createNote'
        );

        // Create note metadata
        const noteMetadata: NoteMetadata = {
          id: this.generateNoteId(),
          title: sanitizedTitle,
          fileName: cloudFile.name,
          provider: providerName,
          cloudFileId: cloudFile.id,
          lastModified: cloudFile.modifiedTime,
          lastSynced: new Date(),
          size: cloudFile.size,
          checksum: this.calculateChecksum(initialContent)
        };

        // Update progress: Saving metadata
        cloudToastService.updateProgress(operationId, 90, `Saving note metadata...`);

        // Save to local metadata
        await this.metadataManager.addNote(noteMetadata);

        cloudToastService.completeOperation(operationId, `Created note "${sanitizedTitle}"`, 'success');
        return noteMetadata;
      },
        { operation: 'createNote', provider: providerName, fileName: sanitizedTitle }
      );

    } catch (error) {
      const cloudError = ErrorHandler.enhanceError(error, {
        operation: 'createNote',
        provider: providerName,
        fileName: sanitizedTitle
      });

      cloudToastService.completeOperation(operationId, ErrorHandler.getUserFriendlyMessage(cloudError), 'error');
      logger.error(`Failed to create note in ${providerName}:`, cloudError);
      throw cloudError;
    }
  }

  /**
   * Upload a generic file (e.g., encrypted file) to cloud storage
   */
  /**
   * Upload a generic file (e.g., encrypted file) to cloud storage
   * Returns metadata if available
   */
  async uploadFile(providerName: string, fileName: string, content: string | Uint8Array): Promise<NoteMetadata | null> {
    await this.ensureProvidersReady();
    const provider = this.providers.get(providerName);
    if (!provider) throw new Error(`Provider ${providerName} not found`);

    const operationId = `upload_file_${Date.now()}`;
    cloudToastService.showLoading(operationId, `Uploading "${fileName}"...`, { showProgress: true });

    try {
      const providerMetadata = await this.metadataManager.getProviderMetadata(providerName);
      if (!providerMetadata?.connected || !providerMetadata.applicationFolderId) {
        throw new Error(`Provider ${providerName} is not connected`);
      }

      cloudToastService.updateProgress(operationId, 30, `Uploading to ${provider.displayName}...`);

      const cloudFile = await this.fileSynchronizer.uploadNote(
        provider,
        providerMetadata.applicationFolderId,
        fileName, // Pass filename directly, extension should be handled by caller for generic files
        content
      );

      // Create and save metadata for the uploaded file so it appears in the list immediately
      // Extract title from filename (remove extension)
      let title = fileName;
      const lastDotIndex = fileName.lastIndexOf('.');
      if (lastDotIndex > 0) {
        title = fileName.substring(0, lastDotIndex);
      }

      const noteMetadata: NoteMetadata = {
        id: this.generateNoteId(),
        title: title,
        fileName: cloudFile.name,
        provider: providerName,
        cloudFileId: cloudFile.id,
        lastModified: cloudFile.modifiedTime,
        lastSynced: new Date(),
        size: cloudFile.size,
        checksum: this.calculateChecksum(content)
      };

      await this.metadataManager.addNote(noteMetadata);

      cloudToastService.completeOperation(operationId, `Uploaded "${fileName}" successfully`, 'success');
      return noteMetadata;
    } catch (error) {
      logger.error('Upload failed:', error);
      cloudToastService.completeOperation(operationId, `Upload failed: ${(error as Error).message}`, 'error');
      throw error;
    }
  }

  /**
   * List all notes, optionally filtered by provider
   * Requirements: 3.1, 3.2, 3.4
   */
  async listNotes(providerName?: string): Promise<NoteMetadata[]> {
    try {
      // Always use local metadata for listing (offline-first approach)
      return await offlineManager.withOfflineFallback(
        async () => {
          if (providerName) {
            return await this.metadataManager.findNotesByProvider(providerName);
          } else {
            return await this.metadataManager.loadMetadata();
          }
        },
        async () => {
          // Fallback to cached metadata
          if (providerName) {
            return await this.metadataManager.findNotesByProvider(providerName);
          } else {
            return await this.metadataManager.loadMetadata();
          }
        },
        'listNotes'
      );
    } catch (error) {
      const cloudError = ErrorHandler.enhanceError(error, {
        operation: 'listNotes',
        provider: providerName
      });

      logger.error('Failed to list notes:', cloudError);
      // Don't show toast for list failures as they're often called frequently
      throw cloudError;
    }
  }

  /**
   * Open a note by downloading its content from cloud storage
   * Requirements: 4.1, 4.2, 4.3, 4.5
   */
  async openNote(noteId: string): Promise<string | Uint8Array> {
    await this.ensureProvidersReady();

    const operationId = `open_note_${noteId}_${Date.now()}`;

    try {
      // Find note metadata
      const noteMetadata = await this.metadataManager.findNote(noteId);
      if (!noteMetadata) {
        const error = new Error(`Note with id ${noteId} not found`);
        cloudToastService.showError(error);
        throw error;
      }

      cloudToastService.showLoading(operationId, `Opening "${noteMetadata.title}"...`, { showProgress: true });

      // Get provider
      const provider = this.providers.get(noteMetadata.provider);
      if (!provider) {
        const error = new Error(`Provider ${noteMetadata.provider} not found`);
        cloudToastService.completeOperation(operationId, ErrorHandler.getUserFriendlyMessage(
          ErrorHandler.enhanceError(error, { operation: 'openNote', noteId })
        ), 'error');
        throw error;
      }

      return await ErrorHandler.withRetry(async () => {
        // Check if provider is authenticated
        const isAuthenticated = await provider.isAuthenticated();
        if (!isAuthenticated) {
          throw ErrorHandler.enhanceError(
            new Error(`Provider ${noteMetadata.provider} is not authenticated`),
            { operation: 'openNote', provider: noteMetadata.provider, noteId }
          );
        }

        // Update progress: Downloading content
        cloudToastService.updateProgress(operationId, 50, `Downloading from ${provider.displayName}...`);

        // Download note content with offline fallback
        const cloudFile = {
          id: noteMetadata.cloudFileId,
          name: noteMetadata.fileName,
          modifiedTime: noteMetadata.lastModified,
          size: noteMetadata.size,
          mimeType: 'text/markdown'
        };

        const content = await offlineManager.withOfflineFallback(
          () => this.fileSynchronizer.downloadNote(provider, cloudFile),
          () => {
            // Return placeholder content when offline
            return `# ${noteMetadata.title}\n\n*This note is not available offline. Please connect to the internet to view the latest content.*`;
          },
          'openNote'
        );

        cloudToastService.completeOperation(operationId, `Opened "${noteMetadata.title}"`, 'success');
        return content;
      },
        { operation: 'openNote', provider: noteMetadata.provider, noteId, fileName: noteMetadata.title }
      );

    } catch (error) {
      const cloudError = ErrorHandler.enhanceError(error, {
        operation: 'openNote',
        noteId
      });

      cloudToastService.completeOperation(operationId, ErrorHandler.getUserFriendlyMessage(cloudError), 'error');
      logger.error(`Failed to open note ${noteId}:`, cloudError);
      throw cloudError;
    }
  }

  /**
   * Save note content back to cloud storage
   * Requirements: 5.1, 5.2, 5.4
   */
  async saveNote(noteId: string, content: string): Promise<void> {
    await this.ensureProvidersReady();

    const operationId = `save_note_${noteId}_${Date.now()}`;

    try {
      // Find note metadata
      const noteMetadata = await this.metadataManager.findNote(noteId);
      if (!noteMetadata) {
        const error = new Error(`Note with id ${noteId} not found`);
        cloudToastService.showError(error);
        throw error;
      }

      cloudToastService.showLoading(operationId, `Saving "${noteMetadata.title}"...`, { showProgress: true });

      // Get provider
      const provider = this.providers.get(noteMetadata.provider);
      if (!provider) {
        const error = new Error(`Provider ${noteMetadata.provider} not found`);
        cloudToastService.completeOperation(operationId, ErrorHandler.getUserFriendlyMessage(
          ErrorHandler.enhanceError(error, { operation: 'saveNote', noteId })
        ), 'error');
        throw error;
      }

      await ErrorHandler.withRetry(async () => {
        // Check if provider is authenticated
        const isAuthenticated = await provider.isAuthenticated();
        if (!isAuthenticated) {
          throw ErrorHandler.enhanceError(
            new Error(`Provider ${noteMetadata.provider} is not authenticated`),
            { operation: 'saveNote', provider: noteMetadata.provider, noteId }
          );
        }

        // Handle offline scenario
        if (!offlineManager.isCurrentlyOnline()) {
          // Queue save for when online
          offlineManager.queueForOnline(
            () => this.saveNote(noteId, content),
            `save note ${noteMetadata.title}`
          );

          cloudToastService.completeOperation(operationId, `"${noteMetadata.title}" will be saved when online`, 'success');
          return;
        }

        // Update progress: Uploading changes
        cloudToastService.updateProgress(operationId, 50, `Uploading changes to ${provider.displayName}...`);

        // Upload updated content
        const updatedCloudFile = await this.fileSynchronizer.updateNote(
          provider,
          noteMetadata.cloudFileId,
          content
        );

        // Update metadata with new information
        logger.log('Updating metadata with new modifiedTime:', updatedCloudFile.modifiedTime);
        await this.metadataManager.updateNote(noteId, {
          lastModified: updatedCloudFile.modifiedTime,
          lastSynced: new Date(),
          size: updatedCloudFile.size,
          checksum: this.calculateChecksum(content)
        });

        cloudToastService.completeOperation(operationId, `Saved "${noteMetadata.title}"`, 'success');
      },
        { operation: 'saveNote', provider: noteMetadata.provider, noteId, fileName: noteMetadata.title }
      );

    } catch (error) {
      const cloudError = ErrorHandler.enhanceError(error, {
        operation: 'saveNote',
        noteId
      });

      cloudToastService.completeOperation(operationId, ErrorHandler.getUserFriendlyMessage(cloudError), 'error');
      logger.error(`Failed to save note ${noteId}:`, cloudError);
      throw cloudError;
    }
  }

  /**
   * Delete a note from cloud storage and local metadata
   */
  async deleteNote(noteId: string): Promise<void> {
    await this.ensureProvidersReady();

    try {
      // Find note metadata
      const noteMetadata = await this.metadataManager.findNote(noteId);
      if (!noteMetadata) {
        throw new Error(`Note with id ${noteId} not found`);
      }

      // Get provider
      const provider = this.providers.get(noteMetadata.provider);
      if (!provider) {
        throw new Error(`Provider ${noteMetadata.provider} not found`);
      }

      // Check if provider is authenticated
      const isAuthenticated = await provider.isAuthenticated();
      if (!isAuthenticated) {
        throw new Error(`Provider ${noteMetadata.provider} is not authenticated`);
      }

      // Delete from cloud storage
      await provider.deleteFile(noteMetadata.cloudFileId);

      // Remove from local metadata
      await this.metadataManager.removeNote(noteId);

    } catch (error) {
      logger.error(`Failed to delete note ${noteId}:`, error);
      throw error;
    }
  }

  /**
   * Synchronize notes with cloud storage, optionally for specific provider
   */
  async syncNotes(providerName?: string): Promise<SyncResult> {
    await this.ensureProvidersReady();

    const errors: string[] = [];
    let filesProcessed = 0;
    const operationId = `sync_${providerName || 'all'}_${Date.now()}`;

    // Check if offline
    if (!offlineManager.isCurrentlyOnline()) {
      const message = 'Cannot sync while offline';
      cloudToastService.showWarning(message);
      return {
        success: false,
        filesProcessed: 0,
        errors: [message],
        lastSyncTime: new Date()
      };
    }

    cloudToastService.showLoading(operationId, 'Discovering and synchronizing notes...', { showProgress: true });

    try {
      return await ErrorHandler.withRetry(async () => {
        const providersToSync = providerName
          ? [providerName]
          : Array.from(this.providers.keys());

        for (const pName of providersToSync) {
          const provider = this.providers.get(pName);
          if (!provider) {
            errors.push(`Provider ${pName} not found`);
            continue;
          }

          try {
            // Check if provider is connected and authenticated
            const providerMetadata = await this.metadataManager.getProviderMetadata(pName);
            if (!providerMetadata || !providerMetadata.connected) {
              continue; // Skip disconnected providers
            }

            const isAuthenticated = await provider.isAuthenticated();
            if (!isAuthenticated) {
              errors.push(`Provider ${pName} is not authenticated`);
              continue;
            }

            // PHASE 1: Discover new files from cloud storage
            logger.log(`Discovering files from ${pName}...`);

            let foundCloudFileIds: Set<string> | null = null;

            if (providerMetadata.applicationFolderId) {
              try {
                const cloudFiles = await provider.listFiles(providerMetadata.applicationFolderId);
                foundCloudFileIds = new Set(cloudFiles.map(f => f.id));
                logger.log(`Found ${cloudFiles.length} files in cloud storage`);

                // Get existing local notes for comparison
                const existingNotes = await this.metadataManager.findNotesByProvider(pName);
                const existingFileIds = new Set(existingNotes.map(note => note.cloudFileId));

                // Find new files that aren't in local metadata
                const newFiles = cloudFiles.filter(file => !existingFileIds.has(file.id));
                logger.log(`Found ${newFiles.length} new files to add to local metadata`);

                // Add new files to local metadata
                for (const cloudFile of newFiles) {
                  try {
                    // Extract title from filename (remove .md or .sstp extension)
                    const title = cloudFile.name.replace(/\.(md|sstp)$/, '');

                    const noteMetadata: NoteMetadata = {
                      id: this.generateNoteId(),
                      title: title,
                      fileName: cloudFile.name,
                      provider: pName,
                      cloudFileId: cloudFile.id,
                      lastModified: cloudFile.modifiedTime,
                      lastSynced: new Date(),
                      size: cloudFile.size,
                      checksum: 'unknown' // Will be updated when file is opened/synced
                    };

                    await this.metadataManager.addNote(noteMetadata);
                    logger.log(`Added new note to metadata: ${title}`);
                  } catch (error) {
                    logger.error(`Failed to add new file ${cloudFile.name} to metadata:`, error);
                    errors.push(`Failed to add new file ${cloudFile.name}: ${(error as Error).message}`);
                  }
                }
              } catch (error) {
                logger.error(`Failed to discover files from ${pName}:`, error);
                errors.push(`Failed to discover files: ${(error as Error).message}`);
              }
            }

            // PHASE 2: Sync existing notes
            const notes = await this.metadataManager.findNotesByProvider(pName);
            logger.log(`Syncing ${notes.length} notes for provider ${pName}`);

            for (const note of notes) {
              try {
                // Check if file exists in cloud (if discovery was successful)
                // This handles cases where files were deleted directly in Google Drive
                if (foundCloudFileIds && !foundCloudFileIds.has(note.cloudFileId)) {
                  logger.log(`Note ${note.title} (${note.cloudFileId}) no longer exists in cloud. Removing local metadata.`);
                  await this.metadataManager.removeNote(note.id);
                  // Consider this a processed file since we reconciled the state
                  filesProcessed++;
                  continue;
                }

                logger.log(`Syncing note: ${note.title} (${note.id})`);
                // Sync each note with individual error handling
                const syncResult = await ErrorHandler.withRetry(
                  () => this.fileSynchronizer.syncNote(provider, note),
                  { operation: 'syncNote', provider: pName, noteId: note.id, fileName: note.title },
                  { maxRetries: 2 }
                );

                logger.log(`Sync result for ${note.title}:`, syncResult);

                if (syncResult.success) {
                  filesProcessed += syncResult.filesProcessed;
                } else {
                  errors.push(...syncResult.errors);
                }
              } catch (error) {
                logger.error(`Failed to sync note ${note.title}:`, error);
                const cloudError = ErrorHandler.enhanceError(error, {
                  operation: 'syncNote',
                  provider: pName,
                  noteId: note.id,
                  fileName: note.title
                });
                errors.push(`Failed to sync note ${note.title}: ${ErrorHandler.getUserFriendlyMessage(cloudError)}`);
              }
            }

            // Update provider last sync time
            await this.metadataManager.updateProviderMetadata(pName, {
              ...providerMetadata,
              lastSync: new Date()
            });

          } catch (error) {
            const cloudError = ErrorHandler.enhanceError(error, {
              operation: 'syncProvider',
              provider: pName
            });
            errors.push(`Failed to sync provider ${pName}: ${ErrorHandler.getUserFriendlyMessage(cloudError)}`);
          }
        }

        const result: SyncResult = {
          success: errors.length === 0,
          filesProcessed,
          errors,
          lastSyncTime: new Date()
        };

        // Show appropriate completion message
        cloudToastService.showSyncResult(filesProcessed, errors);

        return result;
      },
        { operation: 'syncNotes', provider: providerName },
        { maxRetries: 1 }
      );

    } catch (error) {
      const cloudError = ErrorHandler.enhanceError(error, {
        operation: 'syncNotes',
        provider: providerName
      });

      errors.push(`Sync operation failed: ${ErrorHandler.getUserFriendlyMessage(cloudError)}`);

      const result: SyncResult = {
        success: false,
        filesProcessed,
        errors,
        lastSyncTime: new Date()
      };

      cloudToastService.completeOperation(operationId, 'Sync failed', 'error');
      return result;
    }
  }

  /**
   * Check if a provider is connected and authenticated
   */
  async isProviderConnected(providerName: string): Promise<boolean> {
    await this.ensureProvidersReady();

    try {
      const provider = this.providers.get(providerName);
      if (!provider) {
        return false;
      }

      const providerMetadata = await this.metadataManager.getProviderMetadata(providerName);
      if (!providerMetadata || !providerMetadata.connected) {
        return false;
      }

      return await provider.isAuthenticated();
    } catch (error) {
      logger.error(`Error checking provider connection for ${providerName}:`, error);
      return false;
    }
  }

  /**
   * Get provider metadata for UI display
   */
  async getProviderMetadata(providerName: string): Promise<ProviderMetadata | null> {
    return await this.metadataManager.getProviderMetadata(providerName);
  }

  /**
   * Generate a unique note ID
   */
  private generateNoteId(): string {
    return `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Sanitize filename for cloud storage
   */
  private sanitizeFileName(title: string): string {
    // Remove or replace invalid characters for filenames
    const sanitized = title
      .replace(/[<>:"/\\|?*]/g, '_') // Replace invalid chars with underscore
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .toLowerCase()
      .trim();

    // Ensure it's not empty and has reasonable length
    const finalName = sanitized || 'untitled';
    return finalName.length > 50 ? finalName.substring(0, 50) : finalName;
  }

  /**
   * Calculate SHA-256 checksum of content
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
}

// Export singleton instance for global access - only when feature is enabled
export const cloudManager = FEATURES.EASY_NOTES ? new CloudManager() : null;