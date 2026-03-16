/**
 * OAuth Configuration Manager
 * Manages OAuth system configuration including environment variables,
 * provider settings, and security parameters
 */

import type {
  OAuthConfig,
  OAuthProviderConfig,
  CallbackServerConfig,
  SecurityConfig,
  OAuthEnvironmentVars,
  ConfigValidationResult
} from '../interfaces';

export class OAuthConfigManager {
  private config: OAuthConfig;
  private environmentVars: OAuthEnvironmentVars;

  constructor(baseConfig?: Partial<OAuthConfig>) {
    this.environmentVars = this.loadEnvironmentVars();
    this.config = this.buildConfig(baseConfig);
  }

  /**
   * Get the complete OAuth configuration
   */
  getConfig(): OAuthConfig {
    return { ...this.config };
  }

  /**
   * Get configuration for a specific provider
   */
  getProviderConfig(providerName: string): OAuthProviderConfig | null {
    const providerConfig = this.config.providers[providerName];
    return providerConfig ? { ...providerConfig } : null;
  }

  /**
   * Get callback server configuration
   */
  getCallbackServerConfig(): CallbackServerConfig {
    return { ...this.config.callbackServer };
  }

  /**
   * Get security configuration
   */
  getSecurityConfig(): SecurityConfig {
    return { ...this.config.security };
  }

  /**
   * Update provider configuration
   */
  updateProviderConfig(providerName: string, config: Partial<OAuthProviderConfig>): void {
    if (!this.config.providers[providerName]) {
      throw new Error(`Provider '${providerName}' not found in configuration`);
    }

    this.config.providers[providerName] = {
      ...this.config.providers[providerName],
      ...config
    };
  }

  /**
   * Add a new provider configuration
   */
  addProviderConfig(providerName: string, config: OAuthProviderConfig): void {
    if (this.config.providers[providerName]) {
      throw new Error(`Provider '${providerName}' already exists in configuration`);
    }

    this.config.providers[providerName] = { ...config };
  }

  /**
   * Remove a provider configuration
   */
  removeProviderConfig(providerName: string): void {
    if (!this.config.providers[providerName]) {
      throw new Error(`Provider '${providerName}' not found in configuration`);
    }

    delete this.config.providers[providerName];
  }

  /**
   * Update callback server configuration
   */
  updateCallbackServerConfig(config: Partial<CallbackServerConfig>): void {
    this.config.callbackServer = {
      ...this.config.callbackServer,
      ...config
    };
  }

  /**
   * Update security configuration
   */
  updateSecurityConfig(config: Partial<SecurityConfig>): void {
    this.config.security = {
      ...this.config.security,
      ...config
    };
  }

  /**
   * Validate the current configuration
   */
  validateConfig(): ConfigValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate providers
    const enabledProviders = Object.entries(this.config.providers)
      .filter(([, config]) => config.enabled);

    if (enabledProviders.length === 0) {
      warnings.push('No OAuth providers are enabled');
    }

    for (const [providerName, providerConfig] of enabledProviders) {
      // Validate required fields
      if (!providerConfig.clientId) {
        errors.push(`Provider '${providerName}' missing required clientId`);
      }

      if (!providerConfig.scope || providerConfig.scope.length === 0) {
        errors.push(`Provider '${providerName}' missing required scope`);
      }

      // Validate URLs if provided
      if (providerConfig.authorizationUrl && !this.isValidUrl(providerConfig.authorizationUrl)) {
        errors.push(`Provider '${providerName}' has invalid authorizationUrl`);
      }

      if (providerConfig.tokenUrl && !this.isValidUrl(providerConfig.tokenUrl)) {
        errors.push(`Provider '${providerName}' has invalid tokenUrl`);
      }
    }

    // Validate callback server config
    const callbackConfig = this.config.callbackServer;
    
    if (callbackConfig.port && (callbackConfig.port < 1024 || callbackConfig.port > 65535)) {
      warnings.push('Callback server port should be between 1024 and 65535');
    }

    if (callbackConfig.portRange[0] >= callbackConfig.portRange[1]) {
      errors.push('Callback server portRange start must be less than end');
    }

    if (callbackConfig.timeout < 30000) {
      warnings.push('Callback server timeout is less than 30 seconds, which may be too short');
    }

    if (callbackConfig.maxRetries < 1) {
      errors.push('Callback server maxRetries must be at least 1');
    }

    // Validate security config
    const securityConfig = this.config.security;

    if (securityConfig.stateExpiration < 60000) {
      warnings.push('State expiration is less than 1 minute, which may be too short');
    }

    if (securityConfig.tokenRefreshBuffer < 60000) {
      warnings.push('Token refresh buffer is less than 1 minute, which may cause frequent refreshes');
    }

