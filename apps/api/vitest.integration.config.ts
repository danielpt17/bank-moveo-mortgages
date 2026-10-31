import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

/**
 * Integration tests boot the real Nest app against the Postgres + Redis from docker compose
 * (DATABASE_URL / REDIS_URL from .env). Run with `pnpm test:integration`; `pnpm test` stays
 * infrastructure-free.
 */
export default defineConfig({
  test: {
    include: ['test/integration/**/*.int.spec.ts'],
    environment: 'node',
    globals: false,
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
