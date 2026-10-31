import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts'],
    environment: 'node',
    globals: false,
  },
  plugins: [
    // SWC keeps Nest's decorator metadata working under Vitest.
    swc.vite({ module: { type: 'es6' } }),
  ],
});
