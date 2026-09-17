import type { AudioEngine } from '../engine';

export type SourceKind = 'file' | 'tab' | 'mic';

export interface AudioSource {
  readonly kind: SourceKind;
  /** Acquire the audio and connect it to the engine. */
  start(engine: AudioEngine): Promise<void>;
  /** Release tracks/buffers and disconnect. Safe to call twice. */
  stop(): void;
}
