import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.mjs'],
    coverage: {
      include: ['src/**/*.mjs'],
      reporter: ['text', 'text-summary'],
    },
  },
});
