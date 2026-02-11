/**
 * Tauri OAuth module exports
 * Provides Tauri-specific OAuth functionality for desktop environment
 */

export { TauriOAuthBridge, tauriOAuthBridge } from './TauriOAuthBridge';
export { TauriOAuthManager, createOAuthManager } from './TauriOAuthManager';
export { getSharedOAuthManager, resetSharedOAuthManager } from './SharedOAuthManager';
export { 
  TauriOAuthNotifications, 
  tauriOAuthNotifications,
  OAuthNotificationType
} from './TauriOAuthNotifications';

export type {
  TauriOAuthTokens,
  TauriOAuthResult,
  TauriOAuthStatus,
  TauriOAuthProvider,
  TauriOAuthAuthRequest,
  TauriOAuthLogoutRequest,
  OAuthFlowEvent,
  OAuthErrorEvent,
  OAuthFlowCompletionEvent
} from './TauriOAuthBridge';

export type {
  OAuthNotificationData
} from './TauriOAuthNotifications';