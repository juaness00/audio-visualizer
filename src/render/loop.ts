import type { VisualizerSettings } from '@/settings/schema';
import type { RenderFrame, Renderer } from './renderer';

export interface RenderLoopOptions {
  canvas: HTMLCanvasElement;
  nextFrame(): RenderFrame;
  renderer(): Renderer;
  settings(): VisualizerSettings;
}
export interface RenderLoop {
  start(): void;
  stop(): void;
}
export function createRenderLoop(options: RenderLoopOptions): RenderLoop {
  const context = options.canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D is unavailable');
  let running = false;
  let request = 0;
  const draw = () => {
    if (!running || document.hidden) return;
    options.renderer().draw(context, options.nextFrame(), options.settings());
    request = requestAnimationFrame(draw);
  };
  const visibility = () => {
    cancelAnimationFrame(request);
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
