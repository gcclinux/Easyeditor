/**
 * OAuth Callback Server - Browser stub
 * This is a stub implementation for browser environments
 * The actual OAuth flow in browser should use Tauri commands
 */

import type { CallbackServerConfig, CallbackResult } from '../interfaces';

export class CallbackServer {
  private config: CallbackServerConfig;

  constructor(config?: Partial<CallbackServerConfig>) {
    this.config = {
      host: '127.0.0.1',
      portRange: [8080, 8082],
      timeout: 300000,
      maxRetries: 3,
      ...config
    };
    
    console.warn('[CallbackServer] Browser stub - OAuth should use Tauri backend');
  }

  /**
   * Start the callback server (stub - not available in browser)
   */
  async start(config?: Partial<CallbackServerConfig>): Promise<string> {
    throw new Error('CallbackServer is not available in browser environment. Use Tauri OAuth commands instead.');
  }

  /**
   * Wait for OAuth callback (stub - not available in browser)
   */
  async waitForCallback(timeoutMs?: number): Promise<CallbackResult> {
    throw new Error('CallbackServer is not available in browser environment. Use Tauri OAuth commands instead.');
  }

  /**
   * Stop the callback server (stub - no-op in browser)
   */
  async stop(): Promise<void> {
    // No-op in browser
  }
}