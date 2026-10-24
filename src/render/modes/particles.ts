import type { VisualizerSettings } from '@/settings/schema';
import { hzToBin } from '../renderer';
import { MAX_FRAME_DT } from '../renderer';
import type { Renderer } from '../renderer';
import { PANEL_BG_RGB } from '../theme';

const MAX_PARTICLES = 240;
const BANDS = 4;
const THRESHOLD = 0.18;
const MAX_SPAWN = 3;
const TAU = Math.PI * 2;

// LOS-30: everything below is per SECOND. The look was tuned at 60 pictures a
// second, so at exactly 60 Hz it matches the old per-picture behaviour.
const TUNED_FPS = 60;
/** How long a dot lives, in seconds. */
const LIFE = 1;
/** Fraction of the trail wash per picture at 60 Hz. */
const TRAIL_PER_FRAME = 0.22;

/** Trail wash colour, opaque. Its strength is set per picture with globalAlpha, so no string is built per frame. */
const TRAIL_FILL = `rgb(${PANEL_BG_RGB})`;

const pool = Array.from({ length: MAX_PARTICLES }, () => ({
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  age: 0,
  life: 0,
  band: 0,
}));

const energies = new Float32Array(BANDS);

/** Dots each band still owes, carried between pictures so spawning is per second (LOS-30). */
const spawnDebt = new Float32Array(BANDS);

const edges = new Int32Array(BANDS + 1);

const edgesFor = { binCount: -1, sampleRate: -1, fftSize: -1, low: -1, high: -1 };

export function bandEdges(
  binCount: number,
  sampleRate: number,
  fftSize: number,
  range: VisualizerSettings['range'],
  out: Int32Array,
): void {
  out.fill(0);
  const count = out.length - 1;
  if (count < 1 || binCount < 2) return;

  // A log split needs a non-zero lower edge.
  const low = Math.min(Math.max(hzToBin(range.low, sampleRate, fftSize), 1), binCount - 1);
  const high = Math.min(Math.max(hzToBin(range.high, sampleRate, fftSize), low + count), binCount);
  const ratio = high / low;

  for (let edge = 0; edge <= count; edge++) {
    out[edge] = Math.floor(low * Math.pow(ratio, edge / count));
  }
}

export function bandEnergies(
  bins: Uint8Array,
  boundaries: Int32Array,
  gain: number,
  out: Float32Array,
): void {
  const binCount = bins.length;
  for (let band = 0; band < out.length; band++) {
    const start = boundaries[band] ?? 0;
    const end = boundaries[band + 1] ?? start;
    const last = Math.max(start + 1, Math.min(end, binCount));

    let total = 0;
    for (let i = start; i < last; i++) total += bins[i] ?? 0;
    out[band] = Math.min((total / (last - start) / 255) * gain, 1);
  }
}

function spawn(band: number, energy: number, width: number, height: number): void {
  for (let i = 0; i < MAX_PARTICLES; i++) {
    const p = pool[i];
    if (!p || p.age < p.life) {
      continue;
    }
    p.x = ((band + 0.5) / BANDS) * width;
    p.y = height;
    // Fractions of the canvas per second (0.012 and 0.02 per picture at 60 Hz).
    p.vx = (Math.random() - 0.5) * energy * 0.012 * TUNED_FPS;
    p.vy = -energy * 0.02 * TUNED_FPS;
    p.age = 0;
    p.life = LIFE;
    p.band = band;
    return;
  }
}

export const particles: Renderer = {
  id: 'particles',

  reset() {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = pool[i];
      if (p) p.age = p.life;
    }
    spawnDebt.fill(0);
  },

  draw(ctx, frame, settings) {
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;
    if (width === 0 || height === 0) return;
    // Seconds since the last picture. Clamped here too, in case a caller skips the loop.
    const dt = Math.min(Math.max(frame.dt, 0), MAX_FRAME_DT);

    // The same fade per second at any refresh rate: 22% per picture at 60 Hz.
    ctx.globalAlpha = 1 - Math.pow(1 - TRAIL_PER_FRAME, dt * TUNED_FPS);
    ctx.fillStyle = TRAIL_FILL;
    ctx.fillRect(0, 0, width, height);

    const binCount = frame.bins.length;
    if (
      binCount !== edgesFor.binCount ||
      frame.sampleRate !== edgesFor.sampleRate ||
      frame.fftSize !== edgesFor.fftSize ||
      settings.range.low !== edgesFor.low ||
      settings.range.high !== edgesFor.high
    ) {
      bandEdges(binCount, frame.sampleRate, frame.fftSize, settings.range, edges);
      edgesFor.binCount = binCount;
      edgesFor.sampleRate = frame.sampleRate;
      edgesFor.fftSize = frame.fftSize;
      edgesFor.low = settings.range.low;
      edgesFor.high = settings.range.high;
    }
    bandEnergies(frame.bins, edges, settings.gain, energies);

    for (let band = 0; band < BANDS; band++) {
      const energy = energies[band] ?? 0;
      if (energy < THRESHOLD) {
        spawnDebt[band] = 0;
        continue;
      }
      // Same dots per second as before: round(energy * 3) per picture at 60 Hz.
      let owed = (spawnDebt[band] ?? 0) + Math.round(energy * MAX_SPAWN) * TUNED_FPS * dt;
      // The tiny allowance absorbs rounding, so 60 Hz spawns exactly as before.
      while (owed >= 1 - 1e-6) {
        spawn(band, energy, width, height);
        owed -= 1;
      }
      spawnDebt[band] = Math.max(owed, 0);
    }
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = pool[i];
      if (!p || p.age >= p.life) continue;
      p.x += p.vx * width * dt;
      p.y += p.vy * height * dt;
      p.age += dt;
      ctx.globalAlpha = 1 - p.age / p.life;
      ctx.fillStyle = settings.palette[p.band % settings.palette.length] ?? '#FFFFFF';
      ctx.beginPath();
      ctx.arc(p.x, p.y, height * 0.006, 0, TAU);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  },
};
