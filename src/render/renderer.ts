import type { ShapeMode, VisualizerSettings } from '@/settings/schema';

/** The longest step one picture may take, in seconds (LOS-30). */
export const MAX_FRAME_DT = 0.1;

/** What every renderer receives, once per animation frame. */
export interface RenderFrame {
  /** Magnitudes 0–255 per bin. Reused buffer; do not keep a reference. */
  readonly bins: Uint8Array;
  /** Time-domain samples centered at 128, reused by the audio engine. */
  readonly waveform: Uint8Array;
  readonly sampleRate: number;
  readonly fftSize: number;
  /** 0→1 beat pulse (LOS-20). Always 0 until that lands. */
  readonly pulse: number;
  /**
   * Seconds since the previous picture (LOS-30), at most MAX_FRAME_DT. It is 0
   * on the first picture after a start or a hidden panel, so nothing jumps.
   * Multiply speeds by it to move per second instead of per picture.
   */
  readonly dt: number;
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
