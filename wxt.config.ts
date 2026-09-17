import { defineConfig } from 'wxt';

// https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  // Explicit imports only: `import { defineBackground } from '#imports'`.
  // Keeps every file readable without knowing WXT's auto-import list.
  imports: false,
  manifest: {
    name: 'Audio Visualizer',
    description: 'Real-time visuals for tab, mic, or file audio, in the side panel.',
    // chrome.sidePanel needs 114; tabCapture stream ids usable across
    // extension contexts need 116.
    minimum_chrome_version: '116',
    // `sidePanel` is added automatically because a sidepanel entrypoint exists.
    permissions: ['tabCapture', 'activeTab', 'storage'],
    action: { default_title: 'Open Audio Visualizer' },
  },
});
