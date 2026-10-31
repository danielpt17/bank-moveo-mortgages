/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Local dev: same-origin /api so no CORS and no env needed.
      '/api': { target: process.env.API_PROXY_TARGET ?? 'http://localhost:3001', changeOrigin: true },
    },
  },
  build: { sourcemap: true },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
});
