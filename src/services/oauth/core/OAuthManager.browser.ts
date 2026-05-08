/**
 * OAuth Manager - Browser-compatible version for Tauri frontend
 * Uses Tauri commands to communicate with the backend OAuth system
 * Provides the same interface as OAuthManager but delegates to Tauri backend
 */

import { invoke } from '@tauri-apps/api/core';
import { TokenStorage } from './TokenStorage';
import { StateManager } from './StateManager';
import { OAuthConfigManager } from './OAuthConfigManager';
import { 
  OAuthErrorHandler, 
  OAuthErrorType, 
  type OAuthError,
  getOAuthLogger,
  getOAuthMonitor,
  OAuthOperation,
  generateFlowId,
  type OAuthLogger,
  type OAuthMonitor
} from '../utils';
import type { 
  OAuthProvider, 
  OAuthTokens, 
  OAuthResult, 
  AuthenticationState,
  OAuthConfig
} from '../interfaces';

export class OAuthManager {
  private providers: Map<string, OAuthProvider> = new Map();
  private tokenStorage: TokenStorage;
  private stateManager: StateManager;
  private configManager: OAuthConfigManager;
  private currentAuthState: AuthenticationState | null = null;
  protected logger: OAuthLogger;
  protected monitor: OAuthMonitor;

  constructor(config?: Partial<OAuthConfig>) {
    this.configManager = new OAuthConfigManager(config);
    
    // Initialize logging and monitoring
    this.logger = getOAuthLogger();
    this.monitor = getOAuthMonitor();
    
    // Initialize browser-compatible components
    this.tokenStorage = new TokenStorage();
    this.stateManager = new StateManager(this.configManager.getSecurityConfig());
    
    // Initialize providers from configuration
    this.initializeProvidersFromConfig();
    
    this.logger.info(
      OAuthOperation.PROVIDER_REGISTERED,
      'OAuth Manager (Browser) initialized',
      { 
        providersCount: this.providers.size,
        mode: 'browser-tauri'
      }
    );
  }

  /**
   * Register an OAuth provider for authentication
   */
  registerProvider(provider: OAuthProvider): void {
    if (!provider.name || !provider.clientId) {
      const error = new Error('Provider must have a name and clientId');
      
      this.logger.error(
        OAuthOperation.PROVIDER_REGISTERED,
        'Failed to register provider - missing required fields',
        error,
        { 
          hasName: !!provider.name,
          hasClientId: !!provider.clientId,
          providerName: provider.name || 'unknown'
        }
      );
      
      throw error;
    }
    
    // Check if provider is enabled in configuration
    if (!this.configManager.isProviderEnabled(provider.name)) {
      this.logger.warn(
        OAuthOperation.PROVIDER_REGISTERED,
        'Provider is disabled in configuration',
        { enabledProviders: this.configManager.getEnabledProviders() },
        provider.name
      );
      return;
    }

    this.providers.set(provider.name, provider);
    
    this.logger.info(
      OAuthOperation.PROVIDER_REGISTERED,
      'OAuth provider registered successfully',
      { 
        providerName: provider.name,
        totalProviders: this.providers.size
      }
    );
  }

  /**
   * Initiate OAuth authentication flow using Tauri backend
   */
  async authenticate(providerName: string): Promise<OAuthResult> {
    const flowId = generateFlowId();
    
    try {
      this.logger.info(
        OAuthOperation.AUTH_INITIATED,
        'Starting OAuth authentication flow',
        { providerName, flowId }
      );

      const provider = this.providers.get(providerName);
      if (!provider) {
        throw new Error(`Provider '${providerName}' not found`);
      }

      // Use Tauri command to initiate OAuth flow
      const result = await invoke<OAuthResult>('oauth_authenticate', {
        providerName,
        config: {
          clientId: provider.clientId,
          scopes: provider.scopes,
          redirectUri: provider.redirectUri
        }
      });

      if (result.success && result.tokens) {
        // Store tokens locally
        await this.tokenStorage.storeTokens(providerName, result.tokens);
        
        this.currentAuthState = {
          isAuthenticated: true,
          provider: providerName,
          tokens: result.tokens,
          expiresAt: result.tokens.expiresAt
        };

        this.logger.info(
          OAuthOperation.AUTH_COMPLETED,
          'OAuth authentication completed successfully',
          { providerName, flowId }
        );

        this.monitor.recordAuthAttempt(providerName, true, Date.now());
      } else {
        this.logger.error(
          OAuthOperation.AUTH_COMPLETED,
          'OAuth authentication failed',
          new Error(result.error || 'Unknown error'),
          { providerName, flowId, error: result.error }
        );

        this.monitor.recordAuthAttempt(providerName, false, Date.now());
      }

      return result;

    } catch (error) {
      const oauthError = OAuthErrorHandler.handleError(error as Error, OAuthErrorType.AUTHENTICATION_FAILED);
      
      this.logger.error(
        OAuthOperation.AUTH_COMPLETED,
        'OAuth authentication failed with exception',
        oauthError,
        { providerName, flowId }
      );

      this.monitor.recordAuthAttempt(providerName, false, Date.now());
      
      return {
        success: false,
        error: oauthError.code,
        errorDescription: oauthError.message
      };
    }
  }

