# Tauri OAuth Integration

This module provides OAuth 2.0 authentication functionality specifically designed for Tauri desktop applications. It addresses Tauri's security model limitations by implementing a system browser-based OAuth flow with local callback server.

## Features

- **System Browser OAuth Flow**: Opens OAuth authorization in the user's default browser
- **Local Callback Server**: Captures OAuth redirects through a temporary local HTTP server
- **Secure Token Storage**: Uses platform-specific secure storage (Windows Credential Manager, macOS Keychain, Linux Secret Service)
- **Cross-Platform Support**: Works on Windows, macOS, and Linux
- **Event-Driven Architecture**: Communicates between Rust backend and TypeScript frontend through Tauri events
- **User Notifications**: Provides desktop notifications for OAuth events
- **Error Handling**: Comprehensive error handling with user-friendly messages

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend UI   │◄──►│  Tauri Commands  │◄──►│  Rust Backend   │
│   (TypeScript)  │    │   (Bridge)       │    │   (OAuth State) │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ OAuth Manager   │    │  Event System    │    │ System Browser  │
│ (Core Logic)    │    │  (Notifications) │    │ (Authorization) │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Usage

### Basic Setup

```typescript
import { createOAuthManager } from '../services/oauth/tauri';

// Create OAuth manager (automatically detects Tauri environment)
const oauthManager = createOAuthManager({
  providers: {
    google: {
      clientId: 'your-google-client-id.apps.googleusercontent.com',
      scope: ['https://www.googleapis.com/auth/drive.file'],
      enabled: true
    }
  }
});

// Authenticate with Google Drive
try {
  const result = await oauthManager.authenticate('google');
  if (result.success) {
    console.log('Authentication successful!', result.tokens);
  } else {
    console.error('Authentication failed:', result.error);
  }
} catch (error) {
  console.error('OAuth error:', error);
}
```

### Using the UI Component

```tsx
import React from 'react';
import { TauriOAuthUI } from '../components/TauriOAuthUI';

function MyApp() {
  const handleAuthSuccess = (provider: string, result: OAuthResult) => {
    console.log(`Successfully authenticated with ${provider}`);
    // Enable cloud features
  };

  const handleAuthError = (provider: string, error: string) => {
    console.error(`Authentication failed for ${provider}:`, error);
    // Show error message to user
  };

  return (
    <div>
      <h1>My App</h1>
      <TauriOAuthUI
        onAuthSuccess={handleAuthSuccess}
        onAuthError={handleAuthError}
        onStatusChange={(provider, isAuthenticated) => {
          console.log(`${provider} authentication status: ${isAuthenticated}`);
        }}
      />
    </div>
  );
}
```

### Manual OAuth Operations

```typescript
import { TauriOAuthManager } from '../services/oauth/tauri';

const oauthManager = new TauriOAuthManager();

// Check authentication status
const isAuthenticated = await oauthManager.isAuthenticated('google');

// Get valid tokens (automatically refreshes if needed)
const tokens = await oauthManager.getValidTokens('google');

// Refresh tokens manually
const refreshSuccess = await oauthManager.refreshTokens('google');

// Logout
await oauthManager.logout('google');

// Get status for all providers
const statusMap = await oauthManager.getAuthenticationStatus();
```

## Configuration

### OAuth Provider Configuration

```typescript
const config = {
  providers: {
    google: {
      clientId: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      scope: ['https://www.googleapis.com/auth/drive.file'],
      enabled: true
    },
    dropbox: {
      clientId: process.env.DROPBOX_OAUTH_CLIENT_ID!,
      scope: ['files.content.write'],
      enabled: true
    }
  },
  callbackServer: {
    host: '127.0.0.1',
    portRange: [8080, 8090],
    timeout: 300000, // 5 minutes
    maxRetries: 3
  },
  security: {
    stateExpiration: 600000, // 10 minutes
    pkceMethod: 'S256',
    tokenEncryption: true
  }
};
```

### Environment Variables

Create a `.env` file in your project root:

