/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('react') || id.includes('scheduler')) return 'react-vendor';
          if (id.includes('posthog')) return 'analytics-vendor';
          if (id.includes('i18next')) return 'i18n-vendor';
          // Let Rollup place smaller dependencies with their consumers.
          // Forcing every remaining package into one shared vendor chunk
          // creates a vendor <-> React circular chunk.
          return undefined;
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: './src/test/setup.js',
    css: false,
    // Restore spies/mocks between tests so api/client mocks don't bleed across files.
    restoreMocks: true,
    // Run the api client in mock mode: screens render against seed data with no
    // real network, so route/navigation tests are fast and deterministic.
    env: { VITE_USE_MOCK: 'true' },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'https://wellcircle-hackathon-backend.vercel.app',
        changeOrigin: true,
        secure: true,
      },
    },
  },
})
