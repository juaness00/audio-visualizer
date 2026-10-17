import type { AudioEngine } from '../engine';
import type { AudioSource, SourceHooks } from './types';

/** A file source, plus the controls only a file can have (LOS-28). */
export interface FileSource extends AudioSource {
  readonly kind: 'file';
  /** Length in seconds. 0 until the file is decoded. */
  readonly duration: number;
  readonly paused: boolean;
  readonly looping: boolean;
  /** Where playback is, in seconds. */
  position(): number;
  pause(): void;
  resume(): void;
  /** Jump to a time in seconds, clamped to the file. Stays playing or paused. */
  seek(seconds: number): void;
  setLoop(on: boolean): void;
}

export function isFileSource(source: AudioSource | undefined): source is FileSource {
  return source?.kind === 'file' && 'seek' in source;
}

/**
 * decodeAudioData → AudioBufferSourceNode → engine.connect.
 *
 * An AudioBufferSourceNode can only be started once. So pause, resume and
 * seek all stop the current node and start a fresh one at the right offset,
 * and the position is tracked here: the offset the node started from, plus
 * how far the context clock has moved since.
 */
export function createFileSource(file: File): FileSource {
  let engine: AudioEngine | undefined;
  let hooks: SourceHooks | undefined;
  let buffer: AudioBuffer | undefined;
  let node: AudioBufferSourceNode | undefined;
  let stopped = false;
  let paused = false;
  let looping = false;
  /** Position in seconds when the current node started, or where playback paused. */
  let offset = 0;
  /** Context time when the current node started. */
  let startedAt = 0;

  const duration = () => buffer?.duration ?? 0;

  /** Stop the current node without reporting an end. */
  function release() {
    const current = node;
    // Cleared first, so the 'ended' event this stop() causes is ignored.
    node = undefined;
    current?.stop();
    current?.disconnect();
  }

  function position(): number {
    if (!engine || !buffer) return 0;
    if (!node) return offset;
    const played = offset + (engine.context.currentTime - startedAt);
    const length = duration();
    if (looping && length > 0) return played % length;
    return Math.min(played, length);
  }

  function play(from: number) {
    if (!engine || !buffer) return;
    const context = engine.context;
    const playback = context.createBufferSource();
    playback.buffer = buffer;
    playback.loop = looping;
    playback.addEventListener('ended', () => {
      // Replaced by pause, seek or stop: not a natural end.
      if (node !== playback) return;
      node = undefined;
      offset = duration();
      playback.disconnect();
      hooks?.onEnded();
    });
    node = playback;
    engine.connect(playback);
    playback.connect(context.destination);
    playback.start(0, from);
    offset = from;
    startedAt = context.currentTime;
  }

  const stop = () => {
    stopped = true;
    paused = false;
    release();
  };

  return {
    kind: 'file',
    get duration() {
      return duration();
    },
    get paused() {
      return paused;
    },
    get looping() {
      return looping;
    },
    position,
    async start(target, sourceHooks?: SourceHooks) {
      stop();
      stopped = false;
      engine = target;
      hooks = sourceHooks;
      const decoded = await target.context.decodeAudioData(await file.arrayBuffer());
      if (stopped) return;
      buffer = decoded;
      play(0);
    },
    stop,
    pause() {
      if (paused || !node) return;
      offset = position();
      release();
      paused = true;
    },
    resume() {
      if (!paused || stopped) return;
      paused = false;
      play(offset);
    },
    seek(seconds) {
      if (!buffer || stopped) return;
      const target = Math.min(Math.max(seconds, 0), duration());
      if (!node) {
        offset = target;
        return;
      }
      release();
      play(target);
    },
    setLoop(on) {
      if (looping === on) return;
      // Re-base the clock, so position() stays right after the switch.
      offset = position();
      if (node && engine) startedAt = engine.context.currentTime;
      looping = on;
      if (node) node.loop = on;
    },
  };
}
