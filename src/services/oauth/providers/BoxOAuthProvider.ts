/**
 * Box OAuth provider implementation
 * Implements OAuth 2.0 flow with PKCE for Box integration
 * 
 * Used by OAuthBoxProvider (Tauri) for native OAuth authentication
 */

import type { OAuthProvider, OAuthTokens, TokenResponse, OAuthProviderConfig } from '../interfaces';

export class BoxOAuthProvider implements OAuthProvider {
  readonly name = 'box';
  readonly displayName = 'Box';
  readonly authorizationUrl: string;
  readonly tokenUrl: string;
  readonly scope: string[];
  readonly clientId: string;
  private readonly clientSecret?: string;

  constructor(config?: OAuthProviderConfig | string, clientSecret?: string) {
    const hasArguments = arguments.length > 0;

    if (typeof config === 'string') {
      this.clientId = config;
      this.clientSecret = clientSecret;
      this.authorizationUrl = 'https://account.box.com/api/oauth2/authorize';
      this.tokenUrl = 'https://api.box.com/oauth2/token';
      this.scope = ['root_readwrite'];
    } else if (config && typeof config === 'object') {
      this.clientId = config.clientId;
      this.clientSecret = config.clientSecret || clientSecret;
      this.authorizationUrl = config.authorizationUrl || 'https://account.box.com/api/oauth2/authorize';
      this.tokenUrl = config.tokenUrl || 'https://api.box.com/oauth2/token';
      this.scope = config.scope || ['root_readwrite'];
    } else if (!hasArguments) {
      try {
        const { BOX_CONFIG } = require('../../../cloud/config/box-credentials');
        this.clientId = BOX_CONFIG.CLIENT_ID;
        this.clientSecret = BOX_CONFIG.CLIENT_SECRET;
        this.authorizationUrl = 'https://account.box.com/api/oauth2/authorize';
        this.tokenUrl = 'https://api.box.com/oauth2/token';
        this.scope = BOX_CONFIG.SCOPES;
      } catch (error) {
        this.clientId = '';
        this.clientSecret = undefined;
        this.authorizationUrl = 'https://account.box.com/api/oauth2/authorize';
        this.tokenUrl = 'https://api.box.com/oauth2/token';
        this.scope = ['root_readwrite'];
      }
    } else {
      this.clientId = '';
      this.clientSecret = undefined;
      this.authorizationUrl = 'https://account.box.com/api/oauth2/authorize';
      this.tokenUrl = 'https://api.box.com/oauth2/token';
      this.scope = ['root_readwrite'];
    }

    if (!this.clientId) {
      throw new Error('Box OAuth client ID is required');
    }
  }

  /**
   * Build OAuth authorization URL with PKCE parameters
   */
  buildAuthUrl(redirectUri: string, state: string, codeChallenge: string): string {
    const params: Record<string, string> = {
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
    };

    if (this.scope.length > 0) {
      params.scope = this.scope.join(' ');
    }

    const authUrl = `${this.authorizationUrl}?${this.buildQueryParams(params)}`;
    return authUrl;
  }

  /**
   * Exchange authorization code for tokens
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

    if (this.clientSecret) {
      body.client_secret = this.clientSecret;
    }

    return this.makeTokenRequest(body);
  }

  /**
   * Refresh access tokens using refresh token
   */
  async refreshTokens(refreshToken: string): Promise<TokenResponse> {
    const body: Record<string, string> = {
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    };

    if (this.clientId) {
      body.client_id = this.clientId;
    }

    if (this.clientSecret) {
      body.client_secret = this.clientSecret;
    }

    return this.makeTokenRequest(body);
  }

  /**
   * Validate tokens by checking expiration
   */
  async validateTokens(tokens: OAuthTokens): Promise<boolean> {
    try {
      const bufferTime = 5 * 60 * 1000; // 5 minutes
      if (tokens.expiresAt <= new Date(Date.now() + bufferTime)) {
        return false;
      }

      // Make a test API call to verify token validity
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
        const response = await fetch('https://api.box.com/2.0/users/me', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${tokens.accessToken}`
          },
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          console.warn(`[BoxOAuthProvider] Token validation failed with HTTP ${response.status}`);
          return false;
        }

        return true;
      } catch (fetchError) {
        clearTimeout(timeoutId);

        if (fetchError instanceof Error) {
          if (fetchError.name === 'AbortError') {
            console.warn('[BoxOAuthProvider] Token validation timed out');
          } else {
            console.warn('[BoxOAuthProvider] Token validation network error:', fetchError.message);
          }
        }

        return false;
      }
    } catch (error) {
      console.error('[BoxOAuthProvider] Token validation failed with unexpected error:', error);
      return false;
    }
  }

  private buildQueryParams(params: Record<string, string>): string {
    return Object.entries(params)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');
  }

  private async makeTokenRequest(body: Record<string, string>): Promise<TokenResponse> {
    try {
      const response = await fetch(this.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: this.buildQueryParams(body)
      });

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
        expires_in: data.expires_in || 3600, // Box default is 1 hour
        token_type: data.token_type || 'Bearer',
        scope: data.scope
      };
    } catch (error) {
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
