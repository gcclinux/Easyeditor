/**
 * OAuth Manager - Central orchestrator for OAuth authentication flows
 * Integrates StateManager, CallbackServer, BrowserLauncher, and TokenStorage
 * Provides complete OAuth flow from initiation to token storage
 */

import { StateManager } from './StateManager';
import { CallbackServer } from './CallbackServer';
import { BrowserLauncher } from './BrowserLauncher';
import { TokenStorage } from './TokenStorage';
import { OAuthConfigManager } from './OAuthConfigManager';
import { ProviderFactory } from '../providers';
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
  private callbackServer: CallbackServer;
  private browserLauncher: BrowserLauncher;
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
    
    // Initialize components with configuration
    const callbackConfig = this.configManager.getCallbackServerConfig();
    this.callbackServer = new CallbackServer(callbackConfig);
    this.browserLauncher = new BrowserLauncher();
    this.tokenStorage = new TokenStorage();
    this.stateManager = new StateManager(this.configManager.getSecurityConfig());
    
    // Initialize providers from configuration
    this.initializeProvidersFromConfig();
    
    this.logger.info(
      OAuthOperation.PROVIDER_REGISTERED,
      'OAuth Manager initialized',
      { 
        providersCount: this.providers.size,
        callbackConfig: { host: callbackConfig.host, portRange: callbackConfig.portRange }
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
    
    // Note: Removed config check to allow dynamic provider registration
    // This is necessary for shared OAuth manager pattern where providers
    // register themselves after manager creation
    
    this.providers.set(provider.name, provider);
    
    this.logger.info(
      OAuthOperation.PROVIDER_REGISTERED,
      'OAuth provider registered successfully',
      { 
        displayName: provider.displayName,
        scope: provider.scope,
        totalProviders: this.providers.size
      },
      provider.name
    );
  }

  /**
   * Get the configuration manager
   */
  getConfigManager(): OAuthConfigManager {
    return this.configManager;
  }

  /**
   * Update OAuth configuration
   */
  updateConfig(config: Partial<OAuthConfig>): void {
    // Create new config manager with updated configuration
    const currentConfig = this.configManager.getConfig();
    const mergedConfig = { ...currentConfig, ...config };
    this.configManager = new OAuthConfigManager(mergedConfig);
    
    // Reinitialize components with new configuration
    const callbackConfig = this.configManager.getCallbackServerConfig();
    this.callbackServer = new CallbackServer(callbackConfig);
    this.stateManager = new StateManager(this.configManager.getSecurityConfig());
    
    // Reinitialize providers from updated configuration
    this.initializeProvidersFromConfig();
  }

  /**
   * Initialize OAuth providers from configuration
   */
  private initializeProvidersFromConfig(): void {
    const config = this.configManager.getConfig();
    
    // Clear existing providers
    this.providers.clear();
    
    // Create providers from configuration
    const configuredProviders = ProviderFactory.createProvidersFromConfig(config.providers);
    
    // Add providers to manager
    for (const [providerName, provider] of configuredProviders) {
      this.providers.set(providerName, provider);
    }
  }

  /**
   * Get a registered provider by name
   */
  getProvider(providerName: string): OAuthProvider | undefined {
    return this.providers.get(providerName);
  }

  /**
   * List all registered provider names
   */
  getRegisteredProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Initiate OAuth authentication flow for a provider
   * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
   */
  async authenticate(providerName: string): Promise<OAuthResult> {
    const flowId = generateFlowId();
    const startTime = Date.now();
    
    this.logger.startTiming(`auth_${flowId}`, OAuthOperation.FLOW_INITIATED);
    this.logger.info(
      OAuthOperation.FLOW_INITIATED,
      `Starting OAuth authentication flow`,
      { providerName },
      providerName,
      flowId
    );

    const provider = this.providers.get(providerName);
    if (!provider) {
      const error = OAuthErrorHandler.createError(
        OAuthErrorType.PROVIDER_NOT_FOUND,
        `OAuth provider '${providerName}' is not registered`
      );
      
      this.logger.error(
        OAuthOperation.AUTHENTICATION_FAILED,
        `Provider not found: ${providerName}`,
        new Error(error.message),
        { availableProviders: Array.from(this.providers.keys()) },
        providerName,
        flowId
      );
      
      this.monitor.recordAuthAttempt(providerName, false, Date.now() - startTime, new Error(error.message));
      
      return {
        success: false,
        provider: providerName,
        error: error.type,
        errorDescription: error.userMessage
      };
    }

    try {
      // Step 1: Initiate the OAuth flow with timeout and error handling
      this.logger.debug(
        OAuthOperation.CALLBACK_SERVER_STARTED,
        'Starting callback server',
        undefined,
        providerName,
        flowId
      );
      
      const authState = await OAuthErrorHandler.withTimeout(
        () => this.initiateFlow(provider),
        30000, // 30 second timeout for server startup
        () => this.cleanup()
      );
      this.currentAuthState = authState;

      this.logger.info(
        OAuthOperation.STATE_GENERATED,
        'OAuth state and PKCE parameters generated',
        { 
          redirectUri: authState.redirectUri,
          stateLength: authState.state.length,
          codeVerifierLength: authState.codeVerifier.length
        },
        providerName,
        flowId
      );

      // Step 2: Open browser with authorization URL and handle launch failures
      const authUrl = provider.buildAuthUrl(
        authState.redirectUri,
        authState.state,
        authState.codeChallenge
      );
      
      this.logger.debug(
        OAuthOperation.BROWSER_LAUNCHED,
        'Opening system browser for authentication',
        { authUrlLength: authUrl.length },
        providerName,
        flowId
      );
      
      try {
        await this.browserLauncher.openUrl(authUrl);
        
        this.logger.info(
          OAuthOperation.BROWSER_LAUNCHED,
          'System browser launched successfully',
          undefined,
          providerName,
          flowId
        );
      } catch (browserError) {
        const error = OAuthErrorHandler.createError(
          OAuthErrorType.BROWSER_LAUNCH_FAILED,
          browserError instanceof Error ? browserError.message : 'Browser launch failed',
          browserError instanceof Error ? browserError : undefined,
          `Unable to open your web browser. Please copy this URL and open it manually: ${authUrl}`
        );
        
        this.logger.error(
          OAuthOperation.AUTHENTICATION_FAILED,
          'Failed to launch system browser',
          browserError instanceof Error ? browserError : new Error('Browser launch failed'),
          { authUrlLength: authUrl.length },
          providerName,
          flowId
        );
        
        this.monitor.recordAuthAttempt(providerName, false, Date.now() - startTime, browserError instanceof Error ? browserError : new Error('Browser launch failed'));
        
        return {
          success: false,
          provider: providerName,
          error: error.type,
          errorDescription: error.userMessage
        };
      }

      // Step 3: Wait for callback with comprehensive error handling
      this.logger.info(
        OAuthOperation.CALLBACK_RECEIVED,
        'Waiting for OAuth callback from browser',
        { timeoutMs: 300000 },
        providerName,
        flowId
      );
      
      const callbackResult = await OAuthErrorHandler.withTimeout(
        () => this.callbackServer.waitForCallback(),
        300000, // 5 minute timeout for user interaction
        () => this.cleanup()
      );
      
      if (!callbackResult.success) {
        // Check for user cancellation
        const cancellationError = OAuthErrorHandler.detectUserCancellation(
          callbackResult.error || 'callback_failed'
        );
        
        if (cancellationError) {
          this.logger.warn(
            OAuthOperation.AUTHENTICATION_FAILED,
            'User cancelled authentication',
            { error: callbackResult.error, errorDescription: callbackResult.errorDescription },
            providerName,
            flowId
          );
          
          this.monitor.recordAuthAttempt(providerName, false, Date.now() - startTime, new Error('User cancelled'));
          
          return {
            success: false,
            provider: providerName,
            error: cancellationError.type,
            errorDescription: cancellationError.userMessage
          };
        }
        
        // Handle OAuth protocol errors
        if (callbackResult.error) {
          const oauthError = OAuthErrorHandler.parseOAuthError(
            callbackResult.error,
            callbackResult.errorDescription
          );
          
          this.logger.error(
            OAuthOperation.AUTHENTICATION_FAILED,
            'OAuth protocol error in callback',
            new Error(`${callbackResult.error}: ${callbackResult.errorDescription}`),
            { error: callbackResult.error, errorDescription: callbackResult.errorDescription },
            providerName,
            flowId
          );
          
          // Record security event for certain error types
          if (callbackResult.error === 'access_denied' || callbackResult.error === 'invalid_request') {
            this.monitor.recordSecurityEvent('invalid_callback', providerName, { 
              error: callbackResult.error, 
              errorDescription: callbackResult.errorDescription 
            });
          }
          
          this.monitor.recordAuthAttempt(providerName, false, Date.now() - startTime, new Error(oauthError.message));
          
          return {
            success: false,
            provider: providerName,
            error: oauthError.type,
            errorDescription: oauthError.userMessage
          };
        }
        
        // Generic callback failure
        const error = OAuthErrorHandler.createError(
          OAuthErrorType.CALLBACK_FAILED,
          callbackResult.errorDescription || 'OAuth callback failed'
        );
        
        this.logger.error(
          OAuthOperation.AUTHENTICATION_FAILED,
          'Generic callback failure',
          new Error(error.message),
          { errorDescription: callbackResult.errorDescription },
          providerName,
          flowId
        );
        
        this.monitor.recordAuthAttempt(providerName, false, Date.now() - startTime, new Error(error.message));
        
        return {
          success: false,
          provider: providerName,
          error: error.type,
          errorDescription: error.userMessage
        };
      }

      this.logger.info(
        OAuthOperation.CALLBACK_RECEIVED,
        'OAuth callback received successfully',
        { 
          hasCode: !!callbackResult.code,
          hasState: !!callbackResult.state,
          codeLength: callbackResult.code?.length
        },
        providerName,
        flowId
      );

      // Step 4: Handle the callback and exchange tokens with retry logic
      this.logger.info(
        OAuthOperation.TOKEN_EXCHANGE,
        'Starting token exchange',
        undefined,
        providerName,
        flowId
      );
      
      const tokens = await OAuthErrorHandler.withRetry(
        () => this.handleCallback(callbackResult.code!, callbackResult.state!, provider),
        { maxRetries: 3 },
        (attempt, error) => {
          this.logger.logRetry(
            OAuthOperation.TOKEN_EXCHANGE,
            attempt,
            3,
            error instanceof Error ? error : new Error(error.message || 'Unknown error'),
            providerName,
            flowId
          );
        }
      );

      this.logger.info(
        OAuthOperation.TOKEN_EXCHANGE,
        'Token exchange completed successfully',
        { 
          hasAccessToken: !!tokens.accessToken,
          hasRefreshToken: !!tokens.refreshToken,
          expiresAt: tokens.expiresAt.toISOString(),
          scope: tokens.scope
        },
        providerName,
        flowId
      );

      // Step 5: Store tokens securely with error handling
      try {
        await this.tokenStorage.storeTokens(providerName, tokens);
        
        this.logger.info(
          OAuthOperation.TOKEN_STORED,
          'Tokens stored securely',
          { 
            hasRefreshToken: !!tokens.refreshToken,
            expiresAt: tokens.expiresAt.toISOString()
          },
          providerName,
          flowId
        );
      } catch (storageError) {
        const error = OAuthErrorHandler.createError(
          OAuthErrorType.TOKEN_STORAGE_ERROR,
          storageError instanceof Error ? storageError.message : 'Token storage failed',
          storageError instanceof Error ? storageError : undefined
        );
        
        this.logger.error(
          OAuthOperation.AUTHENTICATION_FAILED,
          'Failed to store tokens',
          storageError instanceof Error ? storageError : new Error('Token storage failed'),
          undefined,
          providerName,
          flowId
        );
        
        this.monitor.recordAuthAttempt(providerName, false, Date.now() - startTime, storageError instanceof Error ? storageError : new Error('Token storage failed'));
        
        return {
          success: false,
          provider: providerName,
          error: error.type,
          errorDescription: error.userMessage
        };
      }

      const duration = this.logger.endTiming(`auth_${flowId}`, providerName, flowId);
      
      this.logger.info(
        OAuthOperation.AUTHENTICATION_SUCCESS,
        'OAuth authentication completed successfully',
        { totalDuration: duration },
        providerName,
        flowId
      );
      
      this.monitor.recordAuthAttempt(providerName, true, duration);

      return {
        success: true,
        provider: providerName,
        tokens
      };

    } catch (error) {
      const duration = this.logger.endTiming(`auth_${flowId}`, providerName, flowId);
      
      // Handle different types of errors appropriately
      if (error && typeof error === 'object' && 'type' in error) {
        const oauthError = error as OAuthError;
        
        this.logger.error(
          OAuthOperation.AUTHENTICATION_FAILED,
          `OAuth error: ${oauthError.message}`,
          oauthError.originalError || new Error(oauthError.message),
          { errorType: oauthError.type, canRetry: oauthError.canRetry },
          providerName,
          flowId
        );
        
        this.monitor.recordAuthAttempt(providerName, false, duration, oauthError.originalError);
        
        return {
          success: false,
          provider: providerName,
          error: oauthError.type,
          errorDescription: oauthError.userMessage
        };
      }
      
      // Handle network errors
      if (error instanceof Error) {
        const networkError = OAuthErrorHandler.parseNetworkError(error);
        
        this.logger.error(
          OAuthOperation.AUTHENTICATION_FAILED,
          `Network error during authentication: ${error.message}`,
          error,
          { errorType: networkError.type },
          providerName,
          flowId
        );
        
        this.monitor.recordAuthAttempt(providerName, false, duration, error);
        
        return {
          success: false,
          provider: providerName,
          error: networkError.type,
          errorDescription: networkError.userMessage
        };
      }
      
      // Fallback for unknown errors
      const unknownError = OAuthErrorHandler.createError(
        OAuthErrorType.SERVER_ERROR,
        'Unknown authentication error occurred'
      );
      
      this.logger.error(
        OAuthOperation.AUTHENTICATION_FAILED,
        'Unknown error during authentication',
        new Error('Unknown error'),
        { originalError: error },
        providerName,
        flowId
      );
      
      this.monitor.recordAuthAttempt(providerName, false, duration, new Error('Unknown error'));
      
      return {
        success: false,
        provider: providerName,
        error: unknownError.type,
        errorDescription: unknownError.userMessage
      };
    } finally {
      // Always cleanup resources
      await this.cleanup();
    }
  }

  /**
   * Check if a provider is currently authenticated with valid tokens
   */
  async isAuthenticated(providerName: string): Promise<boolean> {
    try {
      const tokens = await this.getValidTokens(providerName);
      return tokens !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get valid tokens for a provider, refreshing if necessary
   */
  async getValidTokens(providerName: string): Promise<OAuthTokens | null> {
    this.logger.debug(
      OAuthOperation.TOKEN_RETRIEVED,
      'Retrieving valid tokens',
      undefined,
      providerName
    );
    
    const provider = this.providers.get(providerName);
    if (!provider) {
      this.logger.warn(
        OAuthOperation.TOKEN_RETRIEVED,
        'Provider not found when retrieving tokens',
        { availableProviders: Array.from(this.providers.keys()) },
        providerName
      );
      return null;
    }

    // Get stored tokens
    const storedTokens = await this.tokenStorage.getTokens(providerName);
    if (!storedTokens) {
      this.logger.debug(
        OAuthOperation.TOKEN_RETRIEVED,
        'No stored tokens found',
        undefined,
        providerName
      );
      return null;
    }

    // Check if tokens are expired first (faster than API call)
    const now = new Date();
    const isExpired = storedTokens.expiresAt <= now;
    const timeUntilExpiry = storedTokens.expiresAt.getTime() - now.getTime();
    
    this.logger.debug(
      OAuthOperation.TOKEN_VALIDATED,
      'Checking token expiration',
      { 
        isExpired,
        expiresAt: storedTokens.expiresAt.toISOString(),
        timeUntilExpiryMs: timeUntilExpiry
      },
      providerName
    );
    
    if (!isExpired) {
      // Tokens appear valid by expiration, verify with provider
      try {
        const isValid = await provider.validateTokens(storedTokens);
        if (isValid) {
          this.logger.debug(
            OAuthOperation.TOKEN_VALIDATED,
            'Tokens validated successfully with provider',
            { timeUntilExpiryMs: timeUntilExpiry },
            providerName
          );
          return storedTokens;
        } else {
          this.logger.warn(
            OAuthOperation.TOKEN_EXPIRED,
            'Tokens failed provider validation despite not being expired',
            { timeUntilExpiryMs: timeUntilExpiry },
            providerName
          );
        }
      } catch (error) {
        this.logger.error(
          OAuthOperation.TOKEN_VALIDATED,
          'Error validating tokens with provider',
          error instanceof Error ? error : new Error('Unknown validation error'),
          { timeUntilExpiryMs: timeUntilExpiry },
          providerName
        );
      }
    } else {
      this.logger.info(
        OAuthOperation.TOKEN_EXPIRED,
        'Tokens are expired',
        { 
          expiresAt: storedTokens.expiresAt.toISOString(),
          expiredByMs: Math.abs(timeUntilExpiry)
        },
        providerName
      );
    }

    // Tokens are expired or invalid, try to refresh
    if (storedTokens.refreshToken) {
      this.logger.info(
        OAuthOperation.TOKEN_REFRESHED,
        'Attempting to refresh expired/invalid tokens',
        undefined,
        providerName
      );
      
      const refreshResult = await this.refreshTokensWithErrorHandling(providerName);
      if (refreshResult.success) {
        const refreshedTokens = await this.tokenStorage.getTokens(providerName);
        
        this.logger.info(
          OAuthOperation.TOKEN_RETRIEVED,
          'Successfully retrieved refreshed tokens',
          { 
            newExpiresAt: refreshedTokens?.expiresAt.toISOString()
          },
          providerName
        );
        
        return refreshedTokens;
      } else {
        // Refresh failed, clean up if re-auth is required
        if (refreshResult.requiresReauth) {
          this.logger.warn(
            OAuthOperation.TOKEN_DELETED,
            'Removing tokens due to refresh failure requiring re-authentication',
            { error: refreshResult.error },
            providerName
          );
          
          await this.tokenStorage.removeTokens(providerName);
        }
      }
    } else {
      this.logger.warn(
        OAuthOperation.TOKEN_EXPIRED,
        'No refresh token available for expired tokens',
        undefined,
        providerName
      );
    }

    return null;
  }

  /**
   * Refresh tokens for a provider (simplified interface)
   */
  async refreshTokens(providerName: string): Promise<boolean> {
    const result = await this.refreshTokensWithErrorHandling(providerName);
    return result.success;
  }

  /**
   * Logout from a provider by removing stored tokens
   */
  async logout(providerName: string): Promise<void> {
    this.logger.info(
      OAuthOperation.TOKEN_DELETED,
      'Starting logout process',
      undefined,
      providerName
    );
    
    try {
      await this.tokenStorage.removeTokens(providerName);
      
      this.logger.info(
        OAuthOperation.TOKEN_DELETED,
        'Logout completed successfully - tokens removed',
        undefined,
        providerName
      );
    } catch (error) {
      this.logger.error(
        OAuthOperation.TOKEN_DELETED,
        'Error during logout process',
        error instanceof Error ? error : new Error('Unknown logout error'),
        undefined,
        providerName
      );
      throw error;
    }
  }

  /**
   * Get authentication status for all registered providers
   */
  async getAuthenticationStatus(): Promise<Record<string, boolean>> {
    const status: Record<string, boolean> = {};
    
    for (const providerName of this.providers.keys()) {
      status[providerName] = await this.isAuthenticated(providerName);
    }
    
    return status;
  }

  /**
   * Validate stored tokens on app startup and refresh if needed
   * Requirements: 4.1, 4.2, 4.3
   */
  async validateStoredTokensOnStartup(): Promise<Record<string, 'valid' | 'refreshed' | 'expired' | 'missing'>> {
    const results: Record<string, 'valid' | 'refreshed' | 'expired' | 'missing'> = {};
    
    for (const providerName of this.providers.keys()) {
      try {
        const storedTokens = await this.tokenStorage.getTokens(providerName);
        
        if (!storedTokens) {
          results[providerName] = 'missing';
          continue;
        }

        // Check if tokens are expired
        const now = new Date();
        const isExpired = storedTokens.expiresAt <= now;
        
        if (!isExpired) {
          // Tokens are still valid, verify with provider
          const provider = this.providers.get(providerName);
          if (provider) {
            const isValid = await provider.validateTokens(storedTokens);
            if (isValid) {
              results[providerName] = 'valid';
              continue;
            }
          }
        }

        // Tokens are expired or invalid, try to refresh
        if (storedTokens.refreshToken) {
          const refreshSuccess = await this.refreshTokens(providerName);
          if (refreshSuccess) {
            results[providerName] = 'refreshed';
          } else {
            results[providerName] = 'expired';
            // Clean up invalid tokens
            await this.tokenStorage.removeTokens(providerName);
          }
        } else {
          results[providerName] = 'expired';
          // Clean up expired tokens without refresh token
          await this.tokenStorage.removeTokens(providerName);
        }
        
      } catch (error) {
        console.error(`Error validating tokens for ${providerName}:`, error);
        results[providerName] = 'expired';
        // Clean up problematic tokens
        try {
          await this.tokenStorage.removeTokens(providerName);
        } catch (cleanupError) {
          console.error(`Error cleaning up tokens for ${providerName}:`, cleanupError);
        }
      }
    }
    
    return results;
  }

  /**
   * Handle token refresh failure by prompting for re-authentication
   * Requirements: 4.3, 4.5
   */
  async handleTokenRefreshFailure(providerName: string): Promise<{
    requiresReauth: boolean;
    message: string;
    canRetry: boolean;
  }> {
    const provider = this.providers.get(providerName);
    if (!provider) {
      return {
        requiresReauth: false,
        message: `Provider '${providerName}' not found`,
        canRetry: false
      };
    }

    try {
      // Clean up invalid tokens
      await this.tokenStorage.removeTokens(providerName);
      
      return {
        requiresReauth: true,
        message: `Your ${provider.displayName} session has expired. Please sign in again to continue using cloud features.`,
        canRetry: true
      };
    } catch (error) {
      console.error(`Error handling refresh failure for ${providerName}:`, error);
      return {
        requiresReauth: true,
        message: `Authentication error occurred. Please sign in again.`,
        canRetry: true
      };
    }
  }

  /**
   * Enhanced token refresh with comprehensive error handling and retry logic
   * Requirements: 4.2, 4.5, 3.1, 3.2
   */
  async refreshTokensWithErrorHandling(providerName: string): Promise<{
    success: boolean;
    error?: string;
    requiresReauth?: boolean;
  }> {
    const startTime = Date.now();
    const refreshId = `refresh_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    this.logger.startTiming(`refresh_${refreshId}`, OAuthOperation.TOKEN_REFRESHED);
    this.logger.info(
      OAuthOperation.TOKEN_REFRESHED,
      'Starting token refresh',
      undefined,
      providerName,
      refreshId
    );

    const provider = this.providers.get(providerName);
    if (!provider) {
      const error = OAuthErrorHandler.createError(
        OAuthErrorType.PROVIDER_NOT_FOUND,
        `Provider '${providerName}' not found`
      );
      
      this.logger.error(
        OAuthOperation.TOKEN_REFRESH_FAILED,
        `Provider not found for token refresh: ${providerName}`,
        new Error(error.message),
        { availableProviders: Array.from(this.providers.keys()) },
        providerName,
        refreshId
      );
      
      return {
        success: false,
        error: error.userMessage
      };
    }

    const storedTokens = await this.tokenStorage.getTokens(providerName);
    if (!storedTokens || !storedTokens.refreshToken) {
      const error = OAuthErrorHandler.createError(
        OAuthErrorType.INVALID_GRANT,
        'No refresh token available'
      );
      
      this.logger.warn(
        OAuthOperation.TOKEN_REFRESH_FAILED,
        'No refresh token available',
        { hasStoredTokens: !!storedTokens, hasRefreshToken: !!storedTokens?.refreshToken },
        providerName,
        refreshId
      );
      
      this.monitor.recordTokenRefresh(providerName, false, Date.now() - startTime, new Error('No refresh token'));
      
      return {
        success: false,
        error: error.userMessage,
        requiresReauth: true
      };
    }

    try {
      // Attempt token refresh with retry logic for network errors
      this.logger.debug(
        OAuthOperation.TOKEN_REFRESHED,
        'Attempting token refresh with provider',
        { 
          tokenExpiresAt: storedTokens.expiresAt.toISOString(),
          isExpired: storedTokens.expiresAt <= new Date()
        },
        providerName,
        refreshId
      );
      
      const tokenResponse = await OAuthErrorHandler.withRetry(
        () => provider.refreshTokens(storedTokens.refreshToken!),
        { 
          maxRetries: 3,
          baseDelay: 2000, // 2 seconds
          maxDelay: 10000  // 10 seconds max
        },
        (attempt, error) => {
          this.logger.logRetry(
            OAuthOperation.TOKEN_REFRESHED,
            attempt,
            3,
            error instanceof Error ? error : new Error(error.message || 'Unknown error'),
            providerName,
            refreshId
          );
        }
      );
      
      if (tokenResponse.error) {
        // Parse OAuth error response
        const oauthError = OAuthErrorHandler.parseOAuthError(
          tokenResponse.error,
          tokenResponse.error_description
        );
        
        this.logger.error(
          OAuthOperation.TOKEN_REFRESH_FAILED,
          `Token refresh failed: ${tokenResponse.error}`,
          oauthError.originalError || new Error(`${tokenResponse.error}: ${tokenResponse.error_description}`),
          { 
            error: tokenResponse.error, 
            errorDescription: tokenResponse.error_description,
            requiresReauth: oauthError.requiresReauth
          },
          providerName,
          refreshId
        );
        
        // Clean up tokens if re-authentication is required
        if (oauthError.requiresReauth) {
          try {
            await this.tokenStorage.removeTokens(providerName);
            
            this.logger.info(
              OAuthOperation.TOKEN_DELETED,
              'Tokens removed due to refresh failure requiring re-authentication',
              { error: tokenResponse.error },
              providerName,
              refreshId
            );
          } catch (cleanupError) {
            this.logger.error(
              OAuthOperation.TOKEN_REFRESH_FAILED,
              'Error cleaning up tokens after refresh failure',
              cleanupError instanceof Error ? cleanupError : new Error('Unknown cleanup error'),
              undefined,
              providerName,
              refreshId
            );
          }
        }
        
        const duration = this.logger.endTiming(`refresh_${refreshId}`, providerName, refreshId);
        this.monitor.recordTokenRefresh(providerName, false, duration, new Error(oauthError.message));
        
        return {
          success: false,
          error: oauthError.userMessage,
          requiresReauth: oauthError.requiresReauth
        };
      }

      // Create new token object with refreshed values and updated expiration
      const refreshedTokens: OAuthTokens = {
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token || storedTokens.refreshToken,
        expiresAt: new Date(Date.now() + (tokenResponse.expires_in * 1000)),
        scope: tokenResponse.scope || storedTokens.scope,
        tokenType: tokenResponse.token_type || storedTokens.tokenType
      };

      this.logger.info(
        OAuthOperation.TOKEN_REFRESHED,
        'Token refresh successful',
        { 
          hasNewRefreshToken: !!tokenResponse.refresh_token,
          newExpiresAt: refreshedTokens.expiresAt.toISOString(),
          expiresIn: tokenResponse.expires_in
        },
        providerName,
        refreshId
      );

      // Store the refreshed tokens with error handling
      try {
        await this.tokenStorage.storeTokens(providerName, refreshedTokens);
        
        this.logger.info(
          OAuthOperation.TOKEN_STORED,
          'Refreshed tokens stored successfully',
          { expiresAt: refreshedTokens.expiresAt.toISOString() },
          providerName,
          refreshId
        );
      } catch (storageError) {
        const error = OAuthErrorHandler.createError(
          OAuthErrorType.TOKEN_STORAGE_ERROR,
          storageError instanceof Error ? storageError.message : 'Token storage failed',
          storageError instanceof Error ? storageError : undefined
        );
        
        this.logger.error(
          OAuthOperation.TOKEN_REFRESH_FAILED,
          'Failed to store refreshed tokens',
          storageError instanceof Error ? storageError : new Error('Token storage failed'),
          undefined,
          providerName,
          refreshId
        );
        
        const duration = this.logger.endTiming(`refresh_${refreshId}`, providerName, refreshId);
        this.monitor.recordTokenRefresh(providerName, false, duration, storageError instanceof Error ? storageError : new Error('Token storage failed'));
        
        return {
          success: false,
          error: error.userMessage,
          requiresReauth: false
        };
      }
      
      const duration = this.logger.endTiming(`refresh_${refreshId}`, providerName, refreshId);
      this.monitor.recordTokenRefresh(providerName, true, duration);
      
      return { success: true };
      
    } catch (error) {
      // Handle different error types appropriately
      if (error && typeof error === 'object' && 'type' in error) {
        const oauthError = error as OAuthError;
        
        // Clean up tokens if re-authentication is required
        if (oauthError.requiresReauth) {
          try {
            await this.tokenStorage.removeTokens(providerName);
          } catch (cleanupError) {
            console.error(`Error cleaning up tokens for ${providerName}:`, cleanupError);
          }
        }
        
        return {
          success: false,
          error: oauthError.userMessage,
          requiresReauth: oauthError.requiresReauth
        };
      }
      
      // Handle network errors
      if (error instanceof Error) {
        const networkError = OAuthErrorHandler.parseNetworkError(error);
        console.error(`Failed to refresh tokens for ${providerName}:`, error);
        
        return {
          success: false,
          error: networkError.userMessage,
          requiresReauth: networkError.requiresReauth
        };
      }
      
      // Fallback for unknown errors
      const unknownError = OAuthErrorHandler.createError(
        OAuthErrorType.SERVER_ERROR,
        'Unknown error during token refresh'
      );
      
      return {
        success: false,
        error: unknownError.userMessage,
        requiresReauth: false
      };
    }
  }

  /**
   * Initiate OAuth flow by starting callback server and creating auth state
   */
  private async initiateFlow(provider: OAuthProvider): Promise<AuthenticationState> {
    // Start the callback server
    const redirectUri = await this.callbackServer.start();
    
    // Create authentication state with security parameters
    const authState = this.stateManager.createAuthState(provider.name, redirectUri);
    
    return authState;
  }

  /**
   * Handle OAuth callback and exchange authorization code for tokens
   * Requirements: 3.3, 3.4, 7.2, 7.4
   */
  private async handleCallback(
    code: string, 
    state: string, 
    provider: OAuthProvider
  ): Promise<OAuthTokens> {
    // Validate state parameter to prevent CSRF attacks
    this.logger.debug(
      OAuthOperation.STATE_VALIDATED,
      'Validating OAuth state parameter',
      { stateLength: state.length, codeLength: code.length },
      provider.name
    );
    
    const authState = this.stateManager.validateState(state);
    if (!authState) {
      this.logger.security(
        OAuthOperation.CSRF_DETECTED,
        'Invalid or expired state parameter - possible CSRF attack',
        { 
          receivedState: state.substring(0, 8) + '...', // Only log first 8 chars for security
          stateLength: state.length
        },
        provider.name
      );
      
      this.monitor.recordSecurityEvent('csrf', provider.name, { 
        stateLength: state.length,
        codeLength: code.length
      });
      
      const error = OAuthErrorHandler.createError(
        OAuthErrorType.CSRF_ATTACK,
        'Invalid or expired state parameter - possible CSRF attack'
      );
      throw error;
    }

    // Verify the state matches our current authentication
    if (!this.currentAuthState || authState.state !== this.currentAuthState.state) {
      this.logger.security(
        OAuthOperation.CSRF_DETECTED,
        'State parameter mismatch between callback and current auth state',
        { 
          hasCurrentAuthState: !!this.currentAuthState,
          statesMatch: this.currentAuthState?.state === authState.state
        },
        provider.name
      );
      
      this.monitor.recordSecurityEvent('csrf', provider.name, { 
        reason: 'state_mismatch'
      });
      
      const error = OAuthErrorHandler.createError(
        OAuthErrorType.STATE_MISMATCH,
        'State parameter mismatch'
      );
      throw error;
    }

    this.logger.info(
      OAuthOperation.STATE_VALIDATED,
      'OAuth state validation successful',
      { 
        provider: provider.name,
        authStateAge: Date.now() - authState.startTime.getTime()
      },
      provider.name
    );

    // Exchange authorization code for tokens with timeout
    const tokenResponse = await OAuthErrorHandler.withTimeout(
      () => provider.exchangeCodeForTokens(code, authState.redirectUri, authState.codeVerifier),
      30000 // 30 second timeout for token exchange
    );

    if (tokenResponse.error) {
      const oauthError = OAuthErrorHandler.parseOAuthError(
        tokenResponse.error,
        tokenResponse.error_description
      );
      throw oauthError;
    }

    // Validate token response
    if (!tokenResponse.access_token) {
      const error = OAuthErrorHandler.createError(
        OAuthErrorType.INVALID_REQUEST,
        'Token response missing access token'
      );
      throw error;
    }

    // Create tokens object
    const tokens: OAuthTokens = {
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      expiresAt: new Date(Date.now() + (tokenResponse.expires_in * 1000)),
      scope: tokenResponse.scope || provider.scope.join(' '),
      tokenType: tokenResponse.token_type || 'Bearer'
    };

    return tokens;
  }

  /**
   * Cleanup resources after authentication flow with comprehensive error handling
   * Requirements: 3.5, 7.5
   */
  private async cleanup(): Promise<void> {
    this.logger.debug(
      OAuthOperation.CLEANUP_STARTED,
      'Starting OAuth cleanup process'
    );
    
    const cleanupErrors: Error[] = [];
    
    // Stop callback server
    try {
      await this.callbackServer.stop();
      
      this.logger.info(
        OAuthOperation.CALLBACK_SERVER_STOPPED,
        'Callback server stopped successfully'
      );
    } catch (error) {
      const cleanupError = new Error(`Failed to stop callback server: ${error instanceof Error ? error.message : 'Unknown error'}`);
      cleanupErrors.push(cleanupError);
      
      this.logger.error(
        OAuthOperation.CLEANUP_COMPLETED,
        'Error stopping callback server during cleanup',
        error instanceof Error ? error : new Error('Unknown error')
      );
      
      this.monitor.recordCallbackServerIssue('Failed to stop server during cleanup', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
    
    // Clear authentication state
    try {
      this.currentAuthState = null;
      this.stateManager.cleanupExpiredStates();
      
      this.logger.debug(
        OAuthOperation.CLEANUP_COMPLETED,
        'Authentication state cleared successfully'
      );
    } catch (error) {
      const cleanupError = new Error(`Failed to cleanup auth state: ${error instanceof Error ? error.message : 'Unknown error'}`);
      cleanupErrors.push(cleanupError);
      
      this.logger.error(
        OAuthOperation.CLEANUP_COMPLETED,
        'Error cleaning up authentication state',
        error instanceof Error ? error : new Error('Unknown error')
      );
    }
    
    // Log cleanup completion
    if (cleanupErrors.length > 0) {
      this.logger.warn(
        OAuthOperation.CLEANUP_COMPLETED,
        `OAuth cleanup completed with ${cleanupErrors.length} errors`,
        { errorCount: cleanupErrors.length, errors: cleanupErrors.map(e => e.message) }
      );
      
      // Record resource leak if cleanup failed
      this.monitor.recordResourceLeak(
        'OAuth cleanup',
        `${cleanupErrors.length} cleanup operations failed`,
        { errors: cleanupErrors.map(e => e.message) }
      );
    } else {
      this.logger.info(
        OAuthOperation.CLEANUP_COMPLETED,
        'OAuth cleanup completed successfully'
      );
    }
  }
}