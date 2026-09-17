import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

// WxtVitest wires up WXT's path aliases and a fake `chrome` API so tests
// that touch chrome.storage etc. don't need a browser.
export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
