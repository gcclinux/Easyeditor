/**
 * EasyObservability — Lightweight anonymous usage analytics
 *
 * Writes anonymous, aggregate-friendly events to Firebase Realtime Database.
 * No user IDs, no PII, no document content — just feature usage signals.
 *
 * All tracking is gated behind:
 *   1. Feature flag (ANALYTICS in config/features.ts)
 *   2. User consent (localStorage opt-in)
 *
 * Usage:
 *   import { initAnalytics, trackFeature, trackError } from './services/analytics';
 *   initAnalytics();  // call once on app load
 *   trackFeature('easyai', 'use', { agent: 'Gemini' });
 *   trackError('cloud', 'OAuth token expired');
 */

import { ref, push, set } from 'firebase/database';
import { database } from './firebase';
import { isFeatureEnabled } from '../config/features';
import { isTauriEnvironment } from '../utils/environment';
import { getRunningVersion } from '../utils/version';
import LicenseManager from '../premium/LicenseManager';

// ─── Types ───────────────────────────────────────────────────────────────────

export type FeatureCategory =
  | 'easyai'
  | 'easyteam'
  | 'easynotes'
  | 'git'
  | 'cloud_sync'
  | 'export'
  | 'import'
  | 'diagram'
  | 'template'
  | 'theme'
  | 'formatting'
  | 'table'
  | 'settings';

export type FeatureAction = 'open' | 'use' | 'close' | 'error';

export type ErrorCategory =
  | 'ai'
  | 'cloud'
  | 'git'
  | 'export'
  | 'import'
  | 'license'
  | 'general';

interface SessionRecord {
  timestamp: number;
  platform: 'web' | 'tauri';
  tier: 'free' | 'premium' | 'premiumPlus';
  version: string;
  duration?: number;
}

interface FeatureRecord {
  timestamp: number;
  feature: FeatureCategory;
  action: FeatureAction;
  meta?: Record<string, string | number | boolean>;
}

interface ErrorRecord {
  timestamp: number;
  category: ErrorCategory;
  message: string;
  platform: 'web' | 'tauri';
}

// ─── State ───────────────────────────────────────────────────────────────────

const CONSENT_KEY = 'easyeditor-analytics-consent';
let sessionStartTime: number | null = null;
let sessionRef: ReturnType<typeof ref> | null = null;
let initialized = false;

// ─── Consent ─────────────────────────────────────────────────────────────────

/**
 * Check if the user has opted in to analytics.
 * Defaults to false (opt-in model) — no data is collected until the user
 * explicitly enables analytics via the consent prompt or settings.
 */
export function hasAnalyticsConsent(): boolean {
  return localStorage.getItem(CONSENT_KEY) === 'true';
}

/**
 * Check if the user has already been asked about analytics consent.
 */
export function hasBeenAskedConsent(): boolean {
  return localStorage.getItem(CONSENT_KEY) !== null;
}

/**
 * Set the user's analytics consent preference.
 */
export function setAnalyticsConsent(enabled: boolean): void {
  localStorage.setItem(CONSENT_KEY, enabled ? 'true' : 'false');
  if (enabled && !initialized) {
    initAnalytics();
  }
}

// ─── Guard ───────────────────────────────────────────────────────────────────

/**
 * Returns true only if both the feature flag and user consent are active.
 */
function isAnalyticsActive(): boolean {
  return isFeatureEnabled('ANALYTICS') && hasAnalyticsConsent();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getPlatform(): 'web' | 'tauri' {
  return isTauriEnvironment() ? 'tauri' : 'web';
}

function getTier(): 'free' | 'premium' | 'premiumPlus' {
  if (!LicenseManager.hasActiveLicense()) return 'free';
  return LicenseManager.getType() === 'PremiumPlus' ? 'premiumPlus' : 'premium';
}

// ─── Session Tracking ────────────────────────────────────────────────────────

/**
 * Initialize analytics — call once on app startup.
 * Records a session start and sets up beforeunload to write duration.
 */
export async function initAnalytics(): Promise<void> {
  if (!isAnalyticsActive()) return;
  if (initialized) return;

  initialized = true;
  sessionStartTime = Date.now();

  const version = await getRunningVersion();
  const platform = getPlatform();
  const tier = getTier();

  const session: SessionRecord = {
    timestamp: sessionStartTime,
    platform,
    tier,
    version,
  };

  try {
    const sessionsRef = ref(database, 'analytics/sessions');
    const newSessionRef = push(sessionsRef);
    sessionRef = newSessionRef;
    await set(newSessionRef, session);
  } catch (err) {
    console.warn('[Analytics] Failed to write session start:', err);
  }

  // Write duration on page unload
  window.addEventListener('beforeunload', writeDuration);
  // Also handle visibilitychange for mobile browsers that don't fire beforeunload
  document.addEventListener('visibilitychange', handleVisibilityChange);
}

function handleVisibilityChange(): void {
  if (document.visibilityState === 'hidden') {
    writeDuration();
  }
}

function writeDuration(): void {
  if (!sessionRef || !sessionStartTime) return;

  const duration = Date.now() - sessionStartTime;

  // Use sendBeacon for reliability on page unload
  // Fall back to a direct set if sendBeacon isn't available
  try {
    // Firebase RTDB REST API via sendBeacon for guaranteed delivery
    const dbUrl = import.meta.env.VITE_FIREBASE_DATABASE_URL || 'https://easyeditor-premium-default-rtdb.firebaseio.com';
    const sessionKey = sessionRef.key;
    const url = `${dbUrl}/analytics/sessions/${sessionKey}/duration.json`;
    const blob = new Blob([JSON.stringify(duration)], { type: 'application/json' });
    navigator.sendBeacon(url, blob);
  } catch (err) {
    // Silent fail — best effort on unload
  }
}

// ─── Feature Tracking ────────────────────────────────────────────────────────

/**
 * Track a feature usage event.
 *
 * @param feature - The feature category (e.g., 'easyai', 'git', 'export')
 * @param action - What happened (e.g., 'open', 'use', 'error')
 * @param meta - Optional metadata (e.g., { agent: 'Gemini', provider: 'gdrive' })
 */
export function trackFeature(
  feature: FeatureCategory,
  action: FeatureAction,
  meta?: Record<string, string | number | boolean>
): void {
  if (!isAnalyticsActive()) return;

  const record: FeatureRecord = {
    timestamp: Date.now(),
    feature,
    action,
  };

  if (meta && Object.keys(meta).length > 0) {
    record.meta = meta;
  }

  try {
    const featuresRef = ref(database, 'analytics/features');
    const newRef = push(featuresRef);
    set(newRef, record).catch(() => {
      // Silent fail — analytics should never break the app
    });
  } catch (err) {
    // Silent fail
  }
}

// ─── Error Tracking ──────────────────────────────────────────────────────────

/**
 * Track an error event.
 *
 * @param category - Error source category (e.g., 'ai', 'cloud', 'git')
 * @param message - Brief error description (no PII, no stack traces)
 */
export function trackError(category: ErrorCategory, message: string): void {
  if (!isAnalyticsActive()) return;

  // Truncate message to prevent accidental data leaks in long error strings
  const safeMessage = message.slice(0, 200);

  const record: ErrorRecord = {
    timestamp: Date.now(),
    category,
    message: safeMessage,
    platform: getPlatform(),
  };

  try {
    const errorsRef = ref(database, 'analytics/errors');
    const newRef = push(errorsRef);
    set(newRef, record).catch(() => {
      // Silent fail
    });
  } catch (err) {
    // Silent fail
  }
}
