import type { VisualizerSettings } from '@/settings/schema';
import { hzToBin } from '../renderer';
import type { Renderer } from '../renderer';
import { PANEL_BG_RGB } from '../theme';

const MAX_PARTICLES = 240;
const BANDS = 4;
const THRESHOLD = 0.18;
const MAX_SPAWN = 3;
const TAU = Math.PI * 2;


const TRAIL_FILL = `rgba(${PANEL_BG_RGB}, 0.22)`;

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
    p.vx = (Math.random() - 0.5) * energy * 0.012;
    p.vy = -energy * 0.02;
    p.age = 0;
    p.life = 60;
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
  },

  draw(ctx, frame, settings) {
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;
    if (width === 0 || height === 0) return;
    ctx.globalAlpha = 1;
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
      if (energy < THRESHOLD) continue;
      for (let n = 0; n < Math.round(energy * MAX_SPAWN); n++) {
        spawn(band, energy, width, height);
      }
    }
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = pool[i];
      if (!p || p.age >= p.life) continue;
      p.x += p.vx * width;
      p.y += p.vy * height;
      p.age += 1;
      ctx.globalAlpha = 1 - p.age / p.life;
      ctx.fillStyle = settings.palette[p.band % settings.palette.length] ?? '#FFFFFF';
      ctx.beginPath();
      ctx.arc(p.x, p.y, height * 0.006, 0, TAU);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  },
};
