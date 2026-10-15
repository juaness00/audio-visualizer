import { SourceError, toSourceError } from './errors';
import type { AudioSource } from './types';

/** Redeem a single-use ID minted by the toolbar action in the service worker. */
export function createTabSource(streamId: string): AudioSource {
  let generation = 0;
  let stream: MediaStream | undefined;
  let node: MediaStreamAudioSourceNode | undefined;
  const ended = new Map<MediaStreamTrack, () => void>();

  const stop = () => {
    generation++;
    for (const [track, listener] of ended) track.removeEventListener('ended', listener);
    ended.clear();
    node?.disconnect();
    node = undefined;
    stream?.getTracks().forEach((track) => track.stop());
    stream = undefined;
  };

  return {
    kind: 'tab',
    async start(engine, hooks) {
      stop();
      const current = generation;
      try {
        // Chrome's tab-capture constraints are not part of the Web standard types.
        const audio = {
          mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId },
        } as MediaTrackConstraints;
        const acquired = await navigator.mediaDevices.getUserMedia({ audio, video: false });
        if (current !== generation) {
          acquired.getTracks().forEach((track) => track.stop());
          throw new DOMException('Tab capture cancelled', 'AbortError');
        }
        stream = acquired;
        if (
          !stream.getAudioTracks().length ||
          stream.getAudioTracks().some((t) => t.readyState === 'ended')
        ) {
          throw new SourceError('tab-ended', 'tab');
        }
        node = engine.context.createMediaStreamSource(stream);
        engine.connect(node);
        // Capturing suppresses the tab's original output. Restore it exactly once.
        node.connect(engine.context.destination);
        for (const track of stream.getAudioTracks()) {
          const onEnded = () => {
            if (current !== generation) return;
            stop();
            hooks?.onEnded(new SourceError('tab-ended', 'tab'));
          };
          ended.set(track, onEnded);
          track.addEventListener('ended', onEnded, { once: true });
        }
      } catch (error) {
        if (current === generation) stop();
        if (error instanceof DOMException && error.name === 'AbortError') throw error;
        throw toSourceError(error, 'tab');
      }
    },
    stop,
  };
}
