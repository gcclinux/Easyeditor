import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { loadTheme, getCurrentTheme, isCurrentThemeCustom } from './themeLoader';
import { Buffer } from 'buffer';
import LicenseManager from './premium/LicenseManager';
import { LanguageProvider } from './i18n/LanguageContext';

// Initialize the LicenseManager
LicenseManager.initialize();

// Environment Variables Check
// console.log('=== Environment Variables Check ===');
// console.log('VITE_GOOGLE_CLIENT_ID:', import.meta.env.VITE_GOOGLE_CLIENT_ID ? 'SET' : 'NOT SET');
// console.log('VITE_GOOGLE_CLIENT_APP:', import.meta.env.VITE_GOOGLE_CLIENT_APP ? 'SET' : 'NOT SET');
// console.log('VITE_GOOGLE_CLIENT_SECRET:', import.meta.env.VITE_GOOGLE_CLIENT_SECRET ? 'SET' : 'NOT SET');
// console.log('VITE_GOOGLE_API_KEY:', import.meta.env.VITE_GOOGLE_API_KEY ? 'SET' : 'NOT SET');
// console.log('===================================');

// Polyfill Buffer for browser environment
if (typeof window !== 'undefined') {
  (window as any).Buffer = Buffer;
  (window as any).global = window;
}

// ============================================
// THEME SELECTION
// ============================================
// Import ONE theme file to set the color scheme:
// - './themes/default.css'           (Original dark theme with purple/gray)
// - './themes/ocean-blue.css'        (Cool blue theme)
// - './themes/sunset-orange.css'     (Warm orange theme)
// - './themes/jade-green.css'        (Natural green theme)
// - './themes/dark-high-contrast.css' (High contrast black/white/bright)
// Users can also import custom themes via File → Select Theme → Import
// To create your own theme, see: THEMING.md and CUSTOM-THEMES.md
// ============================================
// import './themes/default.css';

import './index.css';

// Load saved theme on startup
const savedTheme = getCurrentTheme();
const isCustom = isCurrentThemeCustom();
if (savedTheme !== 'default' || isCustom) {
  loadTheme(savedTheme, isCustom);
} else {
  // Set data attribute and load the default theme file
  document.body.setAttribute('data-theme', 'default');
  loadTheme('default');
}

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(
  <React.StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </React.StrictMode>
);
