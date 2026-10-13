import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./tests/helpers/global-setup.js'],
    env: { NODE_ENV: 'test' },
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
