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
          if (id.includes('i18next')) return 'i18n-vendor';
          return undefined;
        },
      },
    },
  },
  server: {
    port: 5174,
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
