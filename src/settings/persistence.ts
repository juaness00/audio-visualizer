import { normalizeSettings } from './schema';
import { MAX_PRESETS } from './presets';
import { readState, SYNC_KEY, PENDING_KEY, NEXT_SYNC_KEY, SYNC_ERROR_KEY } from './storage';
import type { SettingsCommand } from './store';

export const DEBOUNCE_MS = 750;
export const MIN_SYNC_INTERVAL_MS = 2500;
const MAX_WAIT_MS = 5000;

/** One writer in the service worker serializes all panels and preset operations. */
export function createSettingsPersistence() {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let queue: Promise<unknown> = Promise.resolve();
  let firstPendingAt: number | undefined;
  let nextSyncAt = 0;
  function serial<T>(operation: () => Promise<T>): Promise<T> {
    const result = queue.then(operation);
    queue = result.catch(() => {});
    return result;
  }
  function schedule() {
    clearTimeout(timer);
    firstPendingAt ??= Date.now();
    const due = Math.max(
      nextSyncAt,
      Math.min(Date.now() + DEBOUNCE_MS, firstPendingAt + MAX_WAIT_MS),
    );
    timer = setTimeout(
      () => {
        void serial(flush).catch((error: unknown) => console.error('Settings sync failed', error));
      },
      Math.max(0, due - Date.now()),
    );
  }
  async function flush() {
    const local = await chrome.storage.local.get(PENDING_KEY);
    if (!local[PENDING_KEY]) return;
    try {
      // Persist the rate limit too, so worker restarts cannot cause write bursts.
      nextSyncAt = Date.now() + MIN_SYNC_INTERVAL_MS;
      await chrome.storage.local.set({ [NEXT_SYNC_KEY]: nextSyncAt });
      await chrome.storage.sync.set({ [SYNC_KEY]: local[PENDING_KEY] });
      await chrome.storage.local.remove([PENDING_KEY, SYNC_ERROR_KEY]);
      firstPendingAt = undefined;
    } catch (error) {
      nextSyncAt = Date.now() + 10000;
      schedule();
      await chrome.storage.local.set({
        [NEXT_SYNC_KEY]: nextSyncAt,
        [SYNC_ERROR_KEY]: 'Saved on this device. Cloud sync failed; retrying automatically.',
      });
      console.error('Settings sync will retry', error);
    }
  }
  return {
    restore() {
      return serial(async () => {
        const local = await chrome.storage.local.get([PENDING_KEY, NEXT_SYNC_KEY]);
        const savedTime = local[NEXT_SYNC_KEY];
        nextSyncAt =
          typeof savedTime === 'number' && Number.isFinite(savedTime)
            ? Math.min(savedTime, Date.now() + 10000)
            : 0;
        if (local[PENDING_KEY]) schedule();
      });
    },
    update(command: SettingsCommand) {
      return serial(async () => {
        const state = await readState();
        if (command.action === 'settings') {
          state.settings = normalizeSettings(command.settings);
        } else if (command.action === 'save-preset') {
          const name = command.name.trim();
          if (!name || name.length > 40)
            throw new Error('Use a preset name between 1 and 40 characters.');
          const existing = state.presets.find(
            (preset) => preset.name.toLowerCase() === name.toLowerCase(),
          );
          if (!existing && state.presets.length >= MAX_PRESETS)
            throw new Error('You can save up to 12 presets. Delete one first.');
          const preset = {
            id: existing?.id ?? 'user-' + crypto.randomUUID(),
            name,
            settings: normalizeSettings(command.settings),
          };
          if (existing) state.presets[state.presets.indexOf(existing)] = preset;
          else state.presets.push(preset);
        } else if (command.action === 'delete-preset') {
          state.presets = state.presets.filter((preset) => preset.id !== command.id);
        } else {
          throw new Error('Unknown settings operation.');
        }
        // Keep the single sync item below Chrome's 8 KB per-item limit.
        if (new TextEncoder().encode(SYNC_KEY + JSON.stringify(state)).length > 7500)
          throw new Error('Presets are too large. Shorten a name or delete a preset.');
        await chrome.storage.local.set({ [PENDING_KEY]: state });
        schedule();
        return state;
      });
    },
    dispose() {
      clearTimeout(timer);
    },
  };
}
