/**
 * Tauri OAuth Manager - Extends the base OAuth manager for Tauri desktop environment
 * Integrates with Tauri backend commands and handles desktop-specific OAuth flows
 * Requirements: 1.1, 1.5, 6.1, 6.4
 */

import { OAuthManager } from '../core/OAuthManager';
import { TauriOAuthBridge, tauriOAuthBridge } from './TauriOAuthBridge';
import { tauriOAuthNotifications } from './TauriOAuthNotifications';
import { TauriCallbackServer } from './TauriCallbackServer';
import { TauriBrowserLauncher } from './TauriBrowserLauncher';
import type {
  OAuthResult,
  OAuthConfig
} from '../interfaces';

// Static Tauri API imports
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { isTauriEnvironment } from '../../../utils/environment';
import { createLogger } from '../../../utils/logger';

const logger = createLogger('TauriOAuthManager');

/**
 * Tauri-specific OAuth Manager that handles desktop OAuth flows
 */
export class TauriOAuthManager extends OAuthManager {
  private tauriBridge: TauriOAuthBridge;
  private eventListeners: UnlistenFn[] = [];
  private isInitialized: boolean = false;

  constructor(config?: Partial<OAuthConfig>) {
    super(config);
    // Inject Tauri-specific callback server and browser launcher
    (this as any).callbackServer = new TauriCallbackServer(config?.callbackServer);
    (this as any).browserLauncher = new TauriBrowserLauncher();
    this.tauriBridge = tauriOAuthBridge;
    this.initializeTauriIntegration();
  }

