/**
 * One audio graph every source plugs into. Renderers never learn where the
 * sound came from; they only ever see frequency bins.
 */
export interface AudioEngine {
  readonly context: AudioContext;
  readonly sampleRate: number;
  readonly fftSize: number;
  /** Swap the input. Must not tear down the AudioContext. */
  connect(source: AudioNode): void;
  disconnect(): void;
  /** Fills and returns one reused Uint8Array. Never allocates per frame. */
  getFrequencyData(): Uint8Array;
  /** Live update of AnalyserNode.smoothingTimeConstant. */
  setSmoothing(value: number): void;
  /** Browsers start contexts suspended; call from a user gesture. */
  resume(): Promise<void>;
}

export interface AudioEngineOptions {
  fftSize: number;
  smoothing: number;
}

export function createAudioEngine(_options: AudioEngineOptions): AudioEngine {
  throw new Error('TODO LOS-8: createAudioEngine (AudioContext + AnalyserNode, reused buffer)');
}
