import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
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
