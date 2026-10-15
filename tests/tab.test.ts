import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AudioEngine } from '@/audio/engine';
import { createTabSource } from '@/audio/sources/tab';

const getUserMedia = vi.fn();
const node = { connect: vi.fn(), disconnect: vi.fn() };
const destination = {};
const engine = {
  context: { createMediaStreamSource: vi.fn(() => node), destination },
  connect: vi.fn(),
} as unknown as AudioEngine;
let track: EventTarget & { stop: ReturnType<typeof vi.fn>; readyState: string };
let stream: { getTracks(): (typeof track)[]; getAudioTracks(): (typeof track)[] };

beforeEach(() => {
  vi.clearAllMocks();
  track = Object.assign(new EventTarget(), { stop: vi.fn(), readyState: 'live' });
  stream = { getTracks: () => [track], getAudioTracks: () => [track] };
  getUserMedia.mockResolvedValue(stream);
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
});
afterEach(() => vi.unstubAllGlobals());

describe('tab source', () => {
  it('redeems the stream ID and connects analysis and audible playback', async () => {
    const source = createTabSource('single-use-id');
    await source.start(engine);
    expect(getUserMedia).toHaveBeenCalledWith({
      audio: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: 'single-use-id' } },
      video: false,
    });
    expect(engine.connect).toHaveBeenCalledWith(node);
    expect(node.connect).toHaveBeenCalledExactlyOnceWith(destination);
    source.stop();
    source.stop();
    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(node.disconnect).toHaveBeenCalledTimes(1);
  });

  it('releases capture and reports the tab ending exactly once', async () => {
    const onEnded = vi.fn();
    await createTabSource('id').start(engine, { onEnded });
    track.dispatchEvent(new Event('ended'));
    track.dispatchEvent(new Event('ended'));
    expect(onEnded).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ code: 'tab-ended' }));
    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(node.disconnect).toHaveBeenCalledTimes(1);
  });

  it('does not report a deliberate stop as an error', async () => {
    const onEnded = vi.fn();
    const source = createTabSource('id');
    await source.start(engine, { onEnded });
    source.stop();
    track.dispatchEvent(new Event('ended'));
    expect(onEnded).not.toHaveBeenCalled();
  });

  it('releases a stream acquired after Stop without connecting it', async () => {
    let resolve!: (value: typeof stream) => void;
    getUserMedia.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const source = createTabSource('id');
    const pending = source.start(engine);
    const failure = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    source.stop();
    resolve(stream);
    await failure;
    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(engine.connect).not.toHaveBeenCalled();
    expect(node.connect).not.toHaveBeenCalled();
  });

  it('classifies restricted pages and expired stream IDs as capture errors', async () => {
    getUserMedia.mockRejectedValue(new DOMException('Invalid stream ID', 'NotAllowedError'));
    await expect(createTabSource('expired').start(engine)).rejects.toMatchObject({
      code: 'tab-capture-failed',
      kind: 'tab',
    });
  });

  it('releases tracks if wiring the audio graph fails', async () => {
    node.connect.mockImplementationOnce(() => {
      throw new Error('Audio graph failed');
    });
    await expect(createTabSource('id').start(engine)).rejects.toMatchObject({
      code: 'tab-capture-failed',
    });
    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(node.disconnect).toHaveBeenCalledTimes(1);
  });

  it('rejects an already ended stream without connecting it', async () => {
    track.readyState = 'ended';
    await expect(createTabSource('id').start(engine)).rejects.toMatchObject({ code: 'tab-ended' });
    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(engine.connect).not.toHaveBeenCalled();
  });
});
