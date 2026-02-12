/**
 * Dropbox OAuth provider implementation
 * Implements OAuth 2.0 flow with PKCE for Dropbox integration
 * 
 * Requirements:
 * - 2.5: OAuth 2.0 with PKCE for authentication
 * - 3.1: OAuth 2.0 authorization code flow with PKCE
 * - 3.2: Request files.content.write and files.content.read scopes
 * - 3.4: Automatic token refresh using refresh token
 */

import type { OAuthProvider, OAuthTokens, TokenResponse, OAuthProviderConfig } from '../interfaces';

export class DropboxOAuthProvider implements OAuthProvider {
  readonly name = 'dropbox';
  readonly displayName = 'Dropbox';
  readonly authorizationUrl: string;
  readonly tokenUrl: string;
  readonly scope: string[];
  readonly clientId: string;
  private readonly clientSecret?: string;

  constructor(config?: OAuthProviderConfig | string, clientSecret?: string) {
    // Check if any arguments were provided
    const hasArguments = arguments.length > 0;

    // Support both new config object and legacy string clientId
    if (typeof config === 'string') {
      // Legacy constructor for backward compatibility
      this.clientId = config;
      this.clientSecret = clientSecret;
      this.authorizationUrl = 'https://www.dropbox.com/oauth2/authorize';
      this.tokenUrl = 'https://api.dropboxapi.com/oauth2/token';
      this.scope = ['files.content.write', 'files.content.read'];
    } else if (config && typeof config === 'object') {
      // New configuration-based constructor
      this.clientId = config.clientId;
      this.clientSecret = config.clientSecret || clientSecret;
      this.authorizationUrl = config.authorizationUrl || 'https://www.dropbox.com/oauth2/authorize';
      this.tokenUrl = config.tokenUrl || 'https://api.dropboxapi.com/oauth2/token';
      this.scope = config.scope || ['files.content.write', 'files.content.read'];
    } else if (!hasArguments) {
      // No arguments provided - use default configuration from DROPBOX_CONFIG
      // (lazy load to avoid import.meta issues in tests)
      try {
        const { DROPBOX_CONFIG } = require('../../../cloud/config/dropbox-credentials');
        this.clientId = DROPBOX_CONFIG.CLIENT_ID;
        this.clientSecret = DROPBOX_CONFIG.CLIENT_SECRET;
        this.authorizationUrl = 'https://www.dropbox.com/oauth2/authorize';
        this.tokenUrl = 'https://api.dropboxapi.com/oauth2/token';
        this.scope = DROPBOX_CONFIG.SCOPES;
      } catch (error) {
        // If we can't load the config (e.g., in tests), set empty values
        // The validation below will catch this
        this.clientId = '';
        this.clientSecret = undefined;
        this.authorizationUrl = 'https://www.dropbox.com/oauth2/authorize';
        this.tokenUrl = 'https://api.dropboxapi.com/oauth2/token';
        this.scope = ['files.content.write', 'files.content.read'];
      }
    } else {
      // Invalid config provided (null, undefined, or other invalid type)
      // Set empty values to trigger validation error
      this.clientId = '';
      this.clientSecret = undefined;
      this.authorizationUrl = 'https://www.dropbox.com/oauth2/authorize';
      this.tokenUrl = 'https://api.dropboxapi.com/oauth2/token';
      this.scope = ['files.content.write', 'files.content.read'];
    }

    if (!this.clientId) {
      throw new Error('Dropbox OAuth client ID is required');
    }
  }

  /**
   * Build OAuth authorization URL with PKCE parameters
   * Requirements: 2.5, 3.1
   */
  buildAuthUrl(redirectUri: string, state: string, codeChallenge: string): string {
    // console.log('[DropboxOAuthProvider] Building auth URL with redirectUri:', redirectUri);

    const params = {
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      token_access_type: 'offline' // Request refresh token
    };

    const authUrl = `${this.authorizationUrl}?${this.buildQueryParams(params)}`;
    // console.log('[DropboxOAuthProvider] Full auth URL:', authUrl);

    return authUrl;
  }

  /**
   * Exchange authorization code for tokens
   * Requirements: 3.1, 3.3
   */
  async exchangeCodeForTokens(code: string, redirectUri: string, codeVerifier: string): Promise<TokenResponse> {
    const body: Record<string, string> = {
      code: code,
      grant_type: 'authorization_code',
      code_verifier: codeVerifier,
      redirect_uri: redirectUri
    };

    // Dropbox requires client_id and client_secret for token exchange
    if (this.clientId) {
      body.client_id = this.clientId;
    }

    if (this.clientSecret) {
      body.client_secret = this.clientSecret;
    }

    return this.makeTokenRequest(body);
  }

  /**
   * Refresh access tokens
   * Requirements: 3.4
   */
  async refreshTokens(refreshToken: string): Promise<TokenResponse> {
    const body: Record<string, string> = {
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    };

    // Dropbox requires client_id and client_secret for token refresh
    if (this.clientId) {
      body.client_id = this.clientId;
    }

    if (this.clientSecret) {
      body.client_secret = this.clientSecret;
    }

    return this.makeTokenRequest(body);
  }

  /**
   * Validate tokens by checking expiration and making a test API call
   * Requirements: 3.1, 3.2
   */
  async validateTokens(tokens: OAuthTokens): Promise<boolean> {
    try {
      // Check if token is expired (with 5 minute buffer)
      const bufferTime = 5 * 60 * 1000; // 5 minutes in milliseconds
      if (tokens.expiresAt <= new Date(Date.now() + bufferTime)) {
        return false;
      }

      // Make a test API call to verify token validity with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      try {
        const response = await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
          method: 'POST',
          headers: {
            'Authorization': `${tokens.tokenType} ${tokens.accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(null),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          // Log specific HTTP errors for debugging
          console.warn(`Token validation failed with HTTP ${response.status}: ${response.statusText}`);
          return false;
        }

        // If we get a successful response, the token is valid
        return true;
      } catch (fetchError) {
        clearTimeout(timeoutId);

        // Handle specific fetch errors
        if (fetchError instanceof Error) {
          if (fetchError.name === 'AbortError') {
            console.warn('Token validation timed out');
          } else {
            console.warn('Token validation network error:', fetchError.message);
          }
        }

        return false;
      }
    } catch (error) {
      console.error('Token validation failed with unexpected error:', error);
      return false;
    }
  }

  /**
   * Build query parameters string
   */
  private buildQueryParams(params: Record<string, string>): string {
    return Object.entries(params)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');
  }

  /**
   * Make token request to OAuth endpoint with comprehensive error handling
   * Requirements: 3.1, 3.2, 3.4
   */
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

      // Parse response body
      let data: any;
      try {
        data = await response.json();
      } catch (parseError) {
        // Handle non-JSON responses
        return {
          access_token: '',
          token_type: '',
          expires_in: 0,
          error: 'invalid_response',
          error_description: `Invalid JSON response from server: ${response.statusText}`
        };
      }

      if (!response.ok) {
        // Parse OAuth error response
        return {
          access_token: '',
          token_type: '',
          expires_in: 0,
          error: data.error || 'token_request_failed',
          error_description: data.error_description || `HTTP ${response.status}: ${response.statusText}`
        };
      }

      // Validate required fields in successful response
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
        expires_in: data.expires_in || 14400, // Dropbox default is 4 hours
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
