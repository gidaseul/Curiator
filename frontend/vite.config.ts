import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/generate': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/generate-text': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/generate-audio': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/generate-audio-clone': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/audio': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
