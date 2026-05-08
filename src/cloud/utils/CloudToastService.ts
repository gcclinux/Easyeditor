/**
 * CloudToastService - Enhanced toast notifications for cloud operations
 * Provides operation-specific messaging and progress tracking
 */

import { ErrorHandler, CloudError } from './ErrorHandler';
import { createLogger } from '../../utils/logger';

const logger = createLogger('CloudToastService');

export type ToastType = 'success' | 'error' | 'info' | 'warning' | 'loading';

export interface CloudToastOptions {
  duration?: number;
  showRetry?: boolean;
  onRetry?: () => void;
  persistent?: boolean;
  progress?: number; // 0-100 for progress indicators
  showProgress?: boolean;
}

export interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
  options?: CloudToastOptions;
}

export class CloudToastService {
  private static instance: CloudToastService;
  private showToastCallback?: (message: string, type: ToastType, options?: CloudToastOptions) => void;
  private activeOperations = new Map<string, string>(); // operationId -> toastId

  static getInstance(): CloudToastService {
    if (!CloudToastService.instance) {
      CloudToastService.instance = new CloudToastService();
    }
    return CloudToastService.instance;
  }

  /**
   * Initialize the service with the toast callback from the main app
   */
  initialize(showToastCallback: (message: string, type: ToastType, options?: CloudToastOptions) => void): void {
    this.showToastCallback = showToastCallback;
  }

  /**
   * Show a success message for cloud operations
   */
  showSuccess(message: string, options?: CloudToastOptions): void {
    this.showToast(message, 'success', options);
  }

  /**
   * Show an error message with enhanced error handling
   */
  showError(error: CloudError | Error | string, options?: CloudToastOptions): void {
    let message: string;
    let enhancedOptions = { ...options };

    if (typeof error === 'string') {
      message = error;
    } else if (error instanceof Error && 'context' in error) {
      const cloudError = error as CloudError;
      message = ErrorHandler.getUserFriendlyMessage(cloudError);
      
      // Add retry option for retryable errors
      if (cloudError.isRetryable && !enhancedOptions.showRetry) {
        enhancedOptions.showRetry = true;
        enhancedOptions.persistent = true;
      }
    } else {
      message = error.message || 'An unexpected error occurred';
    }

    this.showToast(message, 'error', enhancedOptions);
  }

  /**
   * Show an info message
   */
  showInfo(message: string, options?: CloudToastOptions): void {
    this.showToast(message, 'info', options);
  }

  /**
   * Show a warning message
   */
  showWarning(message: string, options?: CloudToastOptions): void {
    this.showToast(message, 'warning', options);
  }

  /**
   * Show a loading message for ongoing operations
   */
  showLoading(operationId: string, message: string, options?: CloudToastOptions): void {
    const toastId = this.showToast(message, 'loading', { 
      ...options, 
      persistent: true,
      showProgress: true
    });
    this.activeOperations.set(operationId, toastId);
  }

  /**
   * Update progress for an ongoing operation
   */
  updateProgress(operationId: string, progress: number, message?: string): void {
    const toastId = this.activeOperations.get(operationId);
    if (toastId && message) {
      // In a real implementation, we'd update the existing toast
      // For now, we'll show progress in console for development
      logger.log(`[${operationId}] ${progress}% - ${message}`);
    }
  }

  /**
   * Update or complete a loading operation
   */
  completeOperation(operationId: string, message: string, type: 'success' | 'error' | 'warning' = 'success'): void {
    const toastId = this.activeOperations.get(operationId);
    if (toastId) {
      this.activeOperations.delete(operationId);
      // In a real implementation, we'd update the existing toast
      // For now, we'll show a new one
      this.showToast(message, type);
    } else {
      this.showToast(message, type);
    }
  }

  /**
   * Show connection status messages
   */
  showConnectionStatus(provider: string, connected: boolean): void {
    if (connected) {
      this.showSuccess(`Connected to ${provider}`);
    } else {
      this.showInfo(`Disconnected from ${provider}`);
    }
  }

  /**
   * Show sync progress and results
   */
  showSyncResult(filesProcessed: number, errors: string[] = []): void {
    if (errors.length === 0) {
      if (filesProcessed === 0) {
        this.showInfo('All files are up to date');
      } else {
        this.showSuccess(`Successfully synced ${filesProcessed} file${filesProcessed === 1 ? '' : 's'}`);
      }
    } else {
      this.showWarning(`Sync completed with ${errors.length} error${errors.length === 1 ? '' : 's'}. ${filesProcessed} files processed.`);
    }
  }

  /**
   * Show authentication-related messages
   */
  showAuthenticationMessage(provider: string, success: boolean, error?: string): void {
    if (success) {
      this.showSuccess(`Successfully authenticated with ${provider}`);
    } else {
      const message = error || `Failed to authenticate with ${provider}`;
      this.showError(message, {
        showRetry: true,
        persistent: true
      });
    }
  }

  /**
   * Show file operation messages with progress support
   */
  showFileOperation(operation: 'create' | 'open' | 'save' | 'delete', fileName: string, success: boolean, error?: string, progress?: number): void {
    const operationText = {
      create: 'Created',
      open: 'Opened',
      save: 'Saved',
      delete: 'Deleted'
    };

    if (success) {
      this.showSuccess(`${operationText[operation]} "${fileName}"`);
    } else {
      const message = error || `Failed to ${operation} "${fileName}"`;
      this.showError(message, {
        showRetry: operation !== 'delete', // Allow retry for most operations
        progress
      });
    }
  }

  /**
   * Show upload/download progress
   */
  showTransferProgress(operationId: string, type: 'upload' | 'download', fileName: string, progress: number): void {
    const action = type === 'upload' ? 'Uploading' : 'Downloading';
    const message = `${action} "${fileName}" (${progress}%)`;
    
    if (progress === 0) {
      this.showLoading(operationId, message, { showProgress: true, progress });
    } else if (progress >= 100) {
      this.completeOperation(operationId, `${type === 'upload' ? 'Uploaded' : 'Downloaded'} "${fileName}"`, 'success');
    } else {
      this.updateProgress(operationId, progress, message);
    }
  }

  /**
   * Show offline mode messages
   */
  showOfflineMode(): void {
    this.showWarning('You are offline. Some features may be limited.', {
      persistent: true
    });
  }

  /**
   * Show online mode restored
   */
  showOnlineMode(): void {
    this.showInfo('Connection restored. Cloud features are available.');
  }

  /**
   * Show configuration messages
   */
  showConfigurationMessage(provider: string, configured: boolean): void {
    if (!configured) {
      this.showInfo(`${provider} integration is not yet configured. It will be available in a future update.`);
    }
  }

  /**
   * Show quota/storage messages
   */
  showStorageMessage(provider: string, quotaExceeded: boolean): void {
    if (quotaExceeded) {
      this.showWarning(`Storage quota exceeded in ${provider}. Please free up space to continue syncing.`, {
        persistent: true
      });
    }
  }

  /**
   * Internal method to show toast
   */
  private showToast(message: string, type: ToastType, options?: CloudToastOptions): string {
    const toastId = `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    if (this.showToastCallback) {
      // Convert our ToastType to the app's expected type
      const appType = type === 'loading' ? 'info' : type as 'success' | 'error' | 'info' | 'warning';
      this.showToastCallback(message, appType, options);
    } else {
      logger.warn('CloudToastService not initialized with callback');
      logger.log(`[${type.toUpperCase()}] ${message}`);
    }

    return toastId;
  }
}

// Export singleton instance
export const cloudToastService = CloudToastService.getInstance();