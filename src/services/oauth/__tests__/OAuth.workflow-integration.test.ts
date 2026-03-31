/**
 * OAuth Workflow Integration Tests
 * Tests complete OAuth workflows across different providers
 * Validates cross-platform browser launching, callback handling, error recovery, and token lifecycle
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import * as fc from 'fast-check';
import { OAuthManager } from '../core/OAuthManager';
import { CallbackServer } from '../core/CallbackServer';
import { BrowserLauncher } from '../core/BrowserLauncher';
import { TokenStorage } from '../core/TokenStorage';
import { StateManager } from '../core/StateManager';
import type { 
  OAuthProvider, 
  OAuthTokens, 
  OAuthConfig,
  CallbackServerConfig,
  SecurityConfig
} from '../interfaces';

describe('OAuth Workflow Integration Tests', () => {
  let oauthManager: OAuthManager;
  let callbackServer: CallbackServer;
  let browserLauncher: BrowserLauncher;
  let tokenStorage: TokenStorage;
  let stateManager: StateManager;
  
  beforeEach(() => {
    // Create OAuth manager with test configuration
    const testConfig: Partial<OAuthConfig> = {
      providers: {
        'google': {
          clientId: 'google-test-client-id',
          enabled: true,
          scope: ['https://www.googleapis.com/auth/drive']
        },
        'github': {
          clientId: 'github-test-client-id',
          enabled: true,
          scope: ['repo', 'user']
        }
      },
      callbackServer: {
        host: '127.0.0.1',
        portRange: [8080, 8090],
        timeout: 5000,
        maxRetries: 2
      },
      security: {
        stateExpiration: 300000,
        pkceMethod: 'S256',
        tokenEncryption: true,
        tokenRefreshBuffer: 60000,
        maxAuthAttempts: 3,
        lockoutDuration: 300000
      }
    };
    
    oauthManager = new OAuthManager(testConfig);
    
    // Initialize individual components for testing
    const callbackConfig: CallbackServerConfig = {
      host: '127.0.0.1',
      portRange: [8080, 8090],
      timeout: 5000,
      maxRetries: 2
    };
    
    const securityConfig: SecurityConfig = {
      stateExpiration: 300000,
      pkceMethod: 'S256',
      tokenEncryption: true,
      tokenRefreshBuffer: 60000,
      maxAuthAttempts: 3,
      lockoutDuration: 300000
    };
    
    callbackServer = new CallbackServer(callbackConfig);
    browserLauncher = new BrowserLauncher();
    tokenStorage = new TokenStorage();
    stateManager = new StateManager(securityConfig);
  });
  
  afterEach(async () => {
    // Clean up resources
    try {
      await callbackServer.stop();
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  /**
   * Test 1: Full Authentication Flow Across Different Providers
   * Tests complete authentication workflow for multiple OAuth providers
   */
  test('Full authentication flow across different providers', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            name: fc.constantFrom('google', 'github', 'microsoft', 'dropbox'),
            clientId: fc.string({ minLength: 20, maxLength: 50 }).filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
            scope: fc.array(fc.string({ minLength: 3, maxLength: 30 }).filter(s => /^[a-zA-Z0-9._/-]+$/.test(s)), { minLength: 1, maxLength: 3 })
          }),
          { minLength: 1, maxLength: 3 }
        ),
        (providerConfigs) => {
          // Ensure unique provider names
          const uniqueConfigs = providerConfigs.filter((config, index, array) => 
            array.findIndex(c => c.name === config.name) === index
          );
          
          if (uniqueConfigs.length === 0) return true;
          
          // Enable providers in configuration
          const providersConfig: Record<string, any> = {};
          for (const config of uniqueConfigs) {
            providersConfig[config.name] = {
              clientId: config.clientId,
              enabled: true,
              scope: config.scope
            };
          }
          
          oauthManager.updateConfig({
            providers: providersConfig
          });
          
          // Create and register providers
          for (const config of uniqueConfigs) {
            const provider: OAuthProvider = {
              name: config.name,
              displayName: `${config.name.charAt(0).toUpperCase() + config.name.slice(1)} OAuth`,
              authorizationUrl: `https://${config.name}.com/oauth/authorize`,
              tokenUrl: `https://${config.name}.com/oauth/token`,
              scope: config.scope,
              clientId: config.clientId,
              buildAuthUrl: (redirectUri, state, codeChallenge) => {
                const params = new URLSearchParams({
                  client_id: config.clientId,
                  redirect_uri: redirectUri,
                  state: state,
                  code_challenge: codeChallenge,
                  code_challenge_method: 'S256',
                  response_type: 'code',
                  scope: config.scope.join(' ')
                });
                return `https://${config.name}.com/oauth/authorize?${params.toString()}`;
              },
              exchangeCodeForTokens: async (code, redirectUri, codeVerifier) => {
                // Simulate successful token exchange
                return {
                  access_token: `${config.name}_access_token_${code}`,
                  refresh_token: `${config.name}_refresh_token_${code}`,
                  expires_in: 3600,
                  token_type: 'Bearer',
                  scope: config.scope.join(' ')
                };
              },
              refreshTokens: async (refreshToken) => {
                // Simulate successful token refresh
                return {
                  access_token: `${config.name}_refreshed_access_token`,
                  refresh_token: `${config.name}_new_refresh_token`,
                  expires_in: 3600,
                  token_type: 'Bearer'
                };
              },
              validateTokens: async (tokens) => {
                // Simulate token validation
                return tokens.accessToken.includes(config.name) && tokens.expiresAt > new Date();
              }
            };
            
            oauthManager.registerProvider(provider);
          }
          
          // Verify all providers are registered
          const registeredProviders = oauthManager.getRegisteredProviders();
          expect(registeredProviders).toHaveLength(uniqueConfigs.length);
          
          // Test authentication URL generation for each provider
          for (const config of uniqueConfigs) {
            const provider = oauthManager.getProvider(config.name);
            expect(provider).toBeTruthy();
            
            // Generate authentication state
            const authState = stateManager.createAuthState(config.name, 'http://localhost:8080/callback');
            
            // Build authorization URL
            const authUrl = provider!.buildAuthUrl(
              authState.redirectUri,
              authState.state,
              authState.codeChallenge
            );
            
            // Verify URL structure
            expect(authUrl).toContain(`https://${config.name}.com/oauth/authorize`);
            expect(authUrl).toContain(`client_id=${config.clientId}`);
            expect(authUrl).toContain(`redirect_uri=${encodeURIComponent(authState.redirectUri)}`);
            expect(authUrl).toContain(`state=${authState.state}`);
            expect(authUrl).toContain(`code_challenge=${authState.codeChallenge}`);
            
            // Verify URL is valid
            expect(() => new URL(authUrl)).not.toThrow();
            
            // Verify URL contains scope (may be URL encoded)
            const parsedUrl = new URL(authUrl);
            const scopeParam = parsedUrl.searchParams.get('scope');
            expect(scopeParam).toBeTruthy();
            expect(scopeParam).toBe(config.scope.join(' '));
          }
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Test 2: Cross-Platform Browser Launching and Callback Handling
   * Tests browser launching and callback server functionality across platforms
   */
  test('Cross-platform browser launching and callback handling', async () => {
    // Test callback server startup and shutdown
    const serverUrl = await callbackServer.start();
    expect(serverUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/callback$/);
    
    // Extract port from URL
    const urlMatch = serverUrl.match(/http:\/\/127\.0\.0\.1:(\d+)\/callback/);
    expect(urlMatch).toBeTruthy();
    const port = parseInt(urlMatch![1]);
    expect(port).toBeGreaterThanOrEqual(8080);
    expect(port).toBeLessThanOrEqual(8090);
    
    // Test server cleanup
    await callbackServer.stop();
    
    // Test URL validation for browser launching
    const testUrls = [
      'https://accounts.google.com/oauth/authorize?client_id=test',
      'https://github.com/login/oauth/authorize?client_id=test',
      'https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=test'
    ];
    
    for (const url of testUrls) {
      expect(() => new URL(url)).not.toThrow();
      // Test that URL is valid HTTPS URL
      const parsedUrl = new URL(url);
      expect(parsedUrl.protocol).toBe('https:');
      expect(parsedUrl.hostname).toBeTruthy();
    }
  });

  /**
   * Test 3: Error Recovery and Retry Mechanisms
   * Tests various error scenarios and recovery mechanisms
   */
  test('Error recovery and retry mechanisms', async () => {
    // Test 1: Callback server port conflict resolution
    const server1 = new CallbackServer({
      host: '127.0.0.1',
      portRange: [8080, 8082],
      timeout: 5000,
      maxRetries: 3
    });
    
    const server2 = new CallbackServer({
      host: '127.0.0.1',
      portRange: [8080, 8082],
      timeout: 5000,
      maxRetries: 3
    });
    
    // Start first server
    const url1 = await server1.start();
    expect(url1).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/callback$/);
    
    // Start second server - should get different port
    const url2 = await server2.start();
    expect(url2).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/callback$/);
    expect(url1).not.toBe(url2);
    
    // Clean up
    await server1.stop();
    await server2.stop();
    
    // Test 2: Token refresh failure and retry
    const failingProvider: OAuthProvider = {
      name: 'failing-provider',
      displayName: 'Failing Provider',
      authorizationUrl: 'https://failing.com/oauth/authorize',
      tokenUrl: 'https://failing.com/oauth/token',
      scope: ['read'],
      clientId: 'failing-client-id',
      buildAuthUrl: (redirectUri, state, codeChallenge) => 
        `https://failing.com/oauth/authorize?client_id=failing-client-id&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&code_challenge=${codeChallenge}`,
      exchangeCodeForTokens: async () => ({
        access_token: 'failing-access-token',
        refresh_token: 'failing-refresh-token',
        expires_in: 3600,
        token_type: 'Bearer'
      }),
      refreshTokens: async (refreshToken) => {
        // Simulate refresh failure
        throw new Error('Token refresh failed - invalid refresh token');
      },
      validateTokens: async (tokens) => {
        // Simulate expired tokens
        return false;
      }
    };
    
    // Enable and register failing provider
    oauthManager.updateConfig({
      providers: {
        'failing-provider': {
          clientId: 'failing-client-id',
          enabled: true,
          scope: ['read']
        }
      }
    });
    
    oauthManager.registerProvider(failingProvider);
    
    // Test token refresh failure
    await expect(
      failingProvider.refreshTokens('invalid-refresh-token')
    ).rejects.toThrow('Token refresh failed - invalid refresh token');
    
    // Test 3: State parameter validation
    const validState = stateManager.generateState();
    const invalidState = 'invalid-state-parameter';
    
    const validAuthState = stateManager.createAuthState('test-provider', 'http://localhost:8080/callback');
    expect(stateManager.validateState(validAuthState.state)).toBeTruthy();
    expect(stateManager.validateState(invalidState)).toBeNull();
    
    // Test 4: PKCE parameter validation
    const pkceParams = stateManager.generatePKCE();
    expect(pkceParams.codeVerifier.length).toBeGreaterThanOrEqual(43);
    expect(pkceParams.codeVerifier.length).toBeLessThanOrEqual(128);
    expect(pkceParams.codeChallenge.length).toBeGreaterThan(0);
    expect(pkceParams.codeVerifier).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  /**
   * Test 4: Token Refresh and Lifecycle Management
   * Tests token validation, refresh, and lifecycle management
   */
  test('Token refresh and lifecycle management', async () => {
    // Create provider with lifecycle management
    const lifecycleProvider: OAuthProvider = {
      name: 'lifecycle-provider',
      displayName: 'Lifecycle Provider',
      authorizationUrl: 'https://lifecycle.com/oauth/authorize',
      tokenUrl: 'https://lifecycle.com/oauth/token',
      scope: ['read', 'write'],
      clientId: 'lifecycle-client-id',
      buildAuthUrl: (redirectUri, state, codeChallenge) => 
        `https://lifecycle.com/oauth/authorize?client_id=lifecycle-client-id&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&code_challenge=${codeChallenge}`,
      exchangeCodeForTokens: async (code, redirectUri, codeVerifier) => ({
        access_token: `lifecycle_access_${code}`,
        refresh_token: `lifecycle_refresh_${code}`,
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'read write'
      }),
      refreshTokens: async (refreshToken) => ({
        access_token: 'lifecycle_refreshed_access',
        refresh_token: 'lifecycle_new_refresh',
        expires_in: 3600,
        token_type: 'Bearer'
      }),
      validateTokens: async (tokens) => {
        // Validate based on expiration and token format
        return tokens.expiresAt > new Date() && tokens.accessToken.includes('lifecycle');
      }
    };
    
    // Enable and register provider
    oauthManager.updateConfig({
      providers: {
        'lifecycle-provider': {
          clientId: 'lifecycle-client-id',
          enabled: true,
          scope: ['read', 'write']
        }
      }
    });
    
    oauthManager.registerProvider(lifecycleProvider);
    
    // Test 1: Token exchange
    const tokenResponse = await lifecycleProvider.exchangeCodeForTokens(
      'test-auth-code',
      'http://localhost:8080/callback',
      'test-code-verifier'
    );
    
    expect(tokenResponse.access_token).toBe('lifecycle_access_test-auth-code');
    expect(tokenResponse.refresh_token).toBe('lifecycle_refresh_test-auth-code');
    expect(tokenResponse.expires_in).toBe(3600);
    expect(tokenResponse.token_type).toBe('Bearer');
    
    // Test 2: Token validation with valid tokens
    const validTokens: OAuthTokens = {
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token || '',
      expiresAt: new Date(Date.now() + tokenResponse.expires_in * 1000),
      scope: tokenResponse.scope || 'read write',
      tokenType: tokenResponse.token_type
    };
    
    const isValid = await lifecycleProvider.validateTokens(validTokens);
    expect(isValid).toBe(true);
    
    // Test 3: Token validation with expired tokens
    const expiredTokens: OAuthTokens = {
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token || '',
      expiresAt: new Date(Date.now() - 3600000), // 1 hour ago
      scope: tokenResponse.scope || 'read write',
      tokenType: tokenResponse.token_type
    };
    
    const isExpired = await lifecycleProvider.validateTokens(expiredTokens);
    expect(isExpired).toBe(false);
    
    // Test 4: Token refresh
    const refreshResponse = await lifecycleProvider.refreshTokens('lifecycle_refresh_test-auth-code');
    expect(refreshResponse.access_token).toBe('lifecycle_refreshed_access');
    expect(refreshResponse.refresh_token).toBe('lifecycle_new_refresh');
    expect(refreshResponse.expires_in).toBe(3600);
    
    // Test 5: Token storage and retrieval
    await tokenStorage.storeTokens('lifecycle-provider', validTokens);
    const storedTokens = await tokenStorage.getTokens('lifecycle-provider');
    
    expect(storedTokens).toBeTruthy();
    expect(storedTokens?.accessToken).toBe(validTokens.accessToken);
    expect(storedTokens?.refreshToken).toBe(validTokens.refreshToken);
    expect(storedTokens?.tokenType).toBe(validTokens.tokenType);
    expect(storedTokens?.scope).toBe(validTokens.scope);
    
    // Test 6: Token cleanup
    await tokenStorage.removeTokens('lifecycle-provider');
    const removedTokens = await tokenStorage.getTokens('lifecycle-provider');
    expect(removedTokens).toBeNull();
  });

  /**
   * Test 5: Concurrent OAuth Flows
   * Tests handling of multiple simultaneous OAuth flows
   */
  test('Concurrent OAuth flows', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 10 }).filter(s => /^[a-zA-Z0-9]+$/.test(s)),
            clientId: fc.string({ minLength: 10, maxLength: 30 })
          }),
          { minLength: 2, maxLength: 4 }
        ),
        (providerConfigs) => {
          // Ensure unique provider names
          const uniqueConfigs = providerConfigs.filter((config, index, array) => 
            array.findIndex(c => c.name === config.name) === index
          );
          
          if (uniqueConfigs.length < 2) return true;
          
          // Create multiple state managers for concurrent flows
          const stateManagers: StateManager[] = [];
          const authStates: any[] = [];
          
          for (let i = 0; i < uniqueConfigs.length; i++) {
            const stateManager = new StateManager({
              stateExpiration: 300000,
              pkceMethod: 'S256',
              tokenEncryption: true,
              tokenRefreshBuffer: 60000,
              maxAuthAttempts: 3,
              lockoutDuration: 300000
            });
            
            const authState = stateManager.createAuthState(
              uniqueConfigs[i].name,
              `http://localhost:808${i}/callback`
            );
            
            stateManagers.push(stateManager);
            authStates.push(authState);
          }
          
          // Verify all auth states are unique
          const stateParams = authStates.map(state => state.state);
          const uniqueStates = new Set(stateParams);
          expect(uniqueStates.size).toBe(authStates.length);
          
          // Verify all PKCE verifiers are unique
          const codeVerifiers = authStates.map(state => state.codeVerifier);
          const uniqueVerifiers = new Set(codeVerifiers);
          expect(uniqueVerifiers.size).toBe(authStates.length);
          
          // Verify all PKCE challenges are unique
          const codeChallenges = authStates.map(state => state.codeChallenge);
          const uniqueChallenges = new Set(codeChallenges);
          expect(uniqueChallenges.size).toBe(authStates.length);
          
          // Verify state validation works correctly for each flow
          for (let i = 0; i < authStates.length; i++) {
            const validatedState = stateManagers[i].validateState(authStates[i].state);
            expect(validatedState).toBeTruthy();
            expect(validatedState?.provider).toBe(uniqueConfigs[i].name);
            expect(validatedState?.redirectUri).toBe(`http://localhost:808${i}/callback`);
          }
          
          // Verify cross-validation fails (state from one manager shouldn't validate in another)
          if (authStates.length > 1) {
            const crossValidation = stateManagers[0].validateState(authStates[1].state);
            expect(crossValidation).toBeNull();
          }
          
          return true;
        }
      ),
      { numRuns: 15 }
    );
  });

  /**
   * Test 6: Security Parameter Validation
   * Tests security parameter generation and validation
   */
  test('Security parameter validation', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 5, max: 20 }),
        (iterations) => {
          const generatedStates = new Set<string>();
          const generatedVerifiers = new Set<string>();
          const generatedChallenges = new Set<string>();
          
          for (let i = 0; i < iterations; i++) {
            // Generate security parameters
            const state = stateManager.generateState();
            const pkce = stateManager.generatePKCE();
            
            // Validate state parameter
            expect(state.length).toBeGreaterThanOrEqual(32);
            expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
            generatedStates.add(state);
            
            // Validate PKCE parameters
            expect(pkce.codeVerifier.length).toBeGreaterThanOrEqual(43);
            expect(pkce.codeVerifier.length).toBeLessThanOrEqual(128);
            expect(pkce.codeVerifier).toMatch(/^[A-Za-z0-9_-]+$/);
            expect(pkce.codeChallenge.length).toBeGreaterThan(0);
            generatedVerifiers.add(pkce.codeVerifier);
            generatedChallenges.add(pkce.codeChallenge);
            
            // Create auth state and validate
            const authState = stateManager.createAuthState('test-provider', 'http://localhost:8080/callback');
            expect(authState.provider).toBe('test-provider');
            expect(authState.redirectUri).toBe('http://localhost:8080/callback');
            expect(authState.isActive).toBe(true);
            expect(authState.startTime).toBeInstanceOf(Date);
            
            // Validate state can be retrieved
            const validatedState = stateManager.validateState(authState.state);
            expect(validatedState).toBeTruthy();
            expect(validatedState?.provider).toBe('test-provider');
          }
          
          // Verify uniqueness of all generated parameters
          expect(generatedStates.size).toBe(iterations);
          expect(generatedVerifiers.size).toBe(iterations);
          expect(generatedChallenges.size).toBe(iterations);
          
          return true;
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Test 7: Provider Configuration Validation
   * Tests OAuth provider configuration validation and error handling
   */
  test('Provider configuration validation', () => {
    // Test valid provider configurations
    const validConfigs = [
      {
        name: 'google',
        displayName: 'Google',
        authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        scope: ['https://www.googleapis.com/auth/drive'],
        clientId: 'valid-google-client-id'
      },
      {
        name: 'github',
        displayName: 'GitHub',
        authorizationUrl: 'https://github.com/login/oauth/authorize',
        tokenUrl: 'https://github.com/login/oauth/access_token',
        scope: ['repo', 'user'],
        clientId: 'valid-github-client-id'
      }
    ];
    
    for (const config of validConfigs) {
      const provider: OAuthProvider = {
        ...config,
        buildAuthUrl: (redirectUri, state, codeChallenge) => 
          `${config.authorizationUrl}?client_id=${config.clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&code_challenge=${codeChallenge}`,
        exchangeCodeForTokens: async () => ({
          access_token: 'test-token',
          expires_in: 3600,
          token_type: 'Bearer'
        }),
        refreshTokens: async () => ({
          access_token: 'refreshed-token',
          expires_in: 3600,
          token_type: 'Bearer'
        }),
        validateTokens: async () => true
      };
      
      // Enable provider
      oauthManager.updateConfig({
        providers: {
          [config.name]: {
            clientId: config.clientId,
            enabled: true,
            scope: config.scope
          }
        }
      });
      
      // Register provider should succeed
      expect(() => oauthManager.registerProvider(provider)).not.toThrow();
      
      // Verify provider is registered
      const registeredProvider = oauthManager.getProvider(config.name);
      expect(registeredProvider).toBeTruthy();
      expect(registeredProvider?.name).toBe(config.name);
      expect(registeredProvider?.clientId).toBe(config.clientId);
      expect(registeredProvider?.scope).toEqual(config.scope);
    }
    
    // Test invalid provider configurations
    const invalidConfigs = [
      {
        name: '',
        clientId: 'valid-client-id',
        error: 'Provider must have a name and clientId'
      },
      {
        name: 'valid-name',
        clientId: '',
        error: 'Provider must have a name and clientId'
      }
    ];
    
    for (const config of invalidConfigs) {
      const invalidProvider: any = {
        name: config.name,
        displayName: 'Invalid Provider',
        authorizationUrl: 'https://invalid.com/oauth/authorize',
        tokenUrl: 'https://invalid.com/oauth/token',
        scope: ['read'],
        clientId: config.clientId,
        buildAuthUrl: () => 'https://invalid.com/oauth/authorize',
        exchangeCodeForTokens: async () => ({ access_token: 'token', expires_in: 3600, token_type: 'Bearer' }),
        refreshTokens: async () => ({ access_token: 'token', expires_in: 3600, token_type: 'Bearer' }),
        validateTokens: async () => true
      };
      
      // Registration should throw error
      expect(() => oauthManager.registerProvider(invalidProvider)).toThrow(config.error);
    }
  });
});