  /**
   * Get current authentication state
   */
  async getAuthenticationState(providerName: string): Promise<AuthenticationState | null> {
    try {
      const tokens = await this.tokenStorage.getTokens(providerName);
      
      if (!tokens) {
        return {
          isAuthenticated: false,
          provider: providerName
        };
      }

      // Check if tokens are expired
      const now = new Date();
      const isExpired = tokens.expiresAt && tokens.expiresAt <= now;

      if (isExpired && tokens.refreshToken) {
        // Try to refresh tokens
        const refreshResult = await this.refreshTokens(providerName);
        if (refreshResult.success && refreshResult.tokens) {
          return {
            isAuthenticated: true,
            provider: providerName,
            tokens: refreshResult.tokens,
            expiresAt: refreshResult.tokens.expiresAt
          };
        }
      }

      return {
        isAuthenticated: !isExpired,
        provider: providerName,
        tokens: isExpired ? undefined : tokens,
        expiresAt: tokens.expiresAt
      };

    } catch (error) {
      this.logger.error(
        OAuthOperation.TOKEN_VALIDATED,
        'Failed to get authentication state',
        error as Error,
        { providerName }
      );

      return {
        isAuthenticated: false,
        provider: providerName
      };
    }
  }

  /**
   * Refresh OAuth tokens using Tauri backend
   */
  async refreshTokens(providerName: string): Promise<OAuthResult> {
    try {
      this.logger.info(
        OAuthOperation.TOKEN_REFRESHED,
        'Starting token refresh',
        { providerName }
      );

      const currentTokens = await this.tokenStorage.getTokens(providerName);
      if (!currentTokens?.refreshToken) {
        throw new Error('No refresh token available');
      }

      // Use Tauri command to refresh tokens
      const result = await invoke<OAuthResult>('oauth_refresh_tokens', {
        providerName,
        refreshToken: currentTokens.refreshToken
      });

      if (result.success && result.tokens) {
        // Store new tokens
        await this.tokenStorage.storeTokens(providerName, result.tokens);
        
        this.currentAuthState = {
          isAuthenticated: true,
          provider: providerName,
          tokens: result.tokens,
          expiresAt: result.tokens.expiresAt
        };

        this.logger.info(
          OAuthOperation.TOKEN_REFRESHED,
          'Token refresh completed successfully',
          { providerName }
        );

        this.monitor.recordTokenRefresh(providerName, true, Date.now());
      } else {
        this.logger.error(
          OAuthOperation.TOKEN_REFRESHED,
          'Token refresh failed',
          new Error(result.error || 'Unknown error'),
          { providerName, error: result.error }
        );

        this.monitor.recordTokenRefresh(providerName, false, Date.now());
      }

      return result;

    } catch (error) {
      const oauthError = OAuthErrorHandler.handleError(error as Error, OAuthErrorType.TOKEN_REFRESH_FAILED);
      
      this.logger.error(
        OAuthOperation.TOKEN_REFRESHED,
        'Token refresh failed with exception',
        oauthError,
        { providerName }
      );

      this.monitor.recordTokenRefresh(providerName, false, Date.now());
      
      return {
        success: false,
        error: oauthError.code,
        errorDescription: oauthError.message
      };
    }
  }

  /**
   * Logout and cleanup tokens
   */
  async logout(providerName: string): Promise<void> {
    try {
      this.logger.info(
        OAuthOperation.LOGOUT_INITIATED,
        'Starting logout process',
        { providerName }
      );

      // Remove tokens from storage
      await this.tokenStorage.removeTokens(providerName);
      
      // Clear current auth state if it matches
      if (this.currentAuthState?.provider === providerName) {
        this.currentAuthState = null;
      }

      // Use Tauri command to cleanup backend state
      await invoke('oauth_logout', { providerName });

      this.logger.info(
        OAuthOperation.LOGOUT_COMPLETED,
        'Logout completed successfully',
        { providerName }
      );

    } catch (error) {
      this.logger.error(
        OAuthOperation.LOGOUT_COMPLETED,
        'Logout failed',
        error as Error,
        { providerName }
      );
      
      throw error;
    }
  }

  /**
   * Get list of registered providers
   */
  getProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Get OAuth configuration
   */
  getConfig(): OAuthConfig {
    return this.configManager.getConfig();
  }

  /**
   * Initialize providers from configuration
   */
  private initializeProvidersFromConfig(): void {
    const config = this.configManager.getConfig();
    
    // Initialize providers from config
    Object.entries(config.providers).forEach(([name, providerConfig]) => {
      if (providerConfig.enabled && providerConfig.clientId) {
        // Create a basic provider configuration
        const provider: OAuthProvider = {
          name,
          clientId: providerConfig.clientId,
          scopes: providerConfig.scopes || [],
          redirectUri: providerConfig.redirectUri || `http://localhost:8080/callback`,
          
          // These methods will delegate to Tauri backend
          buildAuthUrl: async () => '',
          exchangeCodeForTokens: async () => ({ success: false, error: 'Use Tauri backend' }),
          refreshTokens: async () => ({ success: false, error: 'Use Tauri backend' }),
          validateTokens: async () => false,
          getUserInfo: async () => null
        };
        
        this.registerProvider(provider);
      }
    });
  }
}