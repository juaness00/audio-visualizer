import { hzToBin, type Renderer } from '../renderer';
import { PANEL_BG_RGB } from '../theme';

const BANDS = [
  { label: 'Bass', low: 20, high: 250, pattern: '•••' },
  { label: 'Voice / mids', low: 250, high: 4000, pattern: '━━━' },
  { label: 'High sounds', low: 4000, high: 16000, pattern: '///' },
] as const;
const levels = new Float32Array(BANDS.length);
let hasPreviousFrame = false;

function bandLevel(
  bins: Uint8Array,
  sampleRate: number,
  fftSize: number,
  low: number,
  high: number,
  gain: number,
): number {
  const start = Math.max(1, hzToBin(low, sampleRate, fftSize));
  const end = Math.min(bins.length, Math.max(start + 1, hzToBin(high, sampleRate, fftSize)));
  if (start >= end) return 0;
  let total = 0;
  for (let index = start; index < end; index++) total += bins[index] ?? 0;
  return Math.min(1, (total / (end - start) / 255) * gain * 1.7);
}

export const awareness: Renderer = {
  id: 'awareness',
  reset() {
    levels.fill(0);
    hasPreviousFrame = false;
  },
  draw(ctx, frame, settings) {
    const { width, height } = ctx.canvas;
    ctx.fillStyle = `rgba(${PANEL_BG_RGB}, 0.32)`;
    ctx.fillRect(0, 0, width, height);
    if (!frame.bins.length || width === 0 || height === 0) return;

    const response = 0.08 + (1 - settings.smoothing) * 0.06;
    const gap = Math.max(12, width * 0.035);
    const cardWidth = (width - gap * 4) / BANDS.length;
    const top = Math.max(24, height * 0.12);
    const cardHeight = Math.min(height * 0.76, Math.max(160, height - top * 2));
    const colors = settings.palette;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let index = 0; index < BANDS.length; index++) {
      const band = BANDS[index];
      if (!band) continue;
      const target = bandLevel(
        frame.bins,
        frame.sampleRate,
        frame.fftSize,
        band.low,
        band.high,
        settings.gain,
      );
      const previous = hasPreviousFrame ? (levels[index] ?? 0) : target;
      levels[index] = previous + (target - previous) * response;

      const x = gap + index * (cardWidth + gap);
      const y = (height - cardHeight) / 2;
      const level = levels[index] ?? 0;
      const color = colors[index % colors.length] ?? '#56ccf2';
      const meterHeight = Math.max(4, (cardHeight - 86) * level);

      ctx.fillStyle = `rgba(32, 33, 43, 0.86)`;
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1.5, width / 220);
      ctx.beginPath();
      ctx.roundRect(x, y, cardWidth, cardHeight, 16);
      ctx.fill();
      ctx.globalAlpha = 0.7;
      ctx.stroke();
      ctx.globalAlpha = 1;

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(
        x + cardWidth * 0.24,
        y + cardHeight - 50 - meterHeight,
        cardWidth * 0.52,
        meterHeight,
        8,
      );
      ctx.fill();

      ctx.fillStyle = '#f4f2f7';
      ctx.font = `600 ${Math.max(12, Math.min(18, width / 18))}px system-ui`;
      ctx.fillText(band.label, x + cardWidth / 2, y + 30);
      ctx.fillStyle = color;
      ctx.font = `700 ${Math.max(16, Math.min(24, width / 14))}px system-ui`;
      ctx.fillText(band.pattern, x + cardWidth / 2, y + cardHeight - 24);
    }
    hasPreviousFrame = true;
  },
};
