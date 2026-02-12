/**
 * Browser Launcher - Browser stub
 * This is a stub implementation for browser environments
 * The actual browser launching in Tauri should use Tauri shell commands
 */

export class BrowserLauncher {
  constructor() {
    // console.warn('[BrowserLauncher] Browser stub - OAuth should use Tauri backend');
  }

  /**
   * Launch system browser (stub - not available in browser)
   */
  async launchBrowser(url: string): Promise<void> {
    throw new Error('BrowserLauncher is not available in browser environment. Use Tauri shell commands instead.');
  }

  /**
   * Check if browser launching is supported (always false in browser)
   */
  isSupported(): boolean {
    return false;
  }

  /**
   * Get platform information (stub)
   */
  getPlatform(): string {
    return 'browser';
  }
}