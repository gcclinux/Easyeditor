/**
 * Firebase initialization for EasyTeam (Ephemeral Chat)
 *
 * Initializes the Firebase app and exports the Realtime Database instance.
 * Uses the easyeditor-premium Firebase project.
 *
 * Configuration is loaded from Vite environment variables when available,
 * with sensible defaults for the easyeditor-premium project.
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'easyeditor-premium',
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || 'https://easyeditor-premium-default-rtdb.firebaseio.com',
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

// Avoid re-initializing if already done (e.g., during HMR)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

/** Firebase Realtime Database instance for EasyTeam */
export const database = getDatabase(app);

export default app;
