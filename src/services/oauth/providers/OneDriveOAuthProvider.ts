/**
 * OneDrive OAuth provider implementation
 * Implements OAuth 2.0 flow with PKCE for OneDrive integration
 * 
 * Requirements:
 * - 2.2: OAuth 2.0 with PKCE for Tauri authentication via system browser
 * - 2.3: Store access token and refresh token using CloudCredentialManager
 * - 2.6: Request Files.ReadWrite.AppFolder scope
 * - 2.7: Automatic token refresh using refresh token
 * - 2.9: Handle refresh token failure
 */

import type { OAuthProvider, OAuthTokens, TokenResponse, OAuthProviderConfig } from '../interfaces';
import { isTauriEnvironment } from '../../../utils/environment';
import { createLogger } from '../../../utils/logger';

const logger = createLogger('OneDriveOAuthProvider');

export class OneDriveOAuthProvider implements OAuthProvider {
  readonly name = 'onedrive';
  readonly displayName = 'OneDrive';
  readonly authorizationUrl: string;
  readonly tokenUrl: string;
  readonly scope: string[];
  readonly clientId: string;
  private readonly clientSecret?: string;

  constructor(config?: OAuthProviderConfig | string, clientSecret?: string) {
    const hasArguments = arguments.length > 0;

    if (typeof config === 'string') {
      // Legacy constructor: clientId as string
      this.clientId = config;
      this.clientSecret = clientSecret;
      this.authorizationUrl = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize';
      this.tokenUrl = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token';
      this.scope = ['Files.ReadWrite.AppFolder', 'offline_access'];
    } else if (config && typeof config === 'object') {
      // Configuration object constructor
      this.clientId = config.clientId;
      this.clientSecret = config.clientSecret || clientSecret;
      this.authorizationUrl = config.authorizationUrl || 'https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize';
      this.tokenUrl = config.tokenUrl || 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token';
      this.scope = config.scope || ['Files.ReadWrite.AppFolder', 'offline_access'];
    } else if (!hasArguments) {
      // No arguments: load from ONEDRIVE_CONFIG
      try {
        const { ONEDRIVE_CONFIG } = require('../../../cloud/config/onedrive-credentials');
        this.clientId = ONEDRIVE_CONFIG.CLIENT_ID;
        this.clientSecret = ONEDRIVE_CONFIG.CLIENT_SECRET;
        this.authorizationUrl = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize';
        this.tokenUrl = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token';
        this.scope = ONEDRIVE_CONFIG.SCOPES;
      } catch (error) {
        this.clientId = '';
        this.clientSecret = undefined;
        this.authorizationUrl = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize';
        this.tokenUrl = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token';
        this.scope = ['Files.ReadWrite.AppFolder', 'offline_access'];
      }
    } else {
      // Invalid config provided
      this.clientId = '';
      this.clientSecret = undefined;
      this.authorizationUrl = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize';
      this.tokenUrl = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token';
      this.scope = ['Files.ReadWrite.AppFolder', 'offline_access'];
    }

    if (!this.clientId) {
      throw new Error('OneDrive OAuth client ID is required');
    }
  }

  /**
   * Build OAuth authorization URL with PKCE parameters
   * Requirements: 2.2, 2.6
   */
  buildAuthUrl(redirectUri: string, state: string, codeChallenge: string): string {
    logger.log('buildAuthUrl called with redirectUri:', redirectUri);
    const params: Record<string, string> = {
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      scope: this.scope.join(' ')
    };

    const authUrl = `${this.authorizationUrl}?${this.buildQueryParams(params)}`;
    logger.log('Full auth URL:', authUrl);
    return authUrl;
  }

  /**
   * Exchange authorization code for tokens
   * Requirements: 2.2, 2.3
   */
  async exchangeCodeForTokens(code: string, redirectUri: string, codeVerifier: string): Promise<TokenResponse> {
    const body: Record<string, string> = {
      code: code,
      grant_type: 'authorization_code',
      code_verifier: codeVerifier,
      redirect_uri: redirectUri
    };

    if (this.clientId) {
      body.client_id = this.clientId;
    }

    // Do NOT send client_secret for public clients (desktop/native apps using PKCE).
    // Microsoft returns AADSTS70002 if client_secret is sent for a public client app.
    // Only include it for confidential clients (web apps with a backend).
    if (this.clientSecret && !isTauriEnvironment()) {
      body.client_secret = this.clientSecret;
    }

    // Microsoft requires scope in token exchange
    if (this.scope.length > 0) {
      body.scope = this.scope.join(' ');
    }

    return this.makeTokenRequest(body);
  }

  /**
   * Refresh access tokens using refresh token
   * Requirements: 2.7, 2.9
   */
  async refreshTokens(refreshToken: string): Promise<TokenResponse> {
    const body: Record<string, string> = {
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    };

    if (this.clientId) {
      body.client_id = this.clientId;
    }

    // Do NOT send client_secret for public clients (desktop/native apps using PKCE).
    if (this.clientSecret && !isTauriEnvironment()) {
      body.client_secret = this.clientSecret;
    }

    // Microsoft requires scope in refresh requests
    if (this.scope.length > 0) {
      body.scope = this.scope.join(' ');
    }

    return this.makeTokenRequest(body);
  }

