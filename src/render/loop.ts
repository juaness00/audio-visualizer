import type { VisualizerSettings } from '@/settings/schema';
import type { RenderFrame, Renderer } from './renderer';

export interface RenderLoopOptions {
  canvas: HTMLCanvasElement;
  /** Called once per frame; must fill and return the same RenderFrame object. */
  nextFrame(): RenderFrame;
  renderer(): Renderer;
  settings(): VisualizerSettings;
}

export interface RenderLoop {
  start(): void;
  stop(): void;
}

/**
 * requestAnimationFrame loop. Pause on document.visibilityState === 'hidden';
 * a hidden panel burning a core is a battery bug. No allocation inside the
 * frame callback.
 */
export function createRenderLoop(_options: RenderLoopOptions): RenderLoop {
  throw new Error('TODO LOS-12: createRenderLoop');
}
