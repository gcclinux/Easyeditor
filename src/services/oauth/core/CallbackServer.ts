/**
 * OAuth Callback Server
 * Manages temporary local HTTP server for capturing OAuth redirect responses
 */

import * as http from 'http';
import { URL } from 'url';
import type { CallbackServerConfig, CallbackResult } from '../interfaces';

export class CallbackServer {
  private server: http.Server | null = null;
  private config: CallbackServerConfig;
  private activePromise: Promise<CallbackResult> | null = null;
  private resolveCallback: ((result: CallbackResult) => void) | null = null;

  constructor(config?: Partial<CallbackServerConfig>) {
    this.config = {
      host: '127.0.0.1',
      portRange: [8080, 8082],
      timeout: 300000, // 5 minutes
      maxRetries: 3,
      ...config
    };
  }

  /**
   * Start the callback server and return the redirect URI
   */
  async start(config?: Partial<CallbackServerConfig>): Promise<string> {
    if (this.server) {
      throw new Error('Callback server is already running');
    }

    // Update config if provided
    if (config) {
      this.config = { ...this.config, ...config };
    }

    const port = await this.findAvailablePort(this.config.port || 8080);
    
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      this.server.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'EADDRINUSE') {
          reject(new Error(`Port ${port} is already in use`));
        } else {
          reject(error);
        }
      });

      this.server.listen(port, this.config.host, () => {
        const redirectUri = `http://${this.config.host}:${port}/callback`;
        resolve(redirectUri);
      });
    });
  }

  /**
   * Wait for OAuth callback with timeout
   */
  async waitForCallback(timeoutMs?: number): Promise<CallbackResult> {
    if (this.activePromise) {
      return this.activePromise;
    }

    const timeout = timeoutMs || this.config.timeout;

    this.activePromise = new Promise<CallbackResult>((resolve) => {
      this.resolveCallback = resolve;

      // Set timeout
      setTimeout(() => {
        if (this.resolveCallback === resolve) {
          this.resolveCallback = null;
          this.activePromise = null;
          resolve({
            success: false,
            error: 'timeout',
            errorDescription: 'Authentication timed out'
          });
        }
      }, timeout);
    });

    return this.activePromise;
  }

  /**
   * Stop the callback server and cleanup resources
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.server = null;
          this.activePromise = null;
          this.resolveCallback = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Handle incoming HTTP requests
   */
  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    // Set CORS headers for security
    res.setHeader('Access-Control-Allow-Origin', 'null');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    try {
      if (!req.url) {
        this.sendErrorResponse(res, 400, 'Bad Request: Missing URL');
        return;
      }

      const url = new URL(req.url, `http://${this.config.host}`);
      
      // Only handle callback path
      if (url.pathname !== '/callback') {
        this.sendErrorResponse(res, 404, 'Not Found');
        return;
      }

      // Only allow GET requests
      if (req.method !== 'GET') {
        this.sendErrorResponse(res, 405, 'Method Not Allowed');
        return;
      }

      const result = this.validateCallback(url);
      
      // Send response to browser
      if (result.success) {
        this.sendSuccessResponse(res);
      } else {
        this.sendErrorResponse(res, 400, result.errorDescription || 'Authentication failed');
      }

      // Resolve the waiting promise
      if (this.resolveCallback) {
        this.resolveCallback(result);
        this.resolveCallback = null;
        this.activePromise = null;
      }

    } catch (error) {
      console.error('Error handling callback request:', error);
      this.sendErrorResponse(res, 500, 'Internal Server Error');
      
      if (this.resolveCallback) {
        this.resolveCallback({
          success: false,
          error: 'server_error',
          errorDescription: 'Internal server error processing callback'
        });
        this.resolveCallback = null;
        this.activePromise = null;
      }
    }
  }

  /**
   * Find an available port starting from the given port
   */
  private async findAvailablePort(startPort: number): Promise<number> {
    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      const port = startPort + attempt;
      
      if (await this.isPortAvailable(port)) {
        return port;
      }
    }
    
    throw new Error(`No available ports found in range ${startPort}-${startPort + this.config.maxRetries - 1}`);
  }

  /**
   * Check if a port is available
   */
  private async isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = http.createServer();
      
      server.on('error', () => {
        resolve(false);
      });
      
      server.listen(port, this.config.host, () => {
        server.close(() => {
          resolve(true);
        });
      });
    });
  }

  /**
   * Validate OAuth callback parameters with enhanced error detection
   * Requirements: 3.1, 3.2, 3.4
   */
  private validateCallback(url: URL): CallbackResult {
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');
    const errorDescription = url.searchParams.get('error_description');

    // Check for OAuth error response
    if (error) {
      // Detect user cancellation patterns
      const userCancellationErrors = [
        'access_denied',
        'user_cancelled_login',
        'user_denied',
        'authorization_declined'
      ];
      
      if (userCancellationErrors.includes(error)) {
        return {
          success: false,
          error: 'user_cancelled',
          errorDescription: 'Authentication was cancelled by the user'
        };
      }
      
      return {
        success: false,
        error,
        errorDescription: errorDescription || undefined
      };
    }

    // Validate required parameters
    if (!code) {
      return {
        success: false,
        error: 'invalid_request',
        errorDescription: 'Missing authorization code'
      };
    }

    if (!state) {
      return {
        success: false,
        error: 'invalid_request',
        errorDescription: 'Missing state parameter'
      };
    }

    // Additional validation for code format (basic sanity check)
    if (code.length < 10 || !/^[a-zA-Z0-9._-]+$/.test(code)) {
      return {
        success: false,
        error: 'invalid_request',
        errorDescription: 'Invalid authorization code format'
      };
    }

    return {
      success: true,
      code,
      state
    };
  }

  /**
   * Send success response to browser
   */
  private sendSuccessResponse(res: http.ServerResponse): void {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Authentication Successful</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            .success { color: #28a745; }
            .container { max-width: 400px; margin: 0 auto; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1 class="success">✓ Authentication Successful</h1>
            <p>You can now close this window and return to the application.</p>
          </div>
          <script>
            // Auto-close window after 3 seconds
            setTimeout(() => {
              window.close();
            }, 3000);
          </script>
        </body>
      </html>
    `;

    res.writeHead(200, {
      'Content-Type': 'text/html',
      'Content-Length': Buffer.byteLength(html)
    });
    res.end(html);
  }

  /**
   * Send error response to browser
   */
  private sendErrorResponse(res: http.ServerResponse, statusCode: number, message: string): void {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Authentication Error</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            .error { color: #dc3545; }
            .container { max-width: 400px; margin: 0 auto; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1 class="error">✗ Authentication Error</h1>
            <p>${message}</p>
            <p>Please close this window and try again.</p>
          </div>
          <script>
            // Auto-close window after 5 seconds
            setTimeout(() => {
              window.close();
            }, 5000);
          </script>
        </body>
      </html>
    `;

    res.writeHead(statusCode, {
      'Content-Type': 'text/html',
      'Content-Length': Buffer.byteLength(html)
    });
    res.end(html);
  }
}