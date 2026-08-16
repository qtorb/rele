import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const apiPort = process.env.RELE_PORT || '8787'

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    // El frontend nunca habla con la API de Anthropic: solo con este backend local.
    proxy: {
      '/api': {
        target: `http://localhost:${apiPort}`,
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test-setup.ts',
  },
})
