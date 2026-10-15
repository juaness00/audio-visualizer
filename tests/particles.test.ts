import { describe, expect, it } from 'vitest';
import { bandEdges, bandEnergies, particles } from '@/render/modes/particles';
import type { RenderFrame } from '@/render/renderer';
import { hzToBin } from '@/render/renderer';
import { DEFAULT_SETTINGS } from '@/settings/schema';

const SAMPLE_RATE = 48000;
const FFT_SIZE = 2048;
const BIN_COUNT = FFT_SIZE / 2;
const RANGE = { low: 20, high: 16000 };

/** Empty bins with a loud peak at the given frequency. */
function toneAt(hz: number): Uint8Array {
  const bins = new Uint8Array(BIN_COUNT);
  const center = hzToBin(hz, SAMPLE_RATE, FFT_SIZE);
  for (let i = center - 1; i <= center + 1; i++) bins[i] = 255;
  return bins;
}

function edgesFor(range = RANGE): Int32Array {
  const edges = new Int32Array(5);
  bandEdges(BIN_COUNT, SAMPLE_RATE, FFT_SIZE, range, edges);
  return edges;
}

function energiesFor(bins: Uint8Array, range = RANGE, gain = 1): number[] {
  const out = new Float32Array(4);
  bandEnergies(bins, edgesFor(range), gain, out);
  return Array.from(out);
}

function loudestBand(values: number[]): number {
  return values.indexOf(Math.max(...values));
}

describe('bandEdges', () => {
  it('spans exactly settings.range and only increases', () => {
    const edges = Array.from(edgesFor());
    expect(edges[0]).toBe(Math.max(hzToBin(RANGE.low, SAMPLE_RATE, FFT_SIZE), 1));
    expect(edges[4]).toBe(hzToBin(RANGE.high, SAMPLE_RATE, FFT_SIZE));
    for (let i = 1; i < edges.length; i++) expect(edges[i]).toBeGreaterThan(edges[i - 1] ?? 0);
  });
});

describe('bandEnergies', () => {
  it('is all zero for silence', () => {
    expect(energiesFor(new Uint8Array(BIN_COUNT))).toEqual([0, 0, 0, 0]);
  });

  it('spreads common musical pitches across every band', () => {
    // A linear split over 0 to 24 kHz would put all four in bands 0 and 1.
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

describe('particles.reset', () => {
  /** A canvas context that only counts how many dots get drawn. */
  function countingContext() {
    const ctx = {
      canvas: { width: 400, height: 600 },
      globalAlpha: 1,
      fillStyle: '',
      dots: 0,
      fillRect() {},
      beginPath() {},
      arc() {
        ctx.dots++;
      },
      fill() {},
    };
    return ctx;
  }

  function frameOf(bins: Uint8Array): RenderFrame {
    return { bins, sampleRate: SAMPLE_RATE, fftSize: FFT_SIZE, pulse: 0 };
  }

  it('clears live particles, so a silent frame afterwards draws nothing', () => {
    const ctx = countingContext();
    const draw = (bins: Uint8Array) =>
      particles.draw(ctx as unknown as CanvasRenderingContext2D, frameOf(bins), DEFAULT_SETTINGS);

    draw(toneAt(60)); // spawn some dots
    ctx.dots = 0;
    draw(new Uint8Array(BIN_COUNT)); // silence: survivors are still drawn
    expect(ctx.dots).toBeGreaterThan(0);

    particles.reset?.();
    ctx.dots = 0;
    draw(new Uint8Array(BIN_COUNT));
    expect(ctx.dots).toBe(0);
  });
});

