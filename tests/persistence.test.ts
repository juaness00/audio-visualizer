import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createSettingsPersistence,
  DEBOUNCE_MS,
  MIN_SYNC_INTERVAL_MS,
} from '@/settings/persistence';
import { DEFAULT_SETTINGS, normalizeSettings } from '@/settings/schema';
import { BUILT_IN_PRESETS } from '@/settings/presets';
import { loadSettings } from '@/settings/store';
import { PENDING_KEY, SYNC_KEY, SYNC_ERROR_KEY, readState } from '@/settings/storage';

function storageArea() {
  const data: Record<string, unknown> = {};
  return {
    data,
    get: vi.fn(async (keys: string | string[]) =>
      Object.fromEntries(
        (typeof keys === 'string' ? [keys] : keys).map((key) => [key, structuredClone(data[key])]),
      ),
    ),
    set: vi.fn(async (items: Record<string, unknown>) => {
      Object.assign(data, structuredClone(items));
    }),
    remove: vi.fn(async (keys: string | string[]) => {
      for (const key of typeof keys === 'string' ? [keys] : keys) delete data[key];
    }),
  };
}

let local: ReturnType<typeof storageArea>;
let sync: ReturnType<typeof storageArea>;
let worker: ReturnType<typeof createSettingsPersistence>;
beforeEach(async () => {
  vi.useFakeTimers();
  local = storageArea();
  sync = storageArea();
  vi.stubGlobal('chrome', { storage: { local, sync } });
  worker = createSettingsPersistence();
  await worker.restore();
});
afterEach(() => {
  worker.dispose();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
const changeGain = (gain: number) =>
  worker.update({ action: 'settings', settings: { ...DEFAULT_SETTINGS, gain } });

describe('settings persistence', () => {
  it('loads fresh defaults on first run without writing sync', async () => {
    const first = await loadSettings();
    first.range.low = 200;
    expect((await loadSettings()).range.low).toBe(20);
    expect(sync.set).not.toHaveBeenCalled();
    expect(BUILT_IN_PRESETS).toHaveLength(4);
    for (const preset of BUILT_IN_PRESETS)
      expect(normalizeSettings(preset.settings)).toEqual(preset.settings);
  });

  it('coalesces a slider drag and snapshots the final settings', async () => {
    for (let i = 0; i < 200; i++) {
      await changeGain(1 + i / 100);
      await vi.advanceTimersByTimeAsync(10);
    }
    expect(sync.set).not.toHaveBeenCalled();
    expect((await loadSettings()).gain).toBe(2.99);
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    expect(sync.set).toHaveBeenCalledTimes(1);
    expect(local.data[PENDING_KEY]).toBeUndefined();
    expect((await readState()).settings.gain).toBe(2.99);
  });

  it('rate limits repeated drags including preset writes', async () => {
    await changeGain(2);
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    await worker.update({ action: 'save-preset', name: 'Test', settings: DEFAULT_SETTINGS });
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    expect(sync.set).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(MIN_SYNC_INTERVAL_MS - DEBOUNCE_MS);
    expect(sync.set).toHaveBeenCalledTimes(2);
    expect((await readState()).presets[0]?.name).toBe('Test');
  });

  it('recovers the last edit after the worker stops before debounce finishes', async () => {
    await changeGain(3);
    worker.dispose();
    worker = createSettingsPersistence();
    await worker.restore();
    expect((await loadSettings()).gain).toBe(3);
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    expect(sync.set).toHaveBeenCalledTimes(1);
    // A new worker and panel read from sync after the pending draft is removed.
    worker.dispose();
    worker = createSettingsPersistence();
    await worker.restore();
    expect((await loadSettings()).gain).toBe(3);
  });

  it('retains pending changes on sync failure and retries', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    sync.set.mockRejectedValueOnce(new Error('Quota exceeded'));
    await changeGain(2);
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    expect(local.data[PENDING_KEY]).toBeDefined();
    expect(local.data[SYNC_ERROR_KEY]).toBeDefined();
    expect((await loadSettings()).gain).toBe(2);
    await vi.advanceTimersByTimeAsync(10000);
    expect(sync.set).toHaveBeenCalledTimes(2);
    expect(local.data[PENDING_KEY]).toBeUndefined();
    expect(local.data[SYNC_ERROR_KEY]).toBeUndefined();
  });

  it('serializes concurrent operations without losing settings or presets', async () => {
    await Promise.all([
      changeGain(2),
      worker.update({ action: 'save-preset', name: 'A', settings: DEFAULT_SETTINGS }),
      worker.update({ action: 'save-preset', name: 'B', settings: DEFAULT_SETTINGS }),
    ]);
    const state = await readState();
    expect(state.settings.gain).toBe(2);
    expect(state.presets.map((preset) => preset.name)).toEqual(['A', 'B']);
  });

  it('saves, replaces, loads and deletes custom presets, preserving built-ins', async () => {
    const original = await worker.update({
      action: 'save-preset',
      name: '  My music  ',
      settings: DEFAULT_SETTINGS,
    });
    const replacement = await worker.update({
      action: 'save-preset',
      name: 'my music',
      settings: { ...DEFAULT_SETTINGS, gain: 2 },
    });
    expect(replacement.presets).toHaveLength(1);
    expect(replacement.presets[0]?.id).toBe(original.presets[0]?.id);
    await worker.update({ action: 'settings', settings: replacement.presets[0]!.settings });
    expect((await loadSettings()).gain).toBe(2);
    await worker.update({ action: 'delete-preset', id: replacement.presets[0]!.id });
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    expect((await readState()).presets).toEqual([]);
    expect((await readState()).settings.gain).toBe(2);
    expect(BUILT_IN_PRESETS).toHaveLength(4);
  });

  it('bounds custom presets to fit the sync item budget', async () => {
    await expect(
      worker.update({ action: 'save-preset', name: ' ', settings: DEFAULT_SETTINGS }),
    ).rejects.toThrow('name');
    for (let i = 0; i < 12; i++) {
      await worker.update({
        action: 'save-preset',
        name: 'Preset ' + i,
        settings: DEFAULT_SETTINGS,
      });
    }
    await expect(
      worker.update({ action: 'save-preset', name: 'Too many', settings: DEFAULT_SETTINGS }),
    ).rejects.toThrow('12');
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    expect(
      new TextEncoder().encode(SYNC_KEY + JSON.stringify(sync.data[SYNC_KEY])).length,
    ).toBeLessThan(8192);
  });

  it('rejects failed local persistence rather than reporting a successful save', async () => {
    local.set.mockRejectedValueOnce(new Error('Disk unavailable'));
    await expect(changeGain(2)).rejects.toThrow('Disk unavailable');
    expect(sync.set).not.toHaveBeenCalled();
    await changeGain(3);
    expect((await loadSettings()).gain).toBe(3);
  });

  it('repairs malformed and partial data without using invalid audio parameters', async () => {
    sync.data[SYNC_KEY] = {
      settings: {
        fftSize: 123,
        smoothing: 5,
        gain: 'bad',
        range: { low: 900, high: 200 },
        palette: ['bad'],
        mode: 'unknown',
      },
      presets: [null, { id: 'builtin-fake', name: 'Bad' }],
    };
    const state = await readState();
    expect(state.settings).toEqual({ ...DEFAULT_SETTINGS, smoothing: 0.95 });
    expect(state.presets).toEqual([]);
  });
});
