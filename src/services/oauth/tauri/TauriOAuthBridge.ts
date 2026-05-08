/**
 * Tauri OAuth Bridge - Interface between frontend OAuth manager and Tauri backend
 * Provides secure communication for OAuth operations in desktop environment
 * Requirements: 1.1, 1.5, 6.1, 6.4
 */

import type {
  OAuthTokens,
  OAuthResult
} from '../interfaces';

// Static Tauri API imports
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { isTauriEnvironment } from '../../../utils/environment';
import { createLogger } from '../../../utils/logger';

const logger = createLogger('TauriOAuthBridge');

/**
 * Tauri-specific OAuth token structure
 */
export interface TauriOAuthTokens {
  access_token: string;
  refresh_token?: string;
  expires_at: string; // ISO date string
  scope: string;
  token_type: string;
}

/**
 * Tauri OAuth authentication result
 */
export interface TauriOAuthResult {
  success: boolean;
  provider: string;
  tokens?: TauriOAuthTokens;
  error?: string;
  error_description?: string;
}

/**
 * OAuth authentication status from Tauri
 */
export interface TauriOAuthStatus {
  provider: string;
  is_authenticated: boolean;
  expires_at?: string;
  last_refresh?: string;
}

/**
 * OAuth provider information from Tauri
 */
export interface TauriOAuthProvider {
  name: string;
  display_name: string;
  enabled: boolean;
}

/**
 * OAuth authentication request for Tauri
 */
export interface TauriOAuthAuthRequest {
  provider: string;
  force_reauth?: boolean;
}

/**
 * OAuth logout request for Tauri
 */
export interface TauriOAuthLogoutRequest {
  provider: string;
  revoke_tokens?: boolean;
}

/**
 * OAuth flow event data
 */
export interface OAuthFlowEvent {
  flow_id: string;
  provider: string;
  force_reauth?: boolean;
}

/**
 * OAuth error event data
 */
export interface OAuthErrorEvent {
  flow_id?: string;
  error: string;
  error_description?: string;
}

/**
 * OAuth flow completion event data
 */
export interface OAuthFlowCompletionEvent {
  flow_id: string;
  result: TauriOAuthResult;
}

/**
 * Tauri OAuth Bridge class for handling OAuth operations in desktop environment
 */
export class TauriOAuthBridge {
  private eventListeners: UnlistenFn[] = [];
  private flowCallbacks: Map<string, {
    resolve: (result: OAuthResult) => void;
    reject: (error: Error) => void;
  }> = new Map();

  constructor() {
    this.setupEventListeners();
  }

  /**
   * Check if Tauri APIs are available
   */
  private async checkTauriAvailability(): Promise<void> {
    if (!isTauriEnvironment()) {
      throw new Error('Tauri OAuth bridge not available in this environment');
    }

    // Check mostly symbolic if static imports are used, but keeps bridge safe
    if (!invoke) {
      logger.error('Tauri APIs not available');
    }
  }

  /**
   * Setup event listeners for OAuth events from Tauri backend
   */
  private async setupEventListeners(): Promise<void> {
    if (!isTauriEnvironment()) {
      logger.warn('Tauri event API not available');
      return;
    }

    try {
      // Listen for OAuth flow started events
      const flowStartedUnlisten = await listen('oauth-flow-started', (event: any) => {
        logger.log('OAuth flow started:', event.payload);
        // Flow started, frontend OAuth manager will handle the actual flow
      });
      this.eventListeners.push(flowStartedUnlisten);

      // Listen for OAuth flow completion events
      const flowCompletedUnlisten = await listen('oauth-flow-completed', (event: any) => {
        const { flow_id, result } = event.payload;
        const callback = this.flowCallbacks.get(flow_id);

        if (callback) {
          const oauthResult: OAuthResult = {
            success: result.success,
            provider: result.provider,
            tokens: result.tokens ? this.convertTauriTokens(result.tokens) : undefined,
            error: result.error,
            errorDescription: result.error_description
          };

          if (result.success) {
            callback.resolve(oauthResult);
          } else {
            callback.reject(new Error(result.error || 'OAuth authentication failed'));
          }

          this.flowCallbacks.delete(flow_id);
        }
      });
      this.eventListeners.push(flowCompletedUnlisten);

      // Listen for OAuth error events
      const errorUnlisten = await listen('oauth-error', (event: any) => {
        const { flow_id, error, error_description } = event.payload;

        if (flow_id) {
          const callback = this.flowCallbacks.get(flow_id);
          if (callback) {
            callback.reject(new Error(error_description || error));
            this.flowCallbacks.delete(flow_id);
          }
        }

        logger.error('OAuth error:', error, error_description);
      });
      this.eventListeners.push(errorUnlisten);

    } catch (error) {
      logger.error('Failed to setup OAuth event listeners:', error);
    }
  }

