/**
 * Tauri Browser Launcher
 * Implements the BrowserLauncher interface using Tauri shell commands
 */

import { open } from '@tauri-apps/plugin-shell';

export class TauriBrowserLauncher {

    /**
     * Open URL in system default browser using Tauri shell API
     * @param url The URL to open
     */
    async openUrl(url: string): Promise<void> {
        if (!url) {
            throw new Error('Invalid URL provided');
        }

        try {
            // console.log(`[TauriBrowserLauncher] Opening URL: ${url}`);
            await open(url);
        } catch (error) {
            console.error('[TauriBrowserLauncher] Failed to open URL:', error);
            throw new Error(`Failed to open browser: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}
