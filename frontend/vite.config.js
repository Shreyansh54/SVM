import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  build: {
    // Raise the warning threshold slightly (our biggest vendors are legitimate)
    chunkSizeWarningLimit: 600,

    rollupOptions: {
      output: {
        // Split heavyweight libraries into their own cacheable chunks.
        // Once cached by the browser they never download again on page refresh.
        manualChunks: {
          // React core — almost never changes
          'vendor-react':  ['react', 'react-dom', 'react-router-dom'],
          // Chart.js — the biggest single dependency
          'vendor-charts': ['chart.js', 'react-chartjs-2'],
          // UI helpers
          'vendor-ui':     ['react-hot-toast', 'react-icons'],
          // HTTP client
          'vendor-axios':  ['axios'],
        }
      }
    }
  },

  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      }
    }
  }
})
