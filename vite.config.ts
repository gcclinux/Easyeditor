import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { Buffer } from 'buffer';
import fs from 'fs';
import path from 'path';

const port = process.env.PORT ? parseInt(process.env.PORT) : 3024;

// Check if HTTPS certificates exist
const keyPath = path.resolve(__dirname, 'key.pem');
const certPath = path.resolve(__dirname, 'cert.pem');
const hasHttps = fs.existsSync(keyPath) && fs.existsSync(certPath);

// Disable HTTPS for Electron app mode (when running npm run app)
const isElectronMode = process.env.npm_lifecycle_event === 'app';
const useHttps = hasHttps && !isElectronMode;

if (isElectronMode) {
  console.log('🖥️  Electron mode - using HTTP for compatibility');
} else if (useHttps) {
  console.log('🔐 HTTPS certificates found - server will use HTTPS');
} else {
  console.log('ℹ️  No HTTPS certificates found - server will use HTTP');
  console.log('   Run ./setup-https.sh to enable HTTPS');
}

export default defineConfig({
  plugins: [
    react(),
    // Custom plugin to handle OAuth callback without URL rewriting
    {
      name: 'oauth-callback-handler',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          // Prevent URL rewriting for OAuth callback
          if (req.url?.includes('dropbox-oauth-callback.html') || 
              req.url?.includes('google-oauth-callback.html')) {
            // Don't let Vite rewrite these URLs
            return next();
          }
          next();
        });
      },
    },
  ],
  base: './',
  define: {
    global: 'globalThis',
  },
  resolve: {
    alias: {
      buffer: 'buffer',
      path: 'path-browserify',
      // Use browser-safe stubs for Node.js-only OAuth components
      './CallbackServer': './CallbackServer.browser',
      './BrowserLauncher': './BrowserLauncher.browser',
      // Explicit aliases for Tauri API to ensure resolution
      '@tauri-apps/api/event': path.resolve(__dirname, 'node_modules/@tauri-apps/api/event.js'),
      '@tauri-apps/api/core': path.resolve(__dirname, 'node_modules/@tauri-apps/api/core.js'),
      '@tauri-apps/api/notification': path.resolve(__dirname, 'src/stubs/tauri-notification.ts'),
      '@tauri-apps/plugin-shell': path.resolve(__dirname, 'node_modules/@tauri-apps/plugin-shell/dist-js/index.js'),
      '@tauri-apps/plugin-fs': path.resolve(__dirname, 'node_modules/@tauri-apps/plugin-fs/dist-js/index.js'),
      '@tauri-apps/plugin-dialog': path.resolve(__dirname, 'node_modules/@tauri-apps/plugin-dialog/dist-js/index.js'),
    },
  },
  ssr: {
    noExternal: ['isomorphic-git', 'fs', 'path'],
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
  },
  server: {
    port: port,
    strictPort: true,
    host: '0.0.0.0',
    // Enable HTTPS if certificates exist and not in Electron mode
    ...(useHttps && {
      https: {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath)
      }
    }),
    headers: {
      // Allow Google OAuth iframe and popup
      'X-Frame-Options': 'SAMEORIGIN',
      // IMPORTANT: Use 'unsafe-none' to allow OAuth popups to maintain
      // window.opener relationship after navigating to external OAuth providers
      'Cross-Origin-Opener-Policy': 'unsafe-none',
      'Cross-Origin-Embedder-Policy': 'unsafe-none',
      // Remove restrictive CSP in development
      'Content-Security-Policy': ''
    },
    watch: {
      ignored: [
        '**/build-prebuilt/**',
        '**/build-flathub/**',
        '**/build-*/**',
        '**/.flatpak-builder/**',
        '**/build/**',
        '**/stage/**',
        '**/snap/**',
        '**/parts/**',
        '**/prime/**'
      ]
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: '.',
    emptyOutDir: true,
    rollupOptions: {
      external: [
        'crypto',
        'http',
        'url',
        'os',
        'fs/promises',
        'child_process',
        'util'
      ],
    },
  }
});
