import type { VisualizerSettings } from './schema';
import { readState, type StoredState } from './storage';

export { BUILT_IN_PRESETS } from './presets';
export { readState as loadState } from './storage';

export type SettingsCommand =
  | { action: 'settings'; settings: VisualizerSettings }
  | { action: 'save-preset'; name: string; settings: VisualizerSettings }
  | { action: 'delete-preset'; id: string };

async function send(command: SettingsCommand): Promise<StoredState> {
  const result = await chrome.runtime.sendMessage({ type: 'visualizer-settings', command });
  if (!result?.ok) throw new Error(result?.error ?? 'Could not save settings. Please try again.');
  return result.state;
}

export async function loadSettings(): Promise<VisualizerSettings> {
  return (await readState()).settings;
}

/** Resolves when durably staged locally; the worker batches writes to sync. */
export async function saveSettings(settings: VisualizerSettings): Promise<void> {
  await send({ action: 'settings', settings });
}

export const savePreset = (name: string, settings: VisualizerSettings) =>
  send({ action: 'save-preset', name, settings });

export const deletePreset = (id: string) => send({ action: 'delete-preset', id });