  /**
   * Initialize Tauri-specific OAuth integration
   */
  private async initializeTauriIntegration(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      await this.setupTauriEventHandlers();
      this.isInitialized = true;
      logger.log('Tauri OAuth integration initialized');
    } catch (error) {
      logger.error('Failed to initialize Tauri OAuth integration:', error);
    }
  }

  /**
   * Setup event handlers for Tauri OAuth events
   */
  private async setupTauriEventHandlers(): Promise<void> {
    if (!isTauriEnvironment()) {
      logger.warn('Tauri event API not available');
      return;
    }

    try {
      // Handle OAuth flow start requests from Tauri
      const flowStartedUnlisten = await listen('oauth-flow-started', async (event: any) => {
        const { flow_id, provider } = event.payload;
        logger.log(`Starting OAuth flow ${flow_id} for provider ${provider}`);

        // Show authentication started notification
        await tauriOAuthNotifications.notifyAuthStarted(provider);

        try {
          // Use the base OAuth manager to handle the actual authentication
          const result = await super.authenticate(provider);

          // Show success or failure notification
          if (result.success) {
            await tauriOAuthNotifications.notifyAuthSuccess(provider, result);
          } else {
            await tauriOAuthNotifications.notifyAuthFailed(
              provider,
              result.error || 'Authentication failed',
              result.errorDescription
            );
          }

          // Complete the flow through Tauri bridge
          await this.tauriBridge.completeFlow(flow_id, result);

        } catch (error) {
          logger.error(`OAuth flow ${flow_id} failed:`, error);

          // Show failure notification
          await tauriOAuthNotifications.notifyAuthFailed(
            provider,
            'authentication_failed',
            error instanceof Error ? error.message : 'Unknown error'
          );

          await this.tauriBridge.handleError(
            flow_id,
            'authentication_failed',
            error instanceof Error ? error.message : 'Unknown error'
          );
        }
      });
      this.eventListeners.push(flowStartedUnlisten);

      // Handle status requests from Tauri
      const statusRequestedUnlisten = await listen('oauth-status-requested', async (event: any) => {
        const { provider } = event.payload;

        try {
          const isAuthenticated = await super.isAuthenticated(provider);
          // const tokens = await super.getValidTokens(provider);

          // Update Tauri with status information
          // Note: In a real implementation, you'd emit this back to Tauri
          logger.log(`OAuth status for ${provider}: ${isAuthenticated}`);

        } catch (error) {
          logger.error(`Failed to get OAuth status for ${provider}:`, error);
        }
      });
      this.eventListeners.push(statusRequestedUnlisten);

      // Handle all status requests from Tauri
      const allStatusRequestedUnlisten = await listen('oauth-all-status-requested', async () => {
        try {
          const status = await super.getAuthenticationStatus();
          logger.log('OAuth status for all providers:', status);

        } catch (error) {
          logger.error('Failed to get OAuth status for all providers:', error);
        }
      });
      this.eventListeners.push(allStatusRequestedUnlisten);

      // Handle logout requests from Tauri
      const logoutRequestedUnlisten = await listen('oauth-logout-requested', async (event: any) => {
        const { provider } = event.payload;

        try {
          await super.logout(provider);
          await tauriOAuthNotifications.notifyLogoutSuccess(provider);
          logger.log(`Logged out from ${provider}`);

        } catch (error) {
          logger.error(`Failed to logout from ${provider}:`, error);
        }
      });
      this.eventListeners.push(logoutRequestedUnlisten);

      // Handle provider list requests from Tauri
      const providersRequestedUnlisten = await listen('oauth-providers-requested', async () => {
        try {
          const providers = super.getRegisteredProviders();
          logger.log('Available OAuth providers:', providers);

        } catch (error) {
          logger.error('Failed to get OAuth providers:', error);
        }
      });
      this.eventListeners.push(providersRequestedUnlisten);

      // Handle token refresh requests from Tauri
      const refreshRequestedUnlisten = await listen('oauth-refresh-requested', async (event: any) => {
        const { provider } = event.payload;

        try {
          const success = await super.refreshTokens(provider);

          if (success) {
            await tauriOAuthNotifications.notifyTokenRefreshed(provider);
          } else {
            await tauriOAuthNotifications.notifyTokenExpired(provider, true);
          }

          logger.log(`Token refresh for ${provider}: ${success ? 'success' : 'failed'}`);

        } catch (error) {
          logger.error(`Failed to refresh tokens for ${provider}:`, error);
          await tauriOAuthNotifications.notifyTokenExpired(provider, true);
        }
      });
      this.eventListeners.push(refreshRequestedUnlisten);

      // Handle configuration validation requests from Tauri
      const configValidationUnlisten = await listen('oauth-config-validation-requested', async () => {
        try {
          const configManager = super.getConfigManager();
          const config = configManager.getConfig();
          const isValid = Object.keys(config.providers).length > 0;
          logger.log('OAuth configuration validation:', isValid);

        } catch (error) {
          logger.error('Failed to validate OAuth configuration:', error);
        }
      });
      this.eventListeners.push(configValidationUnlisten);

      // Handle configuration status requests from Tauri
      const configStatusUnlisten = await listen('oauth-config-status-requested', async () => {
        try {
          const configManager = super.getConfigManager();
          const config = configManager.getConfig();
          const status: Record<string, boolean> = {};

          for (const [providerName, providerConfig] of Object.entries(config.providers)) {
            status[providerName] = providerConfig.enabled && !!providerConfig.clientId;
          }

          logger.log('OAuth configuration status:', status);

        } catch (error) {
          logger.error('Failed to get OAuth configuration status:', error);
        }
      });
      this.eventListeners.push(configStatusUnlisten);

    } catch (error) {
      logger.error('Failed to setup Tauri event handlers:', error);
    }
  }

  /**
   * Override authenticate method to use Tauri bridge
   * Requirements: 1.1, 6.1
   */
  async authenticate(providerName: string): Promise<OAuthResult> {
    if (!this.isInitialized) {
      await this.initializeTauriIntegration();
    }

    try {
      // Use Tauri bridge for authentication in desktop environment
      return await this.tauriBridge.authenticate(providerName, false);
    } catch (error) {
      logger.error(`Tauri OAuth authentication failed for ${providerName}:`, error);

      // Fallback to base implementation if Tauri bridge fails
      return await super.authenticate(providerName);
    }
  }

  /**
   * Override isAuthenticated method to use Tauri bridge
   * Requirements: 1.5, 6.4
   */
  async isAuthenticated(providerName: string): Promise<boolean> {
    // Use base implementation which checks stored tokens directly
    return await super.isAuthenticated(providerName);
  }

  /**
   * Override getAuthenticationStatus method to use Tauri bridge
   * Requirements: 1.5
   */
  async getAuthenticationStatus(): Promise<Record<string, boolean>> {
    if (!this.isInitialized) {
      await this.initializeTauriIntegration();
    }

    try {
      // Try Tauri bridge first
      return await this.tauriBridge.getAllStatus();
    } catch (error) {
      logger.error('Tauri OAuth status check failed for all providers:', error);

      // Fallback to base implementation
      return await super.getAuthenticationStatus();
    }
  }

  /**
   * Override logout method to use Tauri bridge
   * Requirements: 4.4, 7.5
   */
  async logout(providerName: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initializeTauriIntegration();
    }

    try {
      // Use Tauri bridge for logout
      await this.tauriBridge.logout(providerName, false);
    } catch (error) {
      logger.error(`Tauri OAuth logout failed for ${providerName}:`, error);

      // Fallback to base implementation
      await super.logout(providerName);
    }
  }

  /**
   * Override refreshTokens method to use Tauri bridge
   * Requirements: 4.2, 4.3
   */
  async refreshTokens(providerName: string): Promise<boolean> {
    if (!this.isInitialized) {
      await this.initializeTauriIntegration();
    }

    try {
      // Try Tauri bridge first
      return await this.tauriBridge.refreshTokens(providerName);
    } catch (error) {
      logger.error(`Tauri OAuth token refresh failed for ${providerName}:`, error);

      // Fallback to base implementation
      return await super.refreshTokens(providerName);
    }
  }

  /**
   * Get Tauri bridge instance
   */
  getTauriBridge(): TauriOAuthBridge {
    return this.tauriBridge;
  }

  /**
   * Check if running in Tauri environment
   */
  static isTauriEnvironment(): boolean {
    return typeof window !== 'undefined' &&
      (window.__TAURI__ !== undefined || (window as any).__TAURI_INTERNALS__ !== undefined);
  }

  /**
   * Validate Tauri OAuth configuration
   */
  async validateTauriConfig(): Promise<boolean> {
    if (!this.isInitialized) {
      await this.initializeTauriIntegration();
    }

    try {
      return await this.tauriBridge.validateConfig();
    } catch (error) {
      logger.error('Failed to validate Tauri OAuth configuration:', error);
      return false;
    }
  }

  /**
   * Get Tauri OAuth configuration status
   */
  async getTauriConfigStatus(): Promise<Record<string, boolean>> {
    if (!this.isInitialized) {
      await this.initializeTauriIntegration();
    }

    try {
      return await this.tauriBridge.getConfigStatus();
    } catch (error) {
      logger.error('Failed to get Tauri OAuth configuration status:', error);
      return {};
    }
  }

  /**
   * Handle Tauri-specific OAuth errors
   */
  async handleTauriError(flowId: string | null, error: string, errorDescription?: string): Promise<void> {
    try {
      await this.tauriBridge.handleError(flowId, error, errorDescription);
    } catch (err) {
      logger.error('Failed to handle Tauri OAuth error:', err);
    }
  }

}

/**
 * Factory function to create appropriate OAuth manager based on environment
 */
export function createOAuthManager(config?: Partial<OAuthConfig>): OAuthManager {
  if (TauriOAuthManager.isTauriEnvironment()) {
    return new TauriOAuthManager(config);
  } else {
    return new OAuthManager(config);
  }
}