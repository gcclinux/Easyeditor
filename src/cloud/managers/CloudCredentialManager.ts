import { encryptTextToBytes, decryptBytesToText } from '../../stpFileCrypter';
import { CloudCredentials } from '../interfaces';
import { GOOGLE_DRIVE_CONFIG } from '../config/google-credentials';

// Check if we're in Tauri environment
import { isTauriEnvironment } from '../../utils/environment';
import { createLogger } from '../../utils/logger';

const logger = createLogger('CloudCredentialManager');

interface StoredCloudCredentials {
  encrypted: string; // Base64 encoded encrypted data
  provider: string;
  userId?: string;
  expiresAt?: string; // ISO string
}

const CLOUD_STORAGE_KEY = 'easyeditor_cloud_credentials';
const CLOUD_MASTER_KEY_STORAGE = 'easyeditor_cloud_master_key';

export class CloudCredentialManager {
  private masterKey: string | null = null;
  private oauthManager: any = null; // Will be initialized conditionally

  constructor() {
    // Initialize OAuth manager only in Tauri environment
    if (isTauriEnvironment()) {
      this.initializeOAuth();
    }
  }

  private async initializeOAuth() {
    try {
      // Dynamically import OAuth components to avoid loading in web environment
      const { OAuthManager } = await import('../../services/oauth/core/OAuthManager');
      const { GoogleOAuthProvider } = await import('../../services/oauth/providers/GoogleOAuthProvider');

      this.oauthManager = new OAuthManager();

      // Register OAuth providers
      if (GOOGLE_DRIVE_CONFIG.CLIENT_ID) {
        const googleProvider = new GoogleOAuthProvider(GOOGLE_DRIVE_CONFIG.CLIENT_ID);
        this.oauthManager.registerProvider(googleProvider);
      }
    } catch (error) {
      logger.warn('OAuth initialization failed, OAuth features disabled:', error);
    }
  }

  /**
   * Initialize the credential manager with a master password
   * This password is used to encrypt/decrypt credentials
   */
  async setMasterPassword(password: string): Promise<void> {
    if (!password || password.length < 8) {
      throw new Error('Master password must be at least 8 characters long');
    }

    this.masterKey = password;
    // Store a hash of the master key to verify it later
    const hash = await this.hashPassword(password);
    localStorage.setItem(CLOUD_MASTER_KEY_STORAGE, hash);
  }

  /**
   * Verify if the provided master password is correct
   */
  async verifyMasterPassword(password: string): Promise<boolean> {
    const storedHash = localStorage.getItem(CLOUD_MASTER_KEY_STORAGE);
    if (!storedHash) {
      return false;
    }

    const hash = await this.hashPassword(password);
    return hash === storedHash;
  }

  /**
   * Check if master password has been set
   */
  hasMasterPassword(): boolean {
    return localStorage.getItem(CLOUD_MASTER_KEY_STORAGE) !== null;
  }

  /**
   * Hash a password for verification purposes
   */
  private async hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Save cloud provider credentials securely
   * Now saves to OAuth system as primary with legacy fallback
   */
  async saveCredentials(credentials: CloudCredentials): Promise<void> {
    logger.log('Saving credentials for provider:', credentials.provider, 'userId:', credentials.userId);

    try {
      // Try to save to OAuth system first (only if available in Tauri environment)
      if (this.oauthManager) {
        const oauthProvider = this.mapProviderToOAuth(credentials.provider);
        if (oauthProvider && credentials.accessToken && credentials.expiresAt) {
          const oauthTokens = {
            accessToken: credentials.accessToken,
            refreshToken: credentials.refreshToken,
            expiresAt: credentials.expiresAt,
            scope: credentials.scope || '',
            tokenType: 'Bearer'
          };

          try {
            // Store in OAuth system using token storage directly
            const tokenStorage = (this.oauthManager as any).tokenStorage;
            if (tokenStorage) {
              await tokenStorage.storeTokens(oauthProvider, oauthTokens);
              logger.log('Successfully saved credentials to OAuth system');
              return;
            }
          } catch (oauthError) {
            logger.warn('Failed to save to OAuth system:', oauthError);
          }
        }
      }

      // Fallback to legacy storage
      logger.log('Using legacy credential storage');
      await this.saveLegacyCredentials(credentials);

    } catch (error) {
      logger.error('Error saving to OAuth system, falling back to legacy:', error);
      // Fallback to legacy storage
      await this.saveLegacyCredentials(credentials);
    }
  }

