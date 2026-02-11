/**
 * Shared OAuth Manager Singleton for Tauri Environment
 * 
 * This ensures only one OAuth manager instance exists across all providers,
 * preventing port conflicts and state management issues.
 */

import { OAuthManager } from '../core/OAuthManager';
import { createOAuthManager } from './TauriOAuthManager';

let sharedOAuthManagerInstance: OAuthManager | null = null;

/**
 * Get or create the shared OAuth manager instance
 * Providers register themselves using registerProvider() method after getting the manager.
 */
export function getSharedOAuthManager(): OAuthManager {
  if (!sharedOAuthManagerInstance) {
    console.log('[SharedOAuthManager] Creating new shared OAuth manager instance');
    // Create with empty config - providers will register themselves dynamically
    sharedOAuthManagerInstance = createOAuthManager({
      providers: {}
    });
  } else {
    console.log('[SharedOAuthManager] Reusing existing OAuth manager instance');
  }
  
  return sharedOAuthManagerInstance;
}

/**
 * Reset the shared OAuth manager (useful for testing)
 */
export function resetSharedOAuthManager(): void {
  console.log('[SharedOAuthManager] Resetting shared OAuth manager');
  sharedOAuthManagerInstance = null;
}
