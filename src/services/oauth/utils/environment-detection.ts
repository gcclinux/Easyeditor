/**
 * Environment Detection Utilities for OAuth
 * Detects runtime environment and provides appropriate OAuth implementations
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
 */

import { OAuthManager } from '../core/OAuthManager';
import type { OAuthConfig } from '../interfaces';

/**
 * Runtime environment types
 */
export enum RuntimeEnvironment {
  TAURI = 'tauri',
  WEB = 'web',
  ELECTRON = 'electron',
  NODE = 'node'
}

/**
 * Environment detection utilities
 */
export class EnvironmentDetector {
  /**
   * Detect the current runtime environment
   */
  static detectEnvironment(): RuntimeEnvironment {
    // Check if running in Tauri
    if (typeof window !== 'undefined' && window.__TAURI__) {
      return RuntimeEnvironment.TAURI;
    }

    // Check if running in Electron
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      return RuntimeEnvironment.ELECTRON;
    }

    // Check if running in Node.js
    if (typeof process !== 'undefined' && process.versions && process.versions.node) {
      return RuntimeEnvironment.NODE;
    }

    // Default to web environment
    return RuntimeEnvironment.WEB;
  }

  /**
   * Check if running in Tauri environment
   */
  static isTauri(): boolean {
    return this.detectEnvironment() === RuntimeEnvironment.TAURI;
  }

  /**
   * Check if running in web environment
   */
  static isWeb(): boolean {
    return this.detectEnvironment() === RuntimeEnvironment.WEB;
  }

  /**
   * Check if running in Electron environment
   */
  static isElectron(): boolean {
    return this.detectEnvironment() === RuntimeEnvironment.ELECTRON;
  }

  /**
   * Check if running in Node.js environment
   */
  static isNode(): boolean {
    return this.detectEnvironment() === RuntimeEnvironment.NODE;
  }

  /**
   * Check if OAuth popup windows are supported
   */
  static supportsPopupWindows(): boolean {
    const env = this.detectEnvironment();
    
    // Tauri blocks popup windows due to security model
    if (env === RuntimeEnvironment.TAURI) {
      return false;
    }

    // Web browsers support popup windows
    if (env === RuntimeEnvironment.WEB) {
      return typeof window !== 'undefined' && typeof window.open === 'function';
    }

    // Electron can support popup windows
    if (env === RuntimeEnvironment.ELECTRON) {
      return true;
    }

    // Node.js doesn't have popup windows
    return false;
  }

  /**
   * Check if system browser launching is supported
   */
  static supportsSystemBrowser(): boolean {
    const env = this.detectEnvironment();
    
    // Tauri supports system browser launching
    if (env === RuntimeEnvironment.TAURI) {
      return true;
    }

    // Electron can launch system browser
    if (env === RuntimeEnvironment.ELECTRON) {
      return true;
    }

    // Node.js can launch system browser
    if (env === RuntimeEnvironment.NODE) {
      return true;
    }

    // Web browsers can't directly launch system browser
    return false;
  }

  /**
   * Check if local callback server is supported
   */
  static supportsCallbackServer(): boolean {
    const env = this.detectEnvironment();
    
    // Tauri supports local callback server
    if (env === RuntimeEnvironment.TAURI) {
      return true;
    }

    // Electron supports local callback server
    if (env === RuntimeEnvironment.ELECTRON) {
      return true;
    }

    // Node.js supports local callback server
    if (env === RuntimeEnvironment.NODE) {
      return true;
    }

    // Web browsers don't support local callback server
    return false;
  }

  /**
   * Check if secure token storage is available
   */
  static supportsSecureStorage(): boolean {
    const env = this.detectEnvironment();
    
    // Tauri supports platform-specific secure storage
    if (env === RuntimeEnvironment.TAURI) {
      return true;
    }

    // Electron supports secure storage
    if (env === RuntimeEnvironment.ELECTRON) {
      return true;
    }

    // Node.js can use OS-specific secure storage
    if (env === RuntimeEnvironment.NODE) {
      return true;
    }

    // Web browsers have limited secure storage (localStorage with encryption)
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  }

  /**
   * Get platform-specific capabilities
   */
  static getCapabilities(): {
    environment: RuntimeEnvironment;
    supportsPopupWindows: boolean;
    supportsSystemBrowser: boolean;
    supportsCallbackServer: boolean;
    supportsSecureStorage: boolean;
    recommendedOAuthFlow: 'popup' | 'redirect' | 'system-browser';
  } {
    const environment = this.detectEnvironment();
    
    return {
      environment,
      supportsPopupWindows: this.supportsPopupWindows(),
      supportsSystemBrowser: this.supportsSystemBrowser(),
      supportsCallbackServer: this.supportsCallbackServer(),
      supportsSecureStorage: this.supportsSecureStorage(),
      recommendedOAuthFlow: this.getRecommendedOAuthFlow()
    };
  }

  /**
   * Get recommended OAuth flow for current environment
   */
  static getRecommendedOAuthFlow(): 'popup' | 'redirect' | 'system-browser' {
    const env = this.detectEnvironment();
    
    // Tauri should use system browser with callback server
    if (env === RuntimeEnvironment.TAURI) {
      return 'system-browser';
    }

    // Electron can use system browser or popup
    if (env === RuntimeEnvironment.ELECTRON) {
      return 'system-browser';
    }

    // Node.js should use system browser
    if (env === RuntimeEnvironment.NODE) {
      return 'system-browser';
    }

    // Web browsers should use popup or redirect
    if (this.supportsPopupWindows()) {
      return 'popup';
    } else {
      return 'redirect';
    }
  }
}

