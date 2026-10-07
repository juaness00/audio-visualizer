import type { ShapeMode, VisualizerSettings } from '@/settings/schema';

/** What every renderer receives, once per animation frame. */
export interface RenderFrame {
  /** Magnitudes 0–255 per bin. Reused buffer; do not keep a reference. */
  readonly bins: Uint8Array;
  readonly sampleRate: number;
  readonly fftSize: number;
  /** 0→1 beat pulse (LOS-20). Always 0 until that lands. */
  readonly pulse: number;
}

export interface Renderer {
  readonly id: ShapeMode;
  draw(ctx: CanvasRenderingContext2D, frame: RenderFrame, settings: VisualizerSettings): void;
  /**
   * Optional. Drop any state kept between frames, so switching back to this
   * mode starts clean. The render loop should call it on a mode change (LOS-12).
   */
  reset?(): void;
}

/** Hz → bin index for a given engine. */
export function hzToBin(hz: number, sampleRate: number, fftSize: number): number {
  return Math.round((hz / (sampleRate / 2)) * (fftSize / 2));
}