  /**
   * Validate tokens by checking expiration and making a test API call.
   * Uses /me/drive/special/approot which is accessible with Files.ReadWrite.AppFolder scope.
   * In Tauri, skips the live API call and trusts the expiry time — the token was just
   * exchanged natively so there's no reason to distrust it immediately.
   * Requirements: 2.7
   */
  async validateTokens(tokens: OAuthTokens): Promise<boolean> {
    try {
      // Check if token is expired (with 5 minute buffer)
      const bufferTime = 5 * 60 * 1000;
      if (tokens.expiresAt <= new Date(Date.now() + bufferTime)) {
        return false;
      }

      // In Tauri, trust the expiry — the token came from a native exchange and
      // a live API call here would hit CORS or scope issues unnecessarily.
      if (isTauriEnvironment()) {
        return true;
      }

      // In web, verify with the approot endpoint (requires Files.ReadWrite.AppFolder scope)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
        const response = await fetch('https://graph.microsoft.com/v1.0/me/drive/special/approot', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${tokens.accessToken}`
          },
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          logger.warn(`Token validation failed with HTTP ${response.status}`);
          return false;
        }

        return true;
      } catch (fetchError) {
        clearTimeout(timeoutId);

        if (fetchError instanceof Error) {
          if (fetchError.name === 'AbortError') {
            logger.warn('Token validation timed out');
          } else {
            logger.warn('Token validation network error:', fetchError.message);
          }
        }

        return false;
      }
    } catch (error) {
      logger.error('Token validation failed with unexpected error:', error);
      return false;
    }
  }

  /**
   * Build query parameters string from key-value pairs
   */
  private buildQueryParams(params: Record<string, string>): string {
    return Object.entries(params)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');
  }

  /**
   * Make token request to Microsoft OAuth endpoint with comprehensive error handling.
   * In Tauri, routes through the Rust backend to avoid AADSTS90023 cross-origin error.
   */
  private async makeTokenRequest(body: Record<string, string>): Promise<TokenResponse> {
    // In Tauri, use the native Rust HTTP command to avoid the browser cross-origin
    // restriction that causes AADSTS90023.
    if (isTauriEnvironment()) {
      return this.makeTokenRequestViaTauri(body);
    }
    return this.makeTokenRequestViaBrowser(body);
  }

  /**
   * Token exchange via Tauri Rust backend (native HTTP, no CORS restrictions).
   * Handles both authorization_code and refresh_token grant types.
   */
  private async makeTokenRequestViaTauri(body: Record<string, string>): Promise<TokenResponse> {
    try {
      const { invoke } = await import('@tauri-apps/api/core');

      // Build the request — always include client_id and token_url.
      // Pass all body params so both grant types work correctly.
      const request = {
        code: body.code || '',
        redirect_uri: body.redirect_uri || '',
        code_verifier: body.code_verifier || '',
        client_id: body.client_id || this.clientId,
        token_url: this.tokenUrl,
        scope: body.scope || this.scope.join(' '),
        // Refresh token grant fields
        grant_type: body.grant_type || 'authorization_code',
        refresh_token: body.refresh_token || '',
      };

      const data = await invoke<{
        access_token?: string;
        refresh_token?: string;
        expires_in?: number;
        token_type?: string;
        scope?: string;
        error?: string;
        error_description?: string;
      }>('oauth_exchange_code', { request });

      if (data.error) {
        return {
          access_token: '',
          token_type: '',
          expires_in: 0,
          error: data.error,
          error_description: data.error_description || `Token request failed: ${data.error}`
        };
      }

      if (!data.access_token) {
        return {
          access_token: '',
          token_type: '',
          expires_in: 0,
          error: 'invalid_response',
          error_description: 'Token response missing required access_token field'
        };
      }

      return {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in || 3600,
        token_type: data.token_type || 'Bearer',
        scope: data.scope
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        access_token: '',
        token_type: '',
        expires_in: 0,
        error: 'network_error',
        error_description: `Tauri token request failed: ${errorMessage}`
      };
    }
  }

  /**
   * Token exchange via browser fetch (web environment)
   */
  private async makeTokenRequestViaBrowser(body: Record<string, string>): Promise<TokenResponse> {
    try {
      const response = await fetch(this.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: this.buildQueryParams(body)
      });

      // Parse response body
      let data: any;
      try {
        data = await response.json();
      } catch (parseError) {
        return {
          access_token: '',
          token_type: '',
          expires_in: 0,
          error: 'invalid_response',
          error_description: `Invalid JSON response from server: ${response.statusText}`
        };
      }

      if (!response.ok) {
        return {
          access_token: '',
          token_type: '',
          expires_in: 0,
          error: data.error || 'token_request_failed',
          error_description: data.error_description || `HTTP ${response.status}: ${response.statusText}`
        };
      }

      // Validate required fields
      if (!data.access_token) {
        return {
          access_token: '',
          token_type: '',
          expires_in: 0,
          error: 'invalid_response',
          error_description: 'Token response missing required access_token field'
        };
      }

      return {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in || 3600, // Microsoft default is 1 hour
        token_type: data.token_type || 'Bearer',
        scope: data.scope
      };
    } catch (error) {
      // Classify network errors
      const errorMessage = error instanceof Error ? error.message : 'Unknown network error';
      const lowerMessage = errorMessage.toLowerCase();

      let errorType = 'network_error';
      let errorDescription = errorMessage;

      if (lowerMessage.includes('timeout') || lowerMessage.includes('etimedout')) {
        errorType = 'timeout';
        errorDescription = 'Request timed out. Please check your internet connection and try again.';
      } else if (lowerMessage.includes('enotfound') || lowerMessage.includes('dns')) {
        errorType = 'dns_error';
        errorDescription = 'Unable to connect to authentication server. Please check your internet connection.';
      } else if (lowerMessage.includes('econnrefused')) {
        errorType = 'connection_refused';
        errorDescription = 'Connection refused by authentication server. Please try again later.';
      }

      return {
        access_token: '',
        token_type: '',
        expires_in: 0,
        error: errorType,
        error_description: errorDescription
      };
    }
  }
}