/**
 * OAuth Manager Factory
 * Creates appropriate OAuth manager based on runtime environment
 */
export class OAuthManagerFactory {
  /**
   * Create OAuth manager for current environment
   */
  static create(config?: Partial<OAuthConfig>): OAuthManager {
    const environment = EnvironmentDetector.detectEnvironment();
    
    switch (environment) {
      case RuntimeEnvironment.TAURI:
        // Dynamically import TauriOAuthManager to avoid loading Tauri modules during tests
        try {
          const { TauriOAuthManager } = require('../tauri/TauriOAuthManager');
          return new TauriOAuthManager(config) as unknown as OAuthManager;
        } catch (error) {
          // Fallback to base OAuth manager if Tauri modules are not available
          console.warn('TauriOAuthManager not available, falling back to base OAuthManager');
          return new OAuthManager(config);
        }
        
      case RuntimeEnvironment.ELECTRON:
        // For now, use base OAuth manager for Electron
        // Could be extended with Electron-specific implementation
        return new OAuthManager(config);
        
      case RuntimeEnvironment.NODE:
        return new OAuthManager(config);
        
      case RuntimeEnvironment.WEB:
      default:
        return new OAuthManager(config);
    }
  }

  /**
   * Create OAuth manager with environment-specific configuration
   */
  static createWithEnvironmentConfig(baseConfig?: Partial<OAuthConfig>): OAuthManager {
    const capabilities = EnvironmentDetector.getCapabilities();
    
    // Merge base config with environment-specific settings
    const environmentConfig: Partial<OAuthConfig> = {
      ...baseConfig,
      callbackServer: {
        host: '127.0.0.1',
        portRange: [8080, 8082],
        timeout: 300000, // 5 minutes
        maxRetries: 3,
        useHttps: false,
        ...baseConfig?.callbackServer
      },
      security: {
        stateExpiration: 600000, // 10 minutes
        pkceMethod: 'S256',
        tokenEncryption: capabilities.supportsSecureStorage,
        tokenRefreshBuffer: 300000, // 5 minutes
        maxAuthAttempts: 3,
        lockoutDuration: 900000, // 15 minutes
        ...baseConfig?.security
      }
    };

    return this.create(environmentConfig);
  }
}

/**
 * Global environment detection result
 */
export const RUNTIME_ENVIRONMENT = EnvironmentDetector.detectEnvironment();
export const ENVIRONMENT_CAPABILITIES = EnvironmentDetector.getCapabilities();

/**
 * Utility functions for environment-specific behavior
 */
export const isRunningInTauri = () => EnvironmentDetector.isTauri();
export const isRunningInWeb = () => EnvironmentDetector.isWeb();
export const isRunningInElectron = () => EnvironmentDetector.isElectron();
export const isRunningInNode = () => EnvironmentDetector.isNode();

/**
 * Create OAuth manager instance for current environment
 */
export const createEnvironmentOAuthManager = (config?: Partial<OAuthConfig>) => 
  OAuthManagerFactory.createWithEnvironmentConfig(config);