import { describe, expect, it } from 'vitest';
import { bandEnergies } from '@/render/modes/particles';
import { hzToBin } from '@/render/renderer';

const SAMPLE_RATE = 48000;
const FFT_SIZE = 2048;
const RANGE = { low: 20, high: 16000 };

/** 1024 empty bins with a loud peak at the given frequency. */
function toneAt(hz: number): Uint8Array {
  const bins = new Uint8Array(FFT_SIZE / 2);
  const center = hzToBin(hz, SAMPLE_RATE, FFT_SIZE);
  for (let i = center - 1; i <= center + 1; i++) bins[i] = 255;
  return bins;
}

function energiesFor(bins: Uint8Array, range = RANGE, gain = 1): number[] {
  const out = new Float32Array(4);
  bandEnergies(bins, SAMPLE_RATE, FFT_SIZE, range, gain, out);
  return Array.from(out);
}

function loudestBand(values: number[]): number {
  return values.indexOf(Math.max(...values));
}

describe('bandEnergies', () => {
  it('is all zero for silence', () => {
    expect(energiesFor(new Uint8Array(FFT_SIZE / 2))).toEqual([0, 0, 0, 0]);
  });

  it('puts a bass tone in the first band', () => {
    expect(loudestBand(energiesFor(toneAt(60)))).toBe(0);
  });

  it('puts an 8 kHz tone in the last band, not a middle one', () => {
    // A linear split over 0 to 24 kHz would put 8 kHz in band 1 of 4.
    expect(loudestBand(energiesFor(toneAt(8000)))).toBe(3);
  });

  it('spreads common musical pitches across every band', () => {
    const bands = [60, 300, 1500, 8000].map((hz) => loudestBand(energiesFor(toneAt(hz))));
    expect(bands).toEqual([0, 1, 2, 3]);
  });

  it('ignores energy above settings.range', () => {
    expect(energiesFor(toneAt(20000))).toEqual([0, 0, 0, 0]);
  });

  it('clamps to 1 when gain pushes past full scale', () => {
    expect(Math.max(...energiesFor(toneAt(60), RANGE, 50))).toBe(1);
  });
});
