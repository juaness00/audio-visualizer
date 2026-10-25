import { test as base, expect, chromium } from '@playwright/test';
import { resolve } from 'node:path';

export const test = base.extend({
  // Playwright requires fixture dependency destructuring even with no dependencies.
  // eslint-disable-next-line no-empty-pattern
  extension: async ({}, use, testInfo) => {
    const extensionPath = resolve('.output/chrome-mv3');
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      headless: false,
      viewport: { width: 420, height: 900 },
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    });
    const errors = [];
    const observe = (page) => page.on('pageerror', (error) => errors.push(error.message));
    context.on('page', observe);
    for (const page of context.pages()) observe(page);
    let tracing = false;
    try {
      await context.tracing.start({ screenshots: true, snapshots: true });
      tracing = true;
      const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
      const id = new URL(worker.url()).host;
      const page = await context.newPage();
      await page.goto(`chrome-extension://${id}/sidepanel.html`);
      await expect(page.locator('#settings-fields')).toBeEnabled();
      await use({ context, page, id });
    } finally {
      try {
        for (const [index, page] of context.pages().entries()) {
          if (!page.isClosed())
            await page.screenshot({ path: testInfo.outputPath(`panel-${index}.png`) });
        }
        await testInfo.attach('page-errors', {
          body: JSON.stringify(errors, null, 2),
          contentType: 'application/json',
        });
        if (tracing) await context.tracing.stop({ path: testInfo.outputPath('trace.zip') });
      } finally {
        await context.close();
      }
    }
    expect(errors, 'uncaught page errors from the built extension').toEqual([]);
  },
});
export { expect };

export function toneFile() {
  const rate = 16000;
  const count = rate * 60;
  const buffer = Buffer.alloc(44 + count * 2);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(buffer.length - 8, 4);
  buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(rate, 24);
  buffer.writeUInt32LE(rate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(count * 2, 40);
  for (let i = 0; i < count; i++) {
    buffer.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * i) / rate) * 8192), 44 + i * 2);
  }
  return { name: 'demo-tone.wav', mimeType: 'audio/wav', buffer };
}

export async function pickFile(page, file = toneFile()) {
  const chooser = page.waitForEvent('filechooser');
  await page.locator('label[for="src-file"], #choose-file').click();
  await (await chooser).setFiles(file);
}
