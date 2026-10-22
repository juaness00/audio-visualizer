import type { Renderer } from '../renderer';
import { PANEL_BG_RGB } from '../theme';

const DISPLAY_POINTS = 180;
const smoothed = new Float32Array(DISPLAY_POINTS);
let hasPreviousFrame = false;

export const waveform: Renderer = {
  id: 'waveform',
  reset() {
    smoothed.fill(0);
    hasPreviousFrame = false;
  },
  draw(ctx, frame, settings) {
    const { width, height } = ctx.canvas;
    ctx.fillStyle = `rgba(${PANEL_BG_RGB}, 0.28)`;
    ctx.fillRect(0, 0, width, height);
    if (!frame.waveform.length) return;

    const center = height / 2;
    const amplitude = height * 0.38;
    const response = 0.055 + (1 - settings.smoothing) * 0.04;
    const points = Math.min(DISPLAY_POINTS, frame.waveform.length);
    const step = (frame.waveform.length - 1) / Math.max(1, points - 1);

    for (let index = 0; index < points; index++) {
      const sample = frame.waveform[Math.round(index * step)] ?? 128;
      const target = ((sample - 128) / 128) * amplitude * settings.gain;
      const previous = hasPreviousFrame ? (smoothed[index] ?? 0) : target;
      smoothed[index] = previous + (target - previous) * response;
    }

    const path = new Path2D();
    for (let index = 0; index < points; index++) {
      const x = (index / Math.max(1, points - 1)) * width;
      const y = center + (smoothed[index] ?? 0);
      if (index === 0) path.moveTo(x, y);
      else {
        const previousX = ((index - 1) / Math.max(1, points - 1)) * width;
        const previousY = center + (smoothed[index - 1] ?? 0);
        path.quadraticCurveTo(previousX, previousY, (previousX + x) / 2, (previousY + y) / 2);
      }
    }
    if (points > 1) {
      const lastX = width;
      const lastY = center + (smoothed[points - 1] ?? 0);
      path.quadraticCurveTo(lastX, lastY, lastX, lastY);
    }

    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    settings.palette.forEach((color, index) => {
      gradient.addColorStop(index / Math.max(1, settings.palette.length - 1), color);
    });
    ctx.strokeStyle = gradient;
    ctx.shadowColor = settings.palette[2] ?? settings.palette[0] ?? '#56ccf2';
    ctx.shadowBlur = 18;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(2.5, width / 260);
    ctx.stroke(path);
    ctx.globalAlpha = 0.2;
    ctx.lineWidth *= 3;
    ctx.shadowBlur = 26;
    ctx.stroke(path);
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    hasPreviousFrame = true;
  },
};
