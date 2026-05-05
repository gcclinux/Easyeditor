/**
 * Example OAuth Configuration
 * This file demonstrates how to configure the OAuth system
 * Copy this file and customize it for your application
 */

import type { OAuthConfig } from '../interfaces';

/**
 * Example OAuth configuration with Google Drive integration
 */
export const exampleOAuthConfig: OAuthConfig = {
  providers: {
    google: {
      clientId: 'your-google-client-id.apps.googleusercontent.com',
      // clientSecret is optional for PKCE flows
      clientSecret: undefined,
      scope: [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/userinfo.profile'
      ],
      enabled: true,
      additionalParams: {
        access_type: 'offline',
        prompt: 'consent'
      }
    }
  },
  callbackServer: {
    host: '127.0.0.1',
    port: 8080,
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
  },
  environment: {
    development: {
      callbackServer: {
        timeout: 180000 // 3 minutes for development
      },
      security: {
        stateExpiration: 300000 // 5 minutes for development
      }
    },
    test: {
      callbackServer: {
        timeout: 30000 // 30 seconds for tests
      },
      security: {
        stateExpiration: 60000, // 1 minute for tests
        tokenRefreshBuffer: 30000 // 30 seconds for tests
      }
    }
  }
};

/**
 * Minimal OAuth configuration for quick setup
 */
export const minimalOAuthConfig: Partial<OAuthConfig> = {
  providers: {
    google: {
      clientId: process.env.GOOGLE_OAUTH_CLIENT_ID || '',
      scope: ['https://www.googleapis.com/auth/drive.file'],
      enabled: true
    }
  }
};

/**
 * Production OAuth configuration with enhanced security
 */
export const productionOAuthConfig: Partial<OAuthConfig> = {
  callbackServer: {
    timeout: 600000, // 10 minutes
    maxRetries: 5
  },
  security: {
    stateExpiration: 900000, // 15 minutes
    tokenRefreshBuffer: 600000, // 10 minutes
    maxAuthAttempts: 2,
    lockoutDuration: 1800000 // 30 minutes
  }
};