```env
GOOGLE_OAUTH_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
DROPBOX_OAUTH_CLIENT_ID=your-dropbox-client-id
OAUTH_CALLBACK_PORT=8080
```

## Tauri Configuration

### Cargo.toml Dependencies

```toml
[dependencies]
tauri = { version = "2", features = ["devtools"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
reqwest = { version = "0.11", features = ["json"] }
uuid = { version = "1.0", features = ["v4"] }
```

### Tauri Capabilities

Ensure your `src-tauri/capabilities/default.json` includes necessary permissions:

```json
{
  "permissions": [
    "core:default",
    "shell:default",
    "shell:allow-open",
    "dialog:default",
    "fs:default"
  ]
}
```

## Security Considerations

### PKCE Flow
- Uses Proof Key for Code Exchange (PKCE) to prevent authorization code interception
- Generates cryptographically secure code verifier and challenge

### State Parameter
- Implements CSRF protection through secure state parameter generation
- Validates state parameter on callback to prevent attacks

### Token Storage
- Encrypts tokens before storing using platform-specific secure storage
- Never logs or exposes tokens in plain text
- Automatically cleans up expired tokens

### Callback Server Security
- Binds only to localhost (127.0.0.1) to prevent external access
- Validates callback requests and rejects malformed inputs
- Automatically shuts down after receiving callback or timeout

## Error Handling

The system provides comprehensive error handling for common OAuth scenarios:

### Network Errors
- Automatic retry with exponential backoff
- Timeout handling with resource cleanup
- User-friendly error messages

### User Cancellation
- Detects when user cancels authentication in browser
- Graceful cleanup of resources
- Option to retry authentication

### Token Expiration
- Automatic token refresh when possible
- Prompts for re-authentication when refresh fails
- Preserves user data during re-authentication

### Configuration Errors
- Validates OAuth configuration on startup
- Provides specific error messages for missing or invalid configuration
- Guides user to fix configuration issues

## Events and Notifications

### Desktop Notifications
- Authentication started/completed notifications
- Token refresh notifications
- Error notifications with retry options
- Logout confirmation notifications

### Custom Events
- `oauth-retry-requested`: User wants to retry authentication
- `oauth-reauth-requested`: User needs to re-authenticate
- `oauth-config-requested`: User wants to check configuration

## Testing

### Unit Tests
```bash
npm test -- --testPathPattern=oauth
```

### Integration Tests
```bash
npm run test:integration -- oauth
```

### Manual Testing
1. Start the development server: `npm run tauri dev`
2. Click "Connect Google Drive" in the OAuth UI
3. Complete authentication in the opened browser
4. Verify tokens are stored and cloud features are enabled

## Troubleshooting

### Common Issues

**Browser doesn't open**
- Check if default browser is set
- Verify shell permissions in Tauri capabilities
- Try manual URL copying fallback

**Callback server fails to start**
- Check if ports 8080-8090 are available
- Verify firewall settings allow localhost connections
- Try different port range in configuration

**Token storage fails**
- Ensure platform-specific secure storage is available
- Check file system permissions
- Verify encryption dependencies are installed

**Authentication times out**
- Increase timeout in configuration
- Check network connectivity
- Verify OAuth provider endpoints are accessible

### Debug Mode

Enable debug logging:

```typescript
const oauthManager = createOAuthManager({
  // ... other config
  debug: true
});
```

### Logs Location

- **Windows**: `%APPDATA%/EasyEditor/logs/oauth.log`
- **macOS**: `~/Library/Application Support/EasyEditor/logs/oauth.log`
- **Linux**: `~/.config/EasyEditor/logs/oauth.log`

## Contributing

When contributing to the Tauri OAuth integration:

1. Follow the existing error handling patterns
2. Add comprehensive tests for new functionality
3. Update documentation for API changes
4. Test on all supported platforms (Windows, macOS, Linux)
5. Ensure security best practices are maintained

## License

This OAuth integration is part of EasyEditor and follows the same GNU AGPLv3 with Commons Clause license.