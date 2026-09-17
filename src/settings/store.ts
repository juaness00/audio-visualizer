import type { VisualizerSettings } from './schema';

/**
 * Persist settings in chrome.storage.sync so they follow the user across
 * devices and survive closing the panel.
 *
 * Watch the write quota: storage.sync allows ~120 writes/minute. A slider
 * drag emits far more than that, so debounce before calling saveSettings.
 */
export function loadSettings(): Promise<VisualizerSettings> {
  throw new Error(
    'TODO LOS-15: loadSettings from chrome.storage.sync, falling back to DEFAULT_SETTINGS',
  );
}

export function saveSettings(_settings: VisualizerSettings): Promise<void> {
  throw new Error('TODO LOS-15: saveSettings to chrome.storage.sync (debounced by the caller)');
}
