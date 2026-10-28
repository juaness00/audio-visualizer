import { test, expect } from './fixture.mjs';

/** Controlled capture boundary only: production reducer, views, loop and Web Audio still run.
 * This does NOT verify toolbar invocation, OS permissions, or real tab audio routing. */
async function controlledCapture(page) {
  await page.addInitScript(() => {
    const listeners = [];
    const originalConnect = chrome.runtime.connect.bind(chrome.runtime);
    chrome.runtime.connect = (...args) => {
      if (args[0]?.name !== 'audio-visualizer-tab-capture') return originalConnect(...args);
      return {
        onMessage: { addListener: (listener) => listeners.push(listener) },
        onDisconnect: { addListener() {} },
        postMessage() {},
        disconnect() {},
      };
    };
    const originalMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      if (!constraints.audio?.mandatory) return originalMedia(constraints);
      const context = new AudioContext();
      const destination = context.createMediaStreamDestination();
      window.__capture.context = context;
      window.__capture.stream = destination.stream;
      return destination.stream;
    };
    const originalBins = AnalyserNode.prototype.getByteFrequencyData;
    AnalyserNode.prototype.getByteFrequencyData = function (bins) {
      originalBins.call(this, bins);
      if (window.__capture.stream) {
        bins.fill(0);
        if (window.__capture.sound) bins[4] = 100;
      }
    };
    window.__capture = {
      sound: false,
      emit(message) {
        for (const listener of listeners) listener(message);
      },
    };
  });
  await page.reload();
  await expect(page.locator('#settings-fields')).toBeEnabled();
  // An actual page gesture permits AudioContext.resume; no autoplay bypass flag.
  await page.locator('#src-tab').click();
}

async function prepare(page) {
  await page.evaluate(() =>
    window.__capture.emit({ type: 'prepare', requestId: 'controlled-request' }),
  );
  await expect(page.locator('#loading')).toBeVisible();
}

async function start(page) {
  await prepare(page);
  await page.evaluate(() =>
    window.__capture.emit({
      type: 'start',
      requestId: 'controlled-request',
      streamId: 'controlled-stream',
    }),
  );
  await expect(page.locator('#now-playing')).toBeVisible();
}

test('controlled tab silence shows after hold and clears when sound resumes', async ({
  extension: { page },
}, testInfo) => {
  await controlledCapture(page);
  await start(page);
  await expect(page.locator('#silent')).toBeHidden();
  await expect(page.locator('#silent')).toBeVisible({ timeout: 7000 });
  const banner = await page.locator('#silent').boundingBox();
  const header = await page.locator('.topbar').boundingBox();
  expect(banner.y).toBeGreaterThanOrEqual(header.y + header.height);
  await page.screenshot({ path: testInfo.outputPath('silent.png') });
  await page.evaluate(() => {
    window.__capture.sound = true;
  });
  await expect(page.locator('#silent')).toBeHidden();
  await page.locator('#stop').click();
  await expect(page.locator('#empty')).toBeVisible();
});

test('controlled loading can stop and failure offers toolbar recovery', async ({
  extension: { page },
}) => {
  await controlledCapture(page);
  await prepare(page);
  await page.locator('#stop').click();
  await expect(page.locator('#empty')).toBeVisible();
  await prepare(page);
  await page.evaluate(() =>
    window.__capture.emit({ type: 'failed', requestId: 'controlled-request' }),
  );
  await expect(page.locator('#error-title')).toHaveText("Couldn't capture this tab");
  await expect(page.locator('#error-body')).toContainText('toolbar');
  await expect(page.locator('#error-action')).toBeHidden();
  await page.locator('#error-back').click();
  await expect(page.locator('#empty')).toBeVisible();
});

test('controlled replacement releases old tracks and starts a fresh silence hold', async ({
  extension: { page },
}) => {
  await controlledCapture(page);
  await start(page);
  await expect(page.locator('#silent')).toBeVisible({ timeout: 7000 });
  await page.evaluate(() => {
    window.__capture.previous = window.__capture.stream;
  });
  await start(page);
  expect(
    await page.evaluate(() =>
      window.__capture.previous.getTracks().every((track) => track.readyState === 'ended'),
    ),
  ).toBe(true);
  expect(await page.evaluate(() => window.__capture.previous !== window.__capture.stream)).toBe(
    true,
  );
  await expect(page.locator('#silent')).toBeHidden();
  await expect(page.locator('#silent')).toBeVisible({ timeout: 7000 });
});

test('controlled keyboard toggle stops an active tab without reacquiring it', async ({
  extension: { page },
}) => {
  await controlledCapture(page);
  await start(page);
  await page.evaluate(() =>
    window.__capture.emit({
      type: 'prepare',
      requestId: 'toggle-request',
      toggle: true,
    }),
  );
  await expect(page.locator('#empty')).toBeVisible();
  await expect(page.locator('#loading')).toBeHidden();
  expect(
    await page.evaluate(() =>
      window.__capture.stream.getTracks().every((track) => track.readyState === 'ended'),
    ),
  ).toBe(true);
});

test('controlled ended tab returns to source picker', async ({ extension: { page } }) => {
  await controlledCapture(page);
  await start(page);
  await page.evaluate(() =>
    window.__capture.stream.getAudioTracks()[0].dispatchEvent(new Event('ended')),
  );
  await expect(page.locator('#status')).toHaveText('The captured tab was closed.');
  await expect(page.locator('#empty')).toBeVisible();
  await expect(page.locator('#silent')).toBeHidden();
});

test('controlled microphone denial offers settings recovery', async ({ extension: { page } }) => {
  await page.addInitScript(() => {
    const query = navigator.permissions.query.bind(navigator.permissions);
    navigator.permissions.query = (descriptor) =>
      descriptor.name === 'microphone' ? Promise.resolve({ state: 'denied' }) : query(descriptor);
  });
  await page.reload();
  await page.locator('#src-mic').click();
  await expect(page.locator('#error-title')).toHaveText('Microphone access is blocked');
  await expect(page.locator('#error-action')).toHaveText('Open microphone settings');
  await expect(page.locator('#error-action')).toBeFocused();
  await page.locator('#error-back').click();
  await expect(page.locator('#empty')).toBeVisible();
});
