import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// https://vitest.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
    // Fail the suite when any test or suite is marked with .only, even locally.
    // This prevents a focused test from accidentally masking broken tests in
    // a pre-push gate. (Vitest default is `!process.env.CI`, which lets .only
    // pass silently in local runs.)
    allowOnly: false,
    include: [
      'src/**/*.{test,spec}.{ts,tsx}',
      'netlify/**/*.{test,spec}.ts',
      'scripts/**/*.{test,spec}.{mjs,ts}',
    ],
  },
});