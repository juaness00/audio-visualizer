import { DEFAULT_SETTINGS, normalizeSettings, type VisualizerSettings } from './schema';

export interface Preset {
  id: string;
  name: string;
  settings: VisualizerSettings;
}

export const MAX_PRESETS = 12;
export const BUILT_IN_PRESETS: readonly Preset[] = [
  { id: 'builtin-spectrum', name: 'Spectrum', settings: normalizeSettings(DEFAULT_SETTINGS) },
  {
    id: 'builtin-bass',
    name: 'Bass glow',
    settings: normalizeSettings({
      ...DEFAULT_SETTINGS,
      gain: 1.6,
      smoothing: 0.85,
      range: { low: 20, high: 500 },
      palette: ['#bb6bd9', '#f2994a', '#f2c94c'],
    }),
  },
  {
    id: 'builtin-voice',
    name: 'Voice',
    settings: normalizeSettings({
      ...DEFAULT_SETTINGS,
      gain: 1.4,
      smoothing: 0.65,
      range: { low: 100, high: 4000 },
      palette: ['#56ccf2', '#6fcf97', '#ffffff'],
    }),
  },
  {
    id: 'builtin-electric',
    name: 'Electric',
    settings: normalizeSettings({
      ...DEFAULT_SETTINGS,
      gain: 1.3,
      smoothing: 0.35,
      hueMode: 'amplitude',
      palette: ['#3867ff', '#bb6bd9', '#ff4081'],
    }),
  },
];

export function normalizePresets(value: unknown): Preset[] {
  if (!Array.isArray(value)) return [];
  const result: Preset[] = [];
  for (const item of value) {
    if (
      !item ||
      typeof item !== 'object' ||
      typeof item.id !== 'string' ||
      !item.id.startsWith('user-') ||
      item.id.length > 80 ||
      typeof item.name !== 'string' ||
      !item.name.trim() ||
      result.some((preset) => preset.id === item.id)
    )
      continue;
    result.push({
      id: item.id,
      name: item.name.trim().slice(0, 40),
      settings: normalizeSettings(item.settings),
    });
    if (result.length === MAX_PRESETS) break;
  }
  return result;
}
