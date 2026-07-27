import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/auth': 'http://127.0.0.1:8000',
      '/users': 'http://127.0.0.1:8000',
      '/drivers': 'http://127.0.0.1:8000',
      '/trips': 'http://127.0.0.1:8000',
      '/vehicles': 'http://127.0.0.1:8000',
      '/fuel': 'http://127.0.0.1:8000',
      '/pricing': 'http://127.0.0.1:8000',
      '/expenses': 'http://127.0.0.1:8000',
      '/finance': 'http://127.0.0.1:8000',
      '/esg': 'http://127.0.0.1:8000',
      '/matchmaking': 'http://127.0.0.1:8000',
      '/pod': 'http://127.0.0.1:8000',
      '/invoices': 'http://127.0.0.1:8000',
      '/fuel-theft': 'http://127.0.0.1:8000',
      '/razorpay': 'http://127.0.0.1:8000',
      '/ws': {
        target: 'ws://127.0.0.1:8000',
        ws: true
      }
    }
  }
})
