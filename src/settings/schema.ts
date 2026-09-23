export type ShapeMode = 'bars' | 'radial' | 'waveform' | 'particles';

/** How a bin picks its color from the palette. */
export type HueMode = 'frequency' | 'amplitude';

/** Ordered color stops, low → high. */
export type Palette = readonly string[];

export interface VisualizerSettings {
  /** AnalyserNode.fftSize. Power of two, 32–32768. Bins = fftSize / 2. */
  fftSize: number;
  /** AnalyserNode.smoothingTimeConstant. 0 = jittery, 0.95 = syrup. */
  smoothing: number;
  /** Multiplier on bin magnitudes before drawing. */
  gain: number;
  /** Hz window the renderers draw. */
  range: { low: number; high: number };
  mode: ShapeMode;
  palette: Palette;
  hueMode: HueMode;
}

export const DEFAULT_SETTINGS: VisualizerSettings = {
  fftSize: 2048,
  smoothing: 0.8,
  gain: 1,
  range: { low: 20, high: 16000 },
  mode: 'bars',
  palette: ['#f2994a', '#f2c94c', '#6fcf97', '#56ccf2', '#bb6bd9'],
  hueMode: 'frequency',
};

/** Treat stored data as untrusted: old versions and manual edits must be safe. */
export function normalizeSettings(value: unknown): VisualizerSettings {
  const data = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const number = (value: unknown, fallback: number, min: number, max: number) =>
    typeof value === 'number' && Number.isFinite(value)
      ? Math.min(max, Math.max(min, value))
      : fallback;
  const range =
    data.range && typeof data.range === 'object' ? (data.range as Record<string, unknown>) : {};
  const low = number(range.low, DEFAULT_SETTINGS.range.low, 0, 23999);
  const high = number(range.high, DEFAULT_SETTINGS.range.high, 1, 24000);
  const fft = number(data.fftSize, DEFAULT_SETTINGS.fftSize, 32, 32768);
  const modes: readonly unknown[] = ['bars', 'radial', 'waveform', 'particles'];
  const palette = Array.isArray(data.palette)
    ? data.palette
        .filter(
          (color): color is string => typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color),
        )
        .slice(0, 8)
    : [];
  return {
    fftSize: Number.isInteger(Math.log2(fft)) ? fft : DEFAULT_SETTINGS.fftSize,
    smoothing: number(data.smoothing, DEFAULT_SETTINGS.smoothing, 0, 0.95),
    gain: number(data.gain, DEFAULT_SETTINGS.gain, 0.1, 4),
    range: low < high ? { low, high } : { ...DEFAULT_SETTINGS.range },
    mode: modes.includes(data.mode) ? (data.mode as ShapeMode) : DEFAULT_SETTINGS.mode,
    palette: palette.length ? palette : [...DEFAULT_SETTINGS.palette],
    hueMode: data.hueMode === 'amplitude' ? 'amplitude' : 'frequency',
  };
}
