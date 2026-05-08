/**
 * OfflineManager - Handles offline detection and graceful degradation
 * Provides offline state management and recovery mechanisms
 */

import { cloudToastService } from './CloudToastService';
import { createLogger } from '../../utils/logger';

const logger = createLogger('OfflineManager');

export interface OfflineState {
  isOnline: boolean;
  lastOnlineTime?: Date;
  offlineDuration?: number;
}

export class OfflineManager {
  private static instance: OfflineManager;
  private isOnline: boolean = navigator.onLine;
  private lastOnlineTime?: Date;
  private offlineStartTime?: Date;
  private listeners: Array<(state: OfflineState) => void> = [];
  private checkInterval?: NodeJS.Timeout;

  static getInstance(): OfflineManager {
    if (!OfflineManager.instance) {
      OfflineManager.instance = new OfflineManager();
    }
    return OfflineManager.instance;
  }

  constructor() {
    logger.log('Initializing, navigator.onLine:', navigator.onLine);
    this.setupEventListeners();
    this.startPeriodicCheck();
    
    if (this.isOnline) {
      this.lastOnlineTime = new Date();
      logger.log('Starting in online mode');
    } else {
      this.offlineStartTime = new Date();
      logger.log('Starting in offline mode');
    }
  }

  /**
   * Get current offline state
   */
  getState(): OfflineState {
    return {
      isOnline: this.isOnline,
      lastOnlineTime: this.lastOnlineTime,
      offlineDuration: this.offlineStartTime ? Date.now() - this.offlineStartTime.getTime() : undefined
    };
  }

  /**
   * Check if currently online
   */
  isCurrentlyOnline(): boolean {
    return this.isOnline;
  }

  /**
   * Add listener for offline state changes
   */
  addListener(listener: (state: OfflineState) => void): void {
    this.listeners.push(listener);
  }

  /**
   * Remove listener for offline state changes
   */
  removeListener(listener: (state: OfflineState) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Manually trigger connectivity check
   */
  async checkConnectivity(): Promise<boolean> {
    try {
      logger.log('Checking connectivity, navigator.onLine:', navigator.onLine);
      
      // In Tauri environment, trust navigator.onLine more
      const isTauri = typeof window !== 'undefined' && 
        ((window as any).__TAURI__ !== undefined || 
         (window as any).__TAURI_INTERNALS__ !== undefined);
      
      if (isTauri) {
        // For Tauri, primarily trust navigator.onLine
        // Only do network check if navigator says we're online
        if (!navigator.onLine) {
          logger.log('Tauri: navigator.onLine is false, setting offline');
          this.updateOnlineStatus(false);
          return false;
        }
        
        // Navigator says online, assume we are (Tauri's navigator.onLine is reliable)
        logger.log('Tauri: navigator.onLine is true, setting online');
        this.updateOnlineStatus(true);
        return true;
      }
      
      // For web environment, do actual connectivity check
      try {
        const response = await fetch('https://www.google.com/favicon.ico', {
          method: 'HEAD',
          mode: 'no-cors',
          cache: 'no-cache'
        });
        
        logger.log('Web: Connectivity check succeeded, setting online');
        this.updateOnlineStatus(true);
        return true;
      } catch (fetchError) {
        logger.warn('Web: Connectivity check failed:', fetchError);
        this.updateOnlineStatus(false);
        return false;
      }
    } catch (error) {
      logger.warn('Connectivity check error:', error);
      // On error, trust navigator.onLine
      this.updateOnlineStatus(navigator.onLine);
      return navigator.onLine;
    }
  }

  /**
   * Execute operation with offline fallback
   */
  async withOfflineFallback<T>(
    onlineOperation: () => Promise<T>,
    offlineFallback: () => T | Promise<T>,
    operationName: string = 'operation'
  ): Promise<T> {
    if (!this.isOnline) {
      logger.warn(`${operationName} attempted while offline (isOnline=${this.isOnline}, navigator.onLine=${navigator.onLine}), using fallback`);
      return Promise.resolve(offlineFallback());
    }

    try {
      return await onlineOperation();
    } catch (error) {
      // Check if error is network-related
      if (this.isNetworkError(error)) {
        logger.warn(`${operationName} failed due to network error, using fallback`);
        this.updateOnlineStatus(false);
        return Promise.resolve(offlineFallback());
      }
      throw error;
    }
  }

  /**
   * Queue operation for when online
   */
  queueForOnline(operation: () => Promise<void>, operationName: string): void {
    if (this.isOnline) {
      operation().catch(error => {
        logger.error(`Queued operation ${operationName} failed:`, error);
      });
    } else {
      const executeWhenOnline = () => {
        if (this.isOnline) {
          this.removeListener(executeWhenOnline);
          operation().catch(error => {
            logger.error(`Queued operation ${operationName} failed:`, error);
          });
        }
      };
      this.addListener(executeWhenOnline);
    }
  }

  /**
   * Get offline duration in human-readable format
   */
  getOfflineDurationText(): string | null {
    if (this.isOnline || !this.offlineStartTime) {
      return null;
    }

    const duration = Date.now() - this.offlineStartTime.getTime();
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);

    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Setup event listeners for online/offline events
   */
  private setupEventListeners(): void {
    window.addEventListener('online', () => {
      this.updateOnlineStatus(true);
    });

    window.addEventListener('offline', () => {
      this.updateOnlineStatus(false);
    });

    // Listen for visibility change to check connectivity when tab becomes visible
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && navigator.onLine) {
        this.checkConnectivity();
      }
    });
  }

  /**
   * Start periodic connectivity check
   */
  private startPeriodicCheck(): void {
    // Check connectivity every 30 seconds when online, every 10 seconds when offline
    const checkInterval = () => {
      const interval = this.isOnline ? 30000 : 10000;
      this.checkInterval = setTimeout(() => {
        this.checkConnectivity().then(() => {
          checkInterval();
        });
      }, interval);
    };

    checkInterval();
  }

  /**
   * Update online status and notify listeners
   */
  private updateOnlineStatus(isOnline: boolean): void {
    const wasOnline = this.isOnline;
    this.isOnline = isOnline;

    if (isOnline && !wasOnline) {
      // Just came online
      this.lastOnlineTime = new Date();
      this.offlineStartTime = undefined;
      cloudToastService.showOnlineMode();
    } else if (!isOnline && wasOnline) {
      // Just went offline
      this.offlineStartTime = new Date();
      cloudToastService.showOfflineMode();
    }

    // Notify listeners
    const state = this.getState();
    this.listeners.forEach(listener => {
      try {
        listener(state);
      } catch (error) {
        logger.error('Error in offline state listener:', error);
      }
    });
  }

  /**
   * Check if error is network-related
   */
  private isNetworkError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes('network') ||
        message.includes('fetch') ||
        message.includes('connection') ||
        message.includes('timeout') ||
        message.includes('offline')
      );
    }
    return false;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.checkInterval) {
      clearTimeout(this.checkInterval);
    }
    this.listeners = [];
  }
}

// Export singleton instance
export const offlineManager = OfflineManager.getInstance();