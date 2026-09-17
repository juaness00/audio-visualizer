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
