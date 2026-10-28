import type { VisualizerSettings } from '@/settings/schema';
import { MAX_FRAME_DT } from './renderer';
import type { RenderFrame, Renderer } from './renderer';

export interface RenderLoopOptions {
  canvas: HTMLCanvasElement;
  /** Build the next frame. dt is the seconds since the last picture (LOS-30). */
  nextFrame(dt: number): RenderFrame;
  renderer(): Renderer;
  settings(): VisualizerSettings;
}
export interface RenderLoop {
  start(): void;
  stop(): void;
}
/**
 * Seconds between two requestAnimationFrame timestamps, capped at
 * MAX_FRAME_DT so a stalled or hidden panel can't make anything jump. The
 * first picture, when there is no previous timestamp, gets 0.
 */
export function frameDelta(now: number, last: number | undefined): number {
  if (last === undefined) return 0;
  const seconds = (now - last) / 1000;
  if (!(seconds > 0)) return 0;
  return Math.min(seconds, MAX_FRAME_DT);
}

export function createRenderLoop(options: RenderLoopOptions): RenderLoop {
  const context = options.canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D is unavailable');
  let running = false;
  let request = 0;
  /** Timestamp of the previous picture. Cleared on start and on every hide or show. */
  let last: number | undefined;
  const draw = (now: number) => {
    if (!running || document.hidden) return;
    const dt = frameDelta(now, last);
    last = now;
    options.renderer().draw(context, options.nextFrame(dt), options.settings());
    request = requestAnimationFrame(draw);
  };
  const visibility = () => {
    cancelAnimationFrame(request);
    // A fresh clock after a hidden panel: the time it was hidden doesn't count.
    last = undefined;
    if (running && !document.hidden) request = requestAnimationFrame(draw);
  };
  return {
    start() {
      if (running) return;
      running = true;
      document.addEventListener('visibilitychange', visibility);
      visibility();
    },
    stop() {
      running = false;
      cancelAnimationFrame(request);
      document.removeEventListener('visibilitychange', visibility);
      context.clearRect(0, 0, options.canvas.width, options.canvas.height);
    },
  };
}