  /**
   * Convert Tauri OAuth tokens to frontend format
   */
  private convertTauriTokens(tauriTokens: TauriOAuthTokens): OAuthTokens {
    return {
      accessToken: tauriTokens.access_token,
      refreshToken: tauriTokens.refresh_token,
      expiresAt: new Date(tauriTokens.expires_at),
      scope: tauriTokens.scope,
      tokenType: tauriTokens.token_type
    };
  }

  /**
   * Convert frontend OAuth tokens to Tauri format
   */
  private convertToTauriTokens(tokens: OAuthTokens): TauriOAuthTokens {
    return {
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expires_at: tokens.expiresAt.toISOString(),
      scope: tokens.scope,
      token_type: tokens.tokenType
    };
  }

  /**
   * Initiate OAuth authentication through Tauri backend
   * Requirements: 1.1, 6.1
   */
  async authenticate(provider: string, forceReauth: boolean = false): Promise<OAuthResult> {
    await this.checkTauriAvailability();

    try {
      const request: TauriOAuthAuthRequest = {
        provider,
        force_reauth: forceReauth
      };

      const flowId = await invoke('oauth_authenticate', { request }) as string;

      // Return a promise that will be resolved when the flow completes
      return new Promise<OAuthResult>((resolve, reject) => {
        this.flowCallbacks.set(flowId, { resolve, reject });

        // Set a timeout for the authentication flow
        setTimeout(() => {
          if (this.flowCallbacks.has(flowId)) {
            this.flowCallbacks.delete(flowId);
            reject(new Error('OAuth authentication timed out'));
          }
        }, 300000); // 5 minute timeout
      });

    } catch (error) {
      throw new Error(`Failed to initiate OAuth authentication: ${error}`);
    }
  }

  /**
   * Get OAuth authentication status for a provider
   * Requirements: 1.5, 6.4
   */
  async getStatus(provider: string): Promise<boolean> {
    await this.checkTauriAvailability();

    try {
      const status = await invoke('oauth_get_status', { provider }) as TauriOAuthStatus;
      return status.is_authenticated;
    } catch (error) {
      logger.error(`Failed to get OAuth status for ${provider}:`, error);
      return false;
    }
  }

  /**
   * Get authentication status for all providers
   * Requirements: 1.5
   */
  async getAllStatus(): Promise<Record<string, boolean>> {
    await this.checkTauriAvailability();

    try {
      const statusList = await invoke('oauth_get_all_status') as TauriOAuthStatus[];
      const statusMap: Record<string, boolean> = {};

      for (const status of statusList) {
        statusMap[status.provider] = status.is_authenticated;
      }

      return statusMap;
    } catch (error) {
      logger.error('Failed to get OAuth status for all providers:', error);
      return {};
    }
  }

  /**
   * Logout from OAuth provider
   * Requirements: 4.4, 7.5
   */
  async logout(provider: string, revokeTokens: boolean = false): Promise<void> {
    await this.checkTauriAvailability();

    try {
      const request: TauriOAuthLogoutRequest = {
        provider,
        revoke_tokens: revokeTokens
      };

      await invoke('oauth_logout', { request }) as boolean;
    } catch (error) {
      throw new Error(`Failed to logout from ${provider}: ${error}`);
    }
  }