  /**
   * Legacy credential saving method
   */
  private async saveLegacyCredentials(credentials: CloudCredentials): Promise<void> {
    // Temporarily disable master password requirement for development
    if (!this.masterKey) {
      logger.warn('Master password disabled for development - credentials stored in plain text');
      this.masterKey = 'temp-dev-key'; // Use a temporary key for encryption/decryption
    }

    try {
      // Get existing credentials
      const existingCredentials = await this.getAllStoredCredentials();
      logger.log('Existing legacy credentials count:', existingCredentials.length);

      // Serialize credentials to JSON
      const jsonString = JSON.stringify({
        provider: credentials.provider,
        accessToken: credentials.accessToken,
        refreshToken: credentials.refreshToken,
        scope: credentials.scope,
        userId: credentials.userId,
      });

      // Encrypt the JSON string
      const encrypted = encryptTextToBytes(jsonString, this.masterKey);

      // Convert to base64 for storage
      const base64 = this.uint8ArrayToBase64(encrypted);

      const stored: StoredCloudCredentials = {
        encrypted: base64,
        provider: credentials.provider,
        userId: credentials.userId,
        expiresAt: credentials.expiresAt?.toISOString(),
      };

      // Update or add credentials for this provider
      const updatedCredentials = existingCredentials.filter(
        cred => cred.provider !== credentials.provider || cred.userId !== credentials.userId
      );
      updatedCredentials.push(stored);

      logger.log('Saving to localStorage, total credentials:', updatedCredentials.length);
      localStorage.setItem(CLOUD_STORAGE_KEY, JSON.stringify(updatedCredentials));
      logger.log('Successfully saved legacy credentials to localStorage');

      // Verify the save worked
      const verification = localStorage.getItem(CLOUD_STORAGE_KEY);
      logger.log('Verification - localStorage contains:', !!verification);

    } catch (error) {
      logger.error('Failed to save legacy credentials:', error);
      throw new Error(`Failed to save credentials: ${(error as Error).message}`);
    }
  }

  /**
   * Retrieve cloud provider credentials
   * Uses OAuth system in Tauri environment, legacy storage in web environment
   */
  async getCredentials(provider: string, userId?: string): Promise<CloudCredentials | null> {
    try {
      // First try to get credentials from OAuth system (only in Tauri environment)
      if (this.oauthManager) {
        const oauthProvider = this.mapProviderToOAuth(provider);
        if (oauthProvider) {
          try {
            const authState = await this.oauthManager.getAuthenticationState(oauthProvider);
            if (authState?.isAuthenticated && authState.tokens) {
              logger.log('Retrieved credentials from OAuth system for provider:', provider);
              return {
                provider,
                accessToken: authState.tokens.accessToken,
                refreshToken: authState.tokens.refreshToken,
                expiresAt: authState.tokens.expiresAt,
                scope: authState.tokens.scope,
                userId: userId
              };
            }
          } catch (oauthError) {
            logger.warn('OAuth credential retrieval failed:', oauthError);
          }
        }
      }

      // Fallback to legacy credential storage
      logger.log('No OAuth credentials found, checking legacy storage for provider:', provider);
      return await this.getLegacyCredentials(provider, userId);

    } catch (error) {
      logger.error('Error retrieving credentials:', error);
      // Fallback to legacy system on errors
      return await this.getLegacyCredentials(provider, userId);
    }
  }

  /**
   * Legacy credential retrieval method
   */
  private async getLegacyCredentials(provider: string, userId?: string): Promise<CloudCredentials | null> {
    // Temporarily disable master password requirement for development
    // TODO: Re-enable master password protection later
    if (!this.masterKey) {
      logger.warn('Master password disabled for development - credentials stored in plain text');
      this.masterKey = 'temp-dev-key'; // Use a temporary key for encryption/decryption
    }

    try {
      const storedCredentials = await this.getAllStoredCredentials();
      logger.log('Looking for legacy credentials for provider:', provider, 'userId:', userId);
      logger.log('Available legacy credentials:', storedCredentials.map(c => ({ provider: c.provider, userId: c.userId, hasToken: !!c.encrypted })));

      // Find credentials for the specified provider and user
      // If no userId is specified, find the first matching provider
      const stored = storedCredentials.find(cred =>
        cred.provider === provider &&
        (userId === undefined || cred.userId === userId)
      );

      logger.log('Found stored legacy credentials:', !!stored);

      if (!stored) {
        return null;
      }

      // Check if credentials are expired
      if (stored.expiresAt) {
        const expiresAt = new Date(stored.expiresAt);
        if (expiresAt <= new Date()) {
          // Credentials are expired, remove them
          await this.removeCredentials(provider, userId);
          return null;
        }
      }

      // Decrypt credentials
      const encryptedBytes = this.base64ToUint8Array(stored.encrypted);
      const decryptedString = decryptBytesToText(encryptedBytes, this.masterKey);

      const credentials = JSON.parse(decryptedString);

      return {
        provider: credentials.provider,
        accessToken: credentials.accessToken,
        refreshToken: credentials.refreshToken,
        expiresAt: stored.expiresAt ? new Date(stored.expiresAt) : undefined,
        scope: credentials.scope,
        userId: credentials.userId,
      };
    } catch (error) {
      logger.error('Failed to retrieve legacy credentials:', error);
      return null;
    }
  }

  /**
   * Get all stored credentials (for listing connected providers)
   */
  private async getAllStoredCredentials(): Promise<StoredCloudCredentials[]> {
    const storedString = localStorage.getItem(CLOUD_STORAGE_KEY);
    if (!storedString) {
      return [];
    }

    try {
      return JSON.parse(storedString);
    } catch (error) {
      // If parsing fails, return empty array and clear corrupted data
      localStorage.removeItem(CLOUD_STORAGE_KEY);
      return [];
    }
  }

