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
  /** Reallocates bins only when the frequency resolution changes. */
  setFftSize(value: number): void;
  /** Browsers start contexts suspended; call from a user gesture. */
  resume(): Promise<void>;
}

export interface AudioEngineOptions {
  fftSize: number;
  smoothing: number;
}

export function createAudioEngine(options: AudioEngineOptions): AudioEngine {
  const context = new AudioContext();
  const analyser = context.createAnalyser();
  analyser.fftSize = options.fftSize;
  analyser.smoothingTimeConstant = options.smoothing;
  let bins = new Uint8Array(analyser.frequencyBinCount);
  let input: AudioNode | undefined;
  const disconnect = () => {
    input?.disconnect();
    input = undefined;
  };
  return {
    context,
    sampleRate: context.sampleRate,
    get fftSize() {
      return analyser.fftSize;
    },
    connect(source) {
      disconnect();
      source.connect(analyser);
      input = source;
    },
    disconnect,
    getFrequencyData() {
      analyser.getByteFrequencyData(bins);
      return bins;
    },
    setSmoothing(value) {
      analyser.smoothingTimeConstant = value;
    },
    setFftSize(value) {
      if (value === analyser.fftSize) return;
      analyser.fftSize = value;
      bins = new Uint8Array(analyser.frequencyBinCount);
    },
    resume: () => context.resume(),
  };
}
