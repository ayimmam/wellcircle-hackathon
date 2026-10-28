import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { sharedSourceGuard } from './shared-source.js';

const shared = fileURLToPath(new URL('../frontend/src', import.meta.url));
const webAuth = fileURLToPath(new URL('./src/context/AuthContext.jsx', import.meta.url));
export default defineConfig({
  plugins: [react(), sharedSourceGuard()],
  define: { 'import.meta.env.VITE_APP_SURFACE': JSON.stringify('web') },
  publicDir: '../frontend/public',
  resolve: {
    alias: [
      { find: '@shared', replacement: shared },
      // Shared screens resolve to the browser session, never Telegram initData.
      { find: /^(?:.*\/)?context\/AuthContext(?:\.jsx)?$/, replacement: webAuth },
    ],
    dedupe: ['react', 'react-dom', 'react-router-dom', 'react-i18next', 'i18next', 'motion', 'posthog-js'],
  },
  build: { rollupOptions: { output: { manualChunks(id) {
    if (!id.includes('node_modules')) return undefined;
    if (id.includes('react') || id.includes('scheduler')) return 'react-vendor';
    if (id.includes('posthog')) return 'analytics-vendor';
    if (id.includes('i18next')) return 'i18n-vendor';
    return undefined;
  } } } },
  server: { port: 5174, host: true, fs: { allow: ['..'] }, proxy: {
    '/api': { target: 'https://wellcircle-hackathon-backend.vercel.app', changeOrigin: true, secure: true },
  } },
});
