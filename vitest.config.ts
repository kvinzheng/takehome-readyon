import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';

const dirname =
  typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.join(dirname, 'src') },
  },
  test: {
    projects: [
      // ── Unit / component tests (jsdom) ────────────────────────────────────
      {
        plugins: [react()],
        resolve: {
          alias: { '@': path.join(dirname, 'src') },
        },
        test: {
          name: 'unit',
          environment: 'jsdom',
          globals: true,
          setupFiles: ['./src/tests/setup.ts'],
          include: ['src/tests/**/*.test.{ts,tsx}'],
        },
      },
      // ── Storybook interaction tests (browser / Playwright) ─────────────
      {
        extends: true,
        plugins: [
          storybookTest({ configDir: path.join(dirname, '.storybook') }),
        ],
        test: {
          name: 'storybook',
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});
