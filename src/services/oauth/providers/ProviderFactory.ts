/**
 * OAuth Provider Factory
 * Creates OAuth provider instances from configuration
 */

import { GoogleOAuthProvider } from './GoogleOAuthProvider';
import { OneDriveOAuthProvider } from './OneDriveOAuthProvider';
import type { OAuthProvider, OAuthProviderConfig } from '../interfaces';

export class ProviderFactory {
  /**
   * Create an OAuth provider instance from configuration
   */
  static createProvider(providerName: string, config: OAuthProviderConfig): OAuthProvider {
    switch (providerName.toLowerCase()) {
      case 'google':
        return new GoogleOAuthProvider(config);
      
      case 'dropbox':
        // Future implementation
        throw new Error('Dropbox provider not yet implemented');
      
      case 'onedrive':
        return new OneDriveOAuthProvider(config);
      
      default:
        throw new Error(`Unknown OAuth provider: ${providerName}`);
    }
  }

  /**
   * Get list of supported provider names
   */
  static getSupportedProviders(): string[] {
    return ['google', 'onedrive'];
  }

  /**
   * Check if a provider is supported
   */
  static isProviderSupported(providerName: string): boolean {
    return this.getSupportedProviders().includes(providerName.toLowerCase());
  }

  /**
   * Create multiple providers from configuration
   */
  static createProvidersFromConfig(providersConfig: Record<string, OAuthProviderConfig>): Map<string, OAuthProvider> {
    const providers = new Map<string, OAuthProvider>();

    for (const [providerName, config] of Object.entries(providersConfig)) {
      if (!config.enabled) {
        continue;
      }

      if (!this.isProviderSupported(providerName)) {
        console.warn(`Skipping unsupported OAuth provider: ${providerName}`);
        continue;
      }

      try {
        const provider = this.createProvider(providerName, config);
        providers.set(providerName, provider);
      } catch (error) {
        console.error(`Failed to create OAuth provider '${providerName}':`, error);
      }
    }

    return providers;
  }
}