/**
 * Tauri Callback Server
 * Implements the CallbackServer interface using Tauri commands
 */

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { CallbackServerConfig, CallbackResult } from '../interfaces';

export class TauriCallbackServer {
    private config: CallbackServerConfig;
    private unlisten: (() => void) | null = null;
    private isRunning: boolean = false;

    constructor(config?: Partial<CallbackServerConfig>) {
        this.config = {
            host: '127.0.0.1',
            portRange: [8080, 8082],
            timeout: 300000,
            maxRetries: 3,
            useHttps: false,
            ...config
        };
    }

    /**
     * Start the callback server via Rust backend
     */
    async start(config?: Partial<CallbackServerConfig>): Promise<string> {
        if (this.isRunning) {
            return `http://127.0.0.1:${this.config.port}/callback`;
        }

        const startConfig = { ...this.config, ...config };

        // If a specific port is requested via argument, try only that one.
        // Otherwise, try the configured range.
        const rangeStart = config?.port || startConfig.portRange[0];
        const rangeEnd = config?.port || startConfig.portRange[1];

        let lastError: any;

        for (let port = rangeStart; port <= rangeEnd; port++) {
            try {
                const url = await invoke('oauth_start_server', { port });
                this.config.port = port;
                this.isRunning = true;
                // console.log('[TauriCallbackServer] Server started at:', url);
                return url as string;
            } catch (error) {
                console.warn(`[TauriCallbackServer] Failed to start server on port ${port}:`, error);
                lastError = error;
                // If it was a specific request (rangeStart == rangeEnd), or if we exhausted range, this loop will finish
            }
        }

        console.error('[TauriCallbackServer] Failed to start server on any port:', lastError);
        throw new Error(
            `Failed to start OAuth server on ports ${rangeStart}-${rangeEnd}: ${lastError}`
        );
    }

    /**
     * Wait for OAuth callback event from Rust
     */
    async waitForCallback(timeoutMs?: number): Promise<CallbackResult> {
        if (!this.isRunning) {
            throw new Error('Callback server is not running');
        }

        return new Promise((resolve) => {
            let timeoutId: any;
            let unlistenFn: (() => void) | null = null;
            let errorUnlistenFn: (() => void) | null = null;

            const cleanup = () => {
                if (timeoutId) clearTimeout(timeoutId);
                if (unlistenFn) unlistenFn();
                if (errorUnlistenFn) errorUnlistenFn();
                this.unlisten = null;
            };

            // Set timeout
            const timeout = timeoutMs || this.config.timeout;
            timeoutId = setTimeout(() => {
                cleanup();
                resolve({
                    success: false,
                    error: 'timeout',
                    errorDescription: 'Waiting for callback timed out'
                });
            }, timeout);

            // Listen for callback event
            listen('oauth-server-callback', (event: any) => {
                cleanup();
                // console.log('[TauriCallbackServer] Received callback event:', event.payload);

                const params = event.payload;
                if (params.code) {
                    resolve({
                        success: true,
                        code: params.code,
                        state: params.state
                    });
                } else if (params.error) {
                    resolve({
                        success: false,
                        error: params.error,
                        errorDescription: params.error_description || ''
                    });
                } else {
                    resolve({
                        success: false,
                        error: 'callback_failed',
                        errorDescription: 'Received callback without code or error'
                    });
                }
            }).then(unlisten => {
                unlistenFn = unlisten;
                this.unlisten = unlisten; // Store for stop()
            });

            // Also listen for server errors
            listen('oauth-server-error', (event: any) => {
                // Log but maybe not reject main promise immediately unless fatal?
                console.error('[TauriCallbackServer] Server error:', event.payload);
            }).then(unlisten => {
                errorUnlistenFn = unlisten;
            });
        });
    }

    /**
     * Stop the callback server
     */
    async stop(): Promise<void> {
        this.isRunning = false;
        if (this.unlisten) {
            this.unlisten();
            this.unlisten = null;
        }
        // Cannot really "stop" the Rust TcpListener once accept() is called unless we drop the future.
        // But since it accepts ONE connection, it stops itself after one request.
    }
}
