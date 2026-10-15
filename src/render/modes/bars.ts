import type { Renderer } from '../renderer';

export const bars: Renderer = {
  id: 'bars',
  draw(ctx, frame, settings) {
    const { width, height } = ctx.canvas;
    ctx.clearRect(0, 0, width, height);
    const count = 64;
    const low = Math.max(1, (settings.range.low * frame.fftSize) / frame.sampleRate);
    const high = Math.min(
      frame.bins.length,
      (settings.range.high * frame.fftSize) / frame.sampleRate,
    );
    const ratio = high / low;
    const step = width / count;
    for (let i = 0; i < count; i++) {
      const start = Math.floor(low * ratio ** (i / count));
      const end = Math.min(
        frame.bins.length,
        Math.max(start + 1, Math.ceil(low * ratio ** ((i + 1) / count))),
      );
      let magnitude = 0;
      for (let bin = start; bin < end; bin++) magnitude = Math.max(magnitude, frame.bins[bin] ?? 0);
      const amplitude = Math.min(1, (magnitude / 255) * settings.gain);
      const color = settings.hueMode === 'amplitude' ? amplitude : i / count;
      ctx.fillStyle =
        settings.palette[
          Math.min(settings.palette.length - 1, Math.floor(color * settings.palette.length))
        ] ?? '#f2994a';
      ctx.fillRect(
        i * step,
        height * (1 - amplitude * 0.7),
        Math.max(1, step - 2),
        height * amplitude * 0.7,
      );
    }
  },
};
