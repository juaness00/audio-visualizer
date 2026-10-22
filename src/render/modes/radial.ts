import { hzToBin, type Renderer } from '../renderer';
import { PANEL_BG_RGB } from '../theme';

const POINTS = 96;
const levels = new Float32Array(POINTS);
let hasPreviousFrame = false;

export const radial: Renderer = {
  id: 'radial',
  reset() {
    levels.fill(0);
    hasPreviousFrame = false;
  },
  draw(ctx, frame, settings) {
    const { width, height } = ctx.canvas;
    const centerX = width / 2;
    const centerY = height / 2;
    const size = Math.min(width, height);
    const radius = size * 0.2;
    const low = Math.max(1, hzToBin(settings.range.low, frame.sampleRate, frame.fftSize));
    const high = Math.min(
      frame.bins.length - 1,
      hzToBin(settings.range.high, frame.sampleRate, frame.fftSize),
    );

    ctx.fillStyle = `rgba(${PANEL_BG_RGB}, 0.28)`;
    ctx.fillRect(0, 0, width, height);
    const response = 0.08 + (1 - settings.smoothing) * 0.05;
    const innerRadius = radius * 0.82;

    ctx.beginPath();
    ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${PANEL_BG_RGB}, 0.72)`;
    ctx.fill();
    ctx.strokeStyle = settings.palette[0] ?? '#bb6bd9';
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = Math.max(1.5, size / 180);
    ctx.stroke();
    ctx.globalAlpha = 1;

    for (let index = 0; index < POINTS; index++) {
      const ratio = index / POINTS;
      const start = Math.floor(low * (high / low) ** ratio);
      const end = Math.max(start + 1, Math.ceil(low * (high / low) ** ((index + 1) / POINTS)));
      let magnitude = 0;
      for (let bin = start; bin < Math.min(end, frame.bins.length); bin++)
        magnitude = Math.max(magnitude, frame.bins[bin] ?? 0);
      const level = Math.min(1, (magnitude / 255) * settings.gain);
      const previous = hasPreviousFrame ? (levels[index] ?? 0) : level;
      levels[index] = previous + (level - previous) * response;
      const angle = ratio * Math.PI * 2 - Math.PI / 2;
      const outer = radius + (levels[index] ?? 0) * size * 0.28;
      const gap = (Math.PI * 2) / POINTS * 0.22;
      const startAngle = angle + gap;
      const endAngle = angle - gap;
      const colorIndex = Math.min(
        settings.palette.length - 1,
        Math.floor(ratio * settings.palette.length),
      );
      const color = settings.palette[colorIndex] ?? '#bb6bd9';

      ctx.beginPath();
      ctx.moveTo(
        centerX + Math.cos(startAngle) * innerRadius,
        centerY + Math.sin(startAngle) * innerRadius,
      );
      ctx.lineTo(
        centerX + Math.cos(endAngle) * outer,
        centerY + Math.sin(endAngle) * outer,
      );
      ctx.strokeStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(2.5, size / 90);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    hasPreviousFrame = true;
  },
};