    if (securityConfig.maxAuthAttempts < 1) {
      errors.push('Maximum authentication attempts must be at least 1');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get list of enabled providers
   */
  getEnabledProviders(): string[] {
    return Object.entries(this.config.providers)
      .filter(([, config]) => config.enabled)
      .map(([name]) => name);
  }

  /**
   * Check if a provider is enabled
   */
  isProviderEnabled(providerName: string): boolean {
    const providerConfig = this.config.providers[providerName];
    return providerConfig ? providerConfig.enabled : false;
  }

  /**
   * Load environment variables for OAuth configuration
   */
  private loadEnvironmentVars(): OAuthEnvironmentVars {
    // In a real application, this would use process.env
    // For now, we'll simulate environment variable loading
    const env: OAuthEnvironmentVars = {};

    // Check for common environment variable patterns
    if (typeof window !== 'undefined') {
      // Browser environment - check for injected config
      const globalConfig = (window as any).__OAUTH_CONFIG__;
      if (globalConfig) {
        Object.assign(env, globalConfig);
      }
    } else {
      // Node.js environment - use process.env
      env.GOOGLE_OAUTH_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
      env.GOOGLE_OAUTH_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
      env.DROPBOX_OAUTH_CLIENT_ID = process.env.DROPBOX_OAUTH_CLIENT_ID;
      env.ONEDRIVE_OAUTH_CLIENT_ID = process.env.ONEDRIVE_OAUTH_CLIENT_ID;
      env.OAUTH_CALLBACK_PORT = process.env.OAUTH_CALLBACK_PORT;
      env.OAUTH_CALLBACK_HOST = process.env.OAUTH_CALLBACK_HOST;
      env.OAUTH_TIMEOUT = process.env.OAUTH_TIMEOUT;
      env.NODE_ENV = process.env.NODE_ENV as 'development' | 'production' | 'test';
    }

    return env;
  }

  /**
   * Build the complete configuration from base config and environment variables
   */
  private buildConfig(baseConfig?: Partial<OAuthConfig>): OAuthConfig {
    // Default configuration
    const defaultConfig: OAuthConfig = {
      providers: {},
      callbackServer: {
        host: '127.0.0.1',
        portRange: [8080, 8082],
        timeout: 300000, // 5 minutes
        maxRetries: 3,
        useHttps: false
      },
      security: {
        stateExpiration: 600000, // 10 minutes
        pkceMethod: 'S256',
        tokenEncryption: true,
        tokenRefreshBuffer: 300000, // 5 minutes
        maxAuthAttempts: 3,
        lockoutDuration: 900000 // 15 minutes
      }
    };

    // Apply environment-based provider configurations
    this.applyEnvironmentProviderConfigs(defaultConfig);

    // Apply environment-based system configurations
    this.applyEnvironmentSystemConfigs(defaultConfig);

    // Merge with base configuration
    const mergedConfig = this.deepMerge(defaultConfig, baseConfig || {});

    // Apply environment-specific overrides
    const currentEnv = this.environmentVars.NODE_ENV || 'development';
    if (mergedConfig.environment && mergedConfig.environment[currentEnv]) {
      return this.deepMerge(mergedConfig, mergedConfig.environment[currentEnv]);
    }

    return mergedConfig;
  }

  /**
   * Apply environment variables to provider configurations
   */
  private applyEnvironmentProviderConfigs(config: OAuthConfig): void {
    // Google provider configuration
    if (this.environmentVars.GOOGLE_OAUTH_CLIENT_ID) {
      config.providers.google = {
        clientId: this.environmentVars.GOOGLE_OAUTH_CLIENT_ID,
        clientSecret: this.environmentVars.GOOGLE_OAUTH_CLIENT_SECRET,
        scope: ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive.readonly'],
        authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        enabled: true,
        additionalParams: {
          access_type: 'offline',
          prompt: 'consent'
        }
      };
    }

    // Dropbox provider configuration (future)
    if (this.environmentVars.DROPBOX_OAUTH_CLIENT_ID) {
      config.providers.dropbox = {
        clientId: this.environmentVars.DROPBOX_OAUTH_CLIENT_ID,
        scope: ['files.content.write', 'files.content.read'],
        authorizationUrl: 'https://www.dropbox.com/oauth2/authorize',
        tokenUrl: 'https://api.dropboxapi.com/oauth2/token',
        enabled: true
      };
    }

    // OneDrive provider configuration (future)
    if (this.environmentVars.ONEDRIVE_OAUTH_CLIENT_ID) {
      config.providers.onedrive = {
        clientId: this.environmentVars.ONEDRIVE_OAUTH_CLIENT_ID,
        scope: ['Files.ReadWrite'],
        authorizationUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
        tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        enabled: true
      };
    }
  }

  /**
   * Apply environment variables to system configurations
   */
  private applyEnvironmentSystemConfigs(config: OAuthConfig): void {
    // Callback server configuration
    if (this.environmentVars.OAUTH_CALLBACK_PORT) {
      const port = parseInt(this.environmentVars.OAUTH_CALLBACK_PORT, 10);
      if (!isNaN(port)) {
        config.callbackServer.port = port;
      }
    }

    if (this.environmentVars.OAUTH_CALLBACK_HOST) {
      config.callbackServer.host = this.environmentVars.OAUTH_CALLBACK_HOST;
    }

    if (this.environmentVars.OAUTH_TIMEOUT) {
      const timeout = parseInt(this.environmentVars.OAUTH_TIMEOUT, 10) * 1000; // Convert seconds to milliseconds
      if (!isNaN(timeout)) {
        config.callbackServer.timeout = timeout;
      }
    }

    // Environment-specific adjustments
    const nodeEnv = this.environmentVars.NODE_ENV;
    if (nodeEnv === 'development') {
      // Development mode: shorter timeouts, more verbose logging
      config.callbackServer.timeout = Math.min(config.callbackServer.timeout, 180000); // 3 minutes max
      config.security.stateExpiration = Math.min(config.security.stateExpiration, 300000); // 5 minutes max
    } else if (nodeEnv === 'test') {
      // Test mode: very short timeouts
      config.callbackServer.timeout = 30000; // 30 seconds
      config.security.stateExpiration = 60000; // 1 minute
      config.security.tokenRefreshBuffer = 30000; // 30 seconds
    }
  }

  /**
   * Deep merge two configuration objects
   */
  private deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
    const result = { ...target };

    for (const key in source) {
      if (source[key] !== undefined) {
        if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
          result[key] = this.deepMerge(result[key] || {} as any, source[key] as any) as any;
        } else {
          result[key] = source[key] as any;
        }
      }
    }

    return result;
  }

  /**
   * Validate URL format
   */
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return url.startsWith('https://') || url.startsWith('http://');
    } catch {
      return false;
    }
  }
}