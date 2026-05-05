/**
 * Google OAuth provider implementation
 * Implements OAuth 2.0 flow for Google Drive integration
 */

import type { OAuthProvider, OAuthTokens, TokenResponse, OAuthProviderConfig } from '../interfaces';

export class GoogleOAuthProvider implements OAuthProvider {
  readonly name = 'google';
  readonly displayName = 'Google Drive';
  readonly authorizationUrl: string;
  readonly tokenUrl: string;
  readonly scope: string[];
  readonly clientId: string;
  private readonly clientSecret?: string;
  private readonly additionalParams: Record<string, string>;

  constructor(config: OAuthProviderConfig | string, clientSecret?: string) {
    // Support both new config object and legacy string clientId
    if (typeof config === 'string') {
      // Legacy constructor for backward compatibility
      this.clientId = config;
      this.clientSecret = clientSecret;
      this.authorizationUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
      this.tokenUrl = 'https://oauth2.googleapis.com/token';
      this.scope = ['https://www.googleapis.com/auth/drive.file'];
      this.additionalParams = {
        access_type: 'offline',
        prompt: 'consent'
      };
    } else if (config && typeof config === 'object') {
      // New configuration-based constructor
      this.clientId = config.clientId;
      this.clientSecret = config.clientSecret || clientSecret;
      this.authorizationUrl = config.authorizationUrl || 'https://accounts.google.com/o/oauth2/v2/auth';
      this.tokenUrl = config.tokenUrl || 'https://oauth2.googleapis.com/token';
      this.scope = config.scope || ['https://www.googleapis.com/auth/drive.file'];
      this.additionalParams = config.additionalParams || {
        access_type: 'offline',
        prompt: 'consent'
      };
    } else {
      // Invalid config
      this.clientId = '';
      this.clientSecret = undefined;
      this.authorizationUrl = '';
      this.tokenUrl = '';
      this.scope = [];
      this.additionalParams = {};
    }

    if (!this.clientId) {
      throw new Error('Google OAuth client ID is required');
    }
  }

  /**
   * Build OAuth authorization URL with PKCE parameters
   */
  buildAuthUrl(redirectUri: string, state: string, codeChallenge: string): string {
    const params = {
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: this.scope.join(' '),
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      ...this.additionalParams
    };

    return `${this.authorizationUrl}?${this.buildQueryParams(params)}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string, redirectUri: string, codeVerifier: string): Promise<TokenResponse> {
    const body: Record<string, string> = {
      client_id: this.clientId,
      code: code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code_verifier: codeVerifier
    };

    // Google requires client_secret even for Desktop apps with PKCE
    // This is a known deviation from RFC 7636
    if (this.clientSecret) {
      body.client_secret = this.clientSecret;
    }

    return this.makeTokenRequest(body);
  }

  /**
   * Refresh access tokens
   */
  async refreshTokens(refreshToken: string): Promise<TokenResponse> {
    const body: Record<string, string> = {
      client_id: this.clientId,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    };

    // Google requires client_secret for token refresh as well
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
        const response = await fetch('https://www.googleapis.com/oauth2/v1/tokeninfo', {
          method: 'GET',
          headers: {
            'Authorization': `${tokens.tokenType} ${tokens.accessToken}`
          },
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          // Log specific HTTP errors for debugging
          console.warn(`Token validation failed with HTTP ${response.status}: ${response.statusText}`);
          return false;
        }

        let tokenInfo: any;
        try {
          tokenInfo = await response.json();
        } catch (parseError) {
          console.error('Failed to parse token validation response:', parseError);
          return false;
        }

        // Verify the token belongs to our client
        const isValid = tokenInfo.audience === this.clientId;
        if (!isValid) {
          console.warn('Token validation failed: audience mismatch');
        }

        return isValid;
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
        expires_in: data.expires_in || 3600,
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
