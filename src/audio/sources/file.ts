import type { AudioSource, SourceHooks } from './types';

/**
 * decodeAudioData → AudioBufferSourceNode → engine.connect.
 * Cheapest source to build; it unblocks renderer work before capture lands.
 */
export function createFileSource(file: File): AudioSource {
  let node: AudioBufferSourceNode | undefined;
  let stopped = false;

  const stop = () => {
    stopped = true;
    node?.stop();
    node?.disconnect();
    node = undefined;
  };

  return {
    kind: 'file',
    async start(engine, hooks?: SourceHooks) {
      stop();
      stopped = false;
      const buffer = await engine.context.decodeAudioData(await file.arrayBuffer());
      if (stopped) return;

      const playback = engine.context.createBufferSource();
      playback.buffer = buffer;
      playback.addEventListener('ended', () => {
        if (node !== playback) return;
        node = undefined;
        playback.disconnect();
        hooks?.onEnded();
      });
      node = playback;
      engine.connect(playback);
      playback.connect(engine.context.destination);
      playback.start();
    },
    stop,
  };
}
