/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
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
