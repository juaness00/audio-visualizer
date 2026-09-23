import { normalizeSettings, type VisualizerSettings } from './schema';
import { normalizePresets, type Preset } from './presets';

export const SYNC_KEY = 'visualizer.v1';
export const PENDING_KEY = 'visualizer.pending';
export const NEXT_SYNC_KEY = 'visualizer.nextSyncAt';
export const SYNC_ERROR_KEY = 'visualizer.syncError';
export interface StoredState {
  version: 1;
  settings: VisualizerSettings;
  presets: Preset[];
}

export function normalizeState(value: unknown): StoredState {
  const data = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    version: 1,
    settings: normalizeSettings(data.settings),
    presets: normalizePresets(data.presets),
  };
}

export async function readState(): Promise<StoredState> {
  const local = await chrome.storage.local.get(PENDING_KEY);
  if (local[PENDING_KEY]) return normalizeState(local[PENDING_KEY]);
  const synced = await chrome.storage.sync.get(SYNC_KEY);
  return normalizeState(synced[SYNC_KEY]);
}