  /**
   * Get list of available OAuth providers
   * Requirements: 5.1
   */
  async getProviders(): Promise<string[]> {
    await this.checkTauriAvailability();

    try {
      const providers = await invoke('oauth_get_providers') as TauriOAuthProvider[];
      return providers.filter(p => p.enabled).map(p => p.name);
    } catch (error) {
      logger.error('Failed to get OAuth providers:', error);
      return [];
    }
  }

  /**
   * Refresh tokens for a provider
   * Requirements: 4.2, 4.3
   */
  async refreshTokens(provider: string): Promise<boolean> {
    await this.checkTauriAvailability();

    try {
      return await invoke('oauth_refresh_tokens', { provider }) as boolean;
    } catch (error) {
      logger.error(`Failed to refresh tokens for ${provider}:`, error);
      return false;
    }
  }

  /**
   * Get OAuth flow status
   */
  async getFlowStatus(flowId: string): Promise<string | null> {
    await this.checkTauriAvailability();

    try {
      return await invoke('oauth_get_flow_status', { flowId }) as string | null;
    } catch (error) {
      logger.error(`Failed to get flow status for ${flowId}:`, error);
      return null;
    }
  }

  /**
   * Update OAuth flow status
   */
  async updateFlowStatus(flowId: string, status: string): Promise<void> {
    await this.checkTauriAvailability();

    try {
      await invoke('oauth_update_flow_status', { flowId, status });
    } catch (error) {
      logger.error(`Failed to update flow status for ${flowId}:`, error);
    }
  }

  /**
   * Complete OAuth flow
   */
  async completeFlow(flowId: string, result: OAuthResult): Promise<void> {
    await this.checkTauriAvailability();

    try {
      const tauriResult: TauriOAuthResult = {
        success: result.success,
        provider: result.provider,
        tokens: result.tokens ? this.convertToTauriTokens(result.tokens) : undefined,
        error: result.error,
        error_description: result.errorDescription
      };

      await invoke('oauth_complete_flow', { flowId, result: tauriResult });
    } catch (error) {
      logger.error(`Failed to complete OAuth flow ${flowId}:`, error);
    }
  }

  /**
   * Handle OAuth errors
   */
  async handleError(flowId: string | null, error: string, errorDescription?: string): Promise<void> {
    await this.checkTauriAvailability();

    try {
      await invoke('oauth_handle_error', { flowId, error, errorDescription });
    } catch (err) {
      logger.error('Failed to handle OAuth error:', err);
    }
  }

  /**
   * Get last OAuth error
   */
  async getLastError(): Promise<string | null> {
    await this.checkTauriAvailability();

    try {
      return await invoke('oauth_get_last_error') as string | null;
    } catch (error) {
      logger.error('Failed to get last OAuth error:', error);
      return null;
    }
  }

  /**
   * Clear OAuth errors
   */
  async clearErrors(): Promise<void> {
    await this.checkTauriAvailability();

    try {
      await invoke('oauth_clear_errors');
    } catch (error) {
      logger.error('Failed to clear OAuth errors:', error);
    }
  }

  /**
   * Validate OAuth configuration
   */
  async validateConfig(): Promise<boolean> {
    await this.checkTauriAvailability();

    try {
      return await invoke('oauth_validate_config') as boolean;
    } catch (error) {
      logger.error('Failed to validate OAuth configuration:', error);
      return false;
    }
  }

  /**
   * Get OAuth configuration status
   */
  async getConfigStatus(): Promise<Record<string, boolean>> {
    await this.checkTauriAvailability();

    try {
      return await invoke('oauth_get_config_status') as Record<string, boolean>;
    } catch (error) {
      logger.error('Failed to get OAuth configuration status:', error);
      return {};
    }
  }

  /**
   * Cleanup event listeners
   */
  async cleanup(): Promise<void> {
    for (const unlisten of this.eventListeners) {
      unlisten();
    }
    this.eventListeners = [];
    this.flowCallbacks.clear();
  }
}

/**
 * Global Tauri OAuth Bridge instance
 */
export const tauriOAuthBridge = new TauriOAuthBridge();