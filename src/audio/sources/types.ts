import type { AudioEngine } from '../engine';
import type { SourceError } from './errors';

export type SourceKind = 'file' | 'tab' | 'mic';

export interface SourceHooks {
  /**
   * The source stopped on its own after start() resolved: the captured tab
   * closed (pass a 'tab-ended' SourceError), the file finished (no argument).
   */
  onEnded(reason?: SourceError): void;
}

export interface AudioSource {
  readonly kind: SourceKind;
  /**
   * Acquire the audio and connect it to the engine. Reject with a SourceError
   * (see ./errors) so the side panel can show the right state.
   */
  start(engine: AudioEngine, hooks?: SourceHooks): Promise<void>;
  /** Release tracks/buffers and disconnect. Safe to call twice. */
  stop(): void;
}
