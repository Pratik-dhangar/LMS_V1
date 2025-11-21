import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy all requests starting with /api to your FastAPI backend
      '/api': {
        target: 'http://127.0.0.1:8000', // Replace with your FastAPI server address
        changeOrigin: true,
        secure: false, // Set to true for HTTPS backends
        // rewrite: (path) => path.replace(/^\/api/, '') // Optional: remove /api prefix
      },
    },
  },
})
