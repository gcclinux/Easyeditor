import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { Buffer } from 'buffer';
import fs from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';

// Read package.json to get version
const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'));

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
  console.log('   Run ./scripts/setup-https.sh to enable HTTPS');
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
    // CORS proxy for Ollama — forwards /api/ollama-proxy/* to the target
    // specified in the X-Proxy-Target header
    {
      name: 'ollama-cors-proxy',
      configureServer(server) {
        server.middlewares.use('/api/ollama-proxy', (req, res) => {
          const target = req.headers['x-proxy-target'] as string | undefined;
          if (!target) {
            res.writeHead(400, { 'Content-Type': 'text/plain' });
            res.end('Missing X-Proxy-Target header');
            return;
          }

          // Build the final URL: target host + the path after /api/ollama-proxy
          const stripped = (req.url || '').replace(/^\/api\/ollama-proxy/, '') || '/';
          const dest = new URL(stripped, target);

          const mod = dest.protocol === 'https:' ? https : http;
          const fwdHeaders: Record<string, string> = {};
          for (const [k, v] of Object.entries(req.headers)) {
            if (k === 'host' || k === 'x-proxy-target') continue;
            if (v) fwdHeaders[k] = Array.isArray(v) ? v.join(', ') : v;
          }
          fwdHeaders['host'] = dest.host;

          const proxyReq = mod.request(
            dest.href,
            { method: req.method, headers: fwdHeaders },
            (proxyRes) => {
              res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
              proxyRes.pipe(res, { end: true });
            },
          );
          proxyReq.on('error', (err) => {
            console.error('[ollama-proxy] error:', err.message);
            if (!res.headersSent) {
              res.writeHead(502, { 'Content-Type': 'text/plain' });
            }
            res.end(`Proxy error: ${err.message}`);
          });
          req.pipe(proxyReq, { end: true });
        });
      },
    },
  ],
  base: './',
  define: {
    global: 'globalThis',
    __APP_VERSION__: JSON.stringify(pkg.version),
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
    proxy: {
      '/api/gateway-proxy': {
        target: 'https://easyai-gateway-846627640525.us-central1.run.app',
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/api\/gateway-proxy/, ''),
      },
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
