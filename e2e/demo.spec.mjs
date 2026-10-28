import { test, expect, pickFile, toneFile } from './fixture.mjs';

test('file transport plays pauses seeks loops and stops', async ({ extension: { page } }) => {
  await pickFile(page);
  await expect(page.locator('#transport')).toBeVisible();
  await expect(page.locator('#now-playing')).toContainText('demo-tone.wav');
  await page.locator('#play-pause').click();
  await expect(page.locator('#play-pause')).toHaveText('Play');
  await page.locator('#seek').evaluate((element) => {
    element.value = '500';
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(page.locator('#time')).toContainText('0:30');
  await page.locator('#loop').check();
  await page.locator('#play-pause').click();
  await expect(page.locator('#play-pause')).toHaveText('Pause');
  await expect(page.locator('#loop')).toBeChecked();
  await page.locator('#stop').click();
  await expect(page.locator('#empty')).toBeVisible();
  await expect(page.locator('#transport')).toBeHidden();
  await pickFile(page);
  await expect(page.locator('#transport')).toBeVisible();
});

test('undecodable file recovery uses readable copy', async ({ extension: { page } }) => {
  await pickFile(page, {
    name: 'bad.wav',
    mimeType: 'audio/wav',
    buffer: Buffer.from('not audio'),
  });
  await expect(page.locator('#status')).toHaveText("Couldn't decode that file.");
  await expect(page.locator('#empty')).toBeVisible();
  await pickFile(page);
  await expect(page.locator('#transport')).toBeVisible();
});

test('all shipped modes render without restarting audio', async ({
  extension: { page },
}, testInfo) => {
  await pickFile(page);
  await expect(page.locator('#transport')).toBeVisible();
  await page.locator('summary').click();
  for (const mode of ['bars', 'particles', 'radial', 'waveform', 'awareness']) {
    await page.locator('#render-mode').selectOption(mode);
    await expect(page.locator('#render-mode')).toHaveValue(mode);
    await expect(page.locator('#play-pause')).toHaveText('Pause');
    await expect
      .poll(() =>
        page.locator('#stage').evaluate((canvas) => {
          if (!canvas.width || !canvas.height) return false;
          const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
          for (let i = 3; i < data.length; i += 4) if (data[i] > 0) return true;
          return false;
        }),
      )
      .toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`${mode}.png`) });
  }
});

test('settings restore after panel reopen', async ({ extension: { page, context, id } }) => {
  await page.locator('summary').click();
  await page.locator('#gain').evaluate((element) => {
    element.value = '2';
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.locator('#render-mode').selectOption('radial');
  await expect(page.locator('#settings-status')).not.toHaveText('Saving…');
  await page.close();
  const reopened = await context.newPage();
  await reopened.goto(`chrome-extension://${id}/sidepanel.html`);
  await expect(reopened.locator('#settings-fields')).toBeEnabled();
  await reopened.locator('summary').click();
  await expect(reopened.locator('#gain')).toHaveValue('2');
  await expect(reopened.locator('#render-mode')).toHaveValue('radial');
});

test('custom preset save load and delete', async ({ extension: { page } }) => {
  await page.locator('summary').click();
  await page.locator('#preset-name').fill('Demo');
  await page.locator('#preset-save').click();
  await expect(page.locator('#settings-status')).toHaveText('Preset saved.');
  const preset = await page.locator('#preset').inputValue();
  expect(preset).toMatch(/^user-/);
  await page.locator('#gain').evaluate((element) => {
    element.value = '3';
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.locator('#preset').selectOption(preset);
  await expect(page.locator('#gain')).toHaveValue('1');
  await page.locator('#preset-delete').click();
  await expect(page.locator('#preset option').filter({ hasText: /^Demo$/ })).toHaveCount(0);
});

test('file drop replaces playback without navigating', async ({ extension: { page } }) => {
  await pickFile(page);
  const url = page.url();
  await page.locator('.panel').evaluate((panel, bytes) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([new Uint8Array(bytes)], 'dropped.wav', { type: 'audio/wav' }));
    for (const type of ['dragenter', 'dragover', 'drop']) {
      panel.dispatchEvent(
        new DragEvent(type, { dataTransfer: transfer, bubbles: true, cancelable: true }),
      );
    }
  }, Array.from(toneFile().buffer));
  await expect(page.locator('#now-playing')).toHaveText('Playing: dropped.wav');
  await expect(page.locator('#transport')).toBeVisible();
  expect(page.url()).toBe(url);
});

for (const width of [360, 420]) {
  test(`settings and transport remain reachable at ${width}px`, async ({
    extension: { page },
  }, testInfo) => {
    await page.setViewportSize({ width, height: 640 });
    await pickFile(page);
    await expect(page.locator('#transport')).toBeVisible();
    await page.locator('summary').click();
    const stage = await page.locator('#stage').boundingBox();
    await testInfo.attach('stage-geometry', {
      body: JSON.stringify(stage),
      contentType: 'application/json',
    });
    expect(stage.height).toBeGreaterThanOrEqual(80);
    await page.locator('#preset-save').scrollIntoViewIfNeeded();
    const save = await page.locator('#preset-save').boundingBox();
    expect(save.y).toBeGreaterThanOrEqual(0);
    expect(save.y + save.height).toBeLessThanOrEqual(640);
    expect(
      await page.locator('#transport').evaluate((el) => el.scrollWidth - el.clientWidth),
    ).toBeLessThanOrEqual(1);
  });
}
