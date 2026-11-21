import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    fs: {
      allow: [
        '.',
        'c:/PROJECTS/VMS/super-market-scan',
        'C:/Users/Forgeindiaconnect/.gemini/antigravity/brain/e283c22d-059e-4cb2-a16e-319f4b39badf',
      ],
    },
    watch: {
      usePolling: true,
      interval: 100, // Polls every 100ms for instant hot-reload on Ctrl+S
    },
    hmr: {
      overlay: true,
    },
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
    },
  },
})