  /**
   * Get list of connected providers
   */
  async getConnectedProviders(): Promise<Array<{ provider: string; userId?: string; expiresAt?: Date }>> {
    if (!this.masterKey) {
      return [];
    }

    const storedCredentials = await this.getAllStoredCredentials();
    return storedCredentials.map(cred => ({
      provider: cred.provider,
      userId: cred.userId,
      expiresAt: cred.expiresAt ? new Date(cred.expiresAt) : undefined,
    }));
  }

  /**
   * Check if credentials exist for a provider
   */
  async hasCredentials(provider: string, userId?: string): Promise<boolean> {
    if (!this.masterKey) {
      return false;
    }

    const storedCredentials = await this.getAllStoredCredentials();
    return storedCredentials.some(cred =>
      cred.provider === provider &&
      cred.userId === userId
    );
  }

  /**
   * Remove credentials for a specific provider
   * Removes from both OAuth system (if available) and legacy storage
   */
  async removeCredentials(provider: string, userId?: string): Promise<void> {
    try {
      // Remove from OAuth system (only if available in Tauri environment)
      if (this.oauthManager) {
        const oauthProvider = this.mapProviderToOAuth(provider);
        if (oauthProvider) {
          try {
            await this.oauthManager.logout(oauthProvider);
            logger.log('Removed credentials from OAuth system for provider:', provider);
          } catch (oauthError) {
            logger.warn('Error removing OAuth credentials:', oauthError);
          }
        }
      }
    } catch (error) {
      logger.error('Error removing OAuth credentials:', error);
    }

    // Also remove from legacy storage
    try {
      const storedCredentials = await this.getAllStoredCredentials();
      const filteredCredentials = storedCredentials.filter(cred =>
        !(cred.provider === provider && cred.userId === userId)
      );

      if (filteredCredentials.length === 0) {
        localStorage.removeItem(CLOUD_STORAGE_KEY);
      } else {
        localStorage.setItem(CLOUD_STORAGE_KEY, JSON.stringify(filteredCredentials));
      }
      logger.log('Removed credentials from legacy storage for provider:', provider);
    } catch (error) {
      logger.error('Error removing legacy credentials:', error);
    }
  }

  /**
   * Clear all stored credentials
   */
  async clearAllCredentials(): Promise<void> {
    localStorage.removeItem(CLOUD_STORAGE_KEY);
  }

  /**
   * Clear master password and all credentials
   */
  async clearMasterPassword(): Promise<void> {
    localStorage.removeItem(CLOUD_MASTER_KEY_STORAGE);
    localStorage.removeItem(CLOUD_STORAGE_KEY);
    this.masterKey = null;
  }

  /**
   * Unlock credentials with master password
   */
  async unlock(password: string): Promise<boolean> {
    const isValid = await this.verifyMasterPassword(password);
    if (isValid) {
      this.masterKey = password;
      return true;
    }
    return false;
  }

  /**
   * Lock credentials (clear master key from memory)
   */
  lock(): void {
    this.masterKey = null;
  }

  /**
   * Check if credentials are currently unlocked
   */
  isUnlocked(): boolean {
    // Temporarily always return true when master password is disabled for development
    return true; // TODO: Change back to `return this.masterKey !== null;` when re-enabling master password
  }

  /**
   * Update credentials (for token refresh)
   */
  async updateCredentials(provider: string, updates: Partial<CloudCredentials>, userId?: string): Promise<void> {
    const existingCredentials = await this.getCredentials(provider, userId);
    if (!existingCredentials) {
      throw new Error(`No credentials found for provider: ${provider}`);
    }

    const updatedCredentials: CloudCredentials = {
      ...existingCredentials,
      ...updates,
      provider, // Ensure provider doesn't change
    };

    await this.saveCredentials(updatedCredentials);
  }

  /**
   * Check if any credentials are expired and need refresh
   */
  async getExpiredCredentials(): Promise<Array<{ provider: string; userId?: string }>> {
    if (!this.masterKey) {
      return [];
    }

    const storedCredentials = await this.getAllStoredCredentials();
    const now = new Date();

    return storedCredentials
      .filter(cred => cred.expiresAt && new Date(cred.expiresAt) <= now)
      .map(cred => ({ provider: cred.provider, userId: cred.userId }));
  }

  /**
   * Convert Uint8Array to Base64 string
   */
  private uint8ArrayToBase64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Convert Base64 string to Uint8Array
   */
  private base64ToUint8Array(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  /**
   * Map cloud provider names to OAuth provider names
   */
  private mapProviderToOAuth(provider: string): string | null {
    switch (provider.toLowerCase()) {
      case 'googledrive':
      case 'google-drive':
      case 'google':
        return 'google';
      // Add more mappings as needed for other providers
      default:
        return null;
    }
  }
}

// Export a singleton instance
export const cloudCredentialManager = new CloudCredentialManager();