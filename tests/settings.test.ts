import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '@/settings/schema';
import { hzToBin } from '@/render/renderer';

describe('DEFAULT_SETTINGS', () => {
  it('uses a power-of-two fftSize within AnalyserNode limits', () => {
    const { fftSize } = DEFAULT_SETTINGS;
    expect(fftSize).toBeGreaterThanOrEqual(32);
    expect(fftSize).toBeLessThanOrEqual(32768);
    expect(Math.log2(fftSize) % 1).toBe(0);
  });

  it('keeps smoothing inside AnalyserNode range [0, 1)', () => {
    expect(DEFAULT_SETTINGS.smoothing).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_SETTINGS.smoothing).toBeLessThan(1);
  });

  it('has an ascending frequency range', () => {
    expect(DEFAULT_SETTINGS.range.low).toBeLessThan(DEFAULT_SETTINGS.range.high);
  });
});

describe('hzToBin', () => {
  it('maps Nyquist to the last bin', () => {
    expect(hzToBin(24000, 48000, 2048)).toBe(1024);
  });

  it('maps 0 Hz to bin 0', () => {
    expect(hzToBin(0, 48000, 2048)).toBe(0);
  });
});
