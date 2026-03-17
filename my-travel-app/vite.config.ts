import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // '/api'로 시작하는 요청은 파이썬 서버(5001)로 보낸다
      '/api': {
        target: 'https://holiday-hub-backend.onrender.com/api',
        changeOrigin: true,
        secure: false,
      },
      // '/find-hotels' 같은 다른 API들도 파이썬으로 보낸다
      '/find-hotels': {
        target: 'https://holiday-hub-backend.onrender.com/find-hotels',
        changeOrigin: true,
      },
      '/create-plan': {
        target: 'https://holiday-hub-backend.onrender.com/create-plan',
        changeOrigin: true,
      },
    }
  }
})