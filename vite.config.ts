import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '127.0.0.1',
    port: 5174,
    proxy: {
      '/limitless': {
        target: 'https://api.limitless.exchange',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/limitless/, ''),
        headers: {
          Origin: 'https://limitless.exchange',
          Referer: 'https://limitless.exchange/',
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
})
