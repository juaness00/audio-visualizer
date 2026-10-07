import type { VisualizerSettings } from '@/settings/schema';
import { hzToBin } from '../renderer';
import type { Renderer } from '../renderer';

const MAX_PARTICLES = 240;
const BANDS = 4;
const THRESHOLD = 0.18;
const MAX_SPAWN = 3;
const TAU = Math.PI * 2;

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


export function bandEnergies(
  bins: Uint8Array,
  sampleRate: number,
  fftSize: number,
  range: VisualizerSettings['range'],
  gain: number,
  out: Float32Array,
): void {
  out.fill(0);
  const count = out.length;
  const binCount = bins.length;
  if (count === 0 || binCount < 2) return;

  
  const low = Math.min(Math.max(hzToBin(range.low, sampleRate, fftSize), 1), binCount - 1);
  const high = Math.min(Math.max(hzToBin(range.high, sampleRate, fftSize), low + count), binCount);
  const ratio = high / low;

  for (let band = 0; band < count; band++) {
    const start = Math.floor(low * Math.pow(ratio, band / count));
    const end = Math.floor(low * Math.pow(ratio, (band + 1) / count));
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
  draw(ctx, frame, settings) {
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;
    if (width === 0 || height === 0) return;
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(12,12,16,0.22)';
    ctx.fillRect(0, 0, width, height);
    bandEnergies(
      frame.bins,
      frame.sampleRate,
      frame.fftSize,
      settings.range,
      settings.gain,
      energies,
    );

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
