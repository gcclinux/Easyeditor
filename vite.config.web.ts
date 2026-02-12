import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

// Read package.json version
const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'));

// Web-only build configuration for GitHub Pages deployment
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  base: '/EasyEditor/webapp/',
  server: {
    port: 3025,
    strictPort: false,
    host: '0.0.0.0'
  },
  build: {
    outDir: 'dist-web',
    assetsDir: 'assets',
    emptyOutDir: true,
    // Optimize for web deployment
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'markdown-vendor': ['react-markdown', 'remark-gfm', 'rehype-raw'],
          'diagram-vendor': ['mermaid', 'nomnoml'],
        }
      }
    }
  }
});
