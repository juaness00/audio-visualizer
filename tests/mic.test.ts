import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMicSource, MIC_CONSTRAINTS } from '@/audio/sources/mic';
import type { AudioEngine } from '@/audio/engine';

const query = vi.fn();
const getUserMedia = vi.fn();
const stopTrack = vi.fn();
const disconnect = vi.fn();
const connect = vi.fn();
const stream = { getTracks: () => [{ stop: stopTrack }] };
const node = { disconnect };
const engine = {
  context: { createMediaStreamSource: vi.fn(() => node) },
  connect,
} as unknown as AudioEngine;
let messages: ((message: unknown, sender: unknown) => void)[];
let removed: ((id: number) => void)[];
const create = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  messages = [];
  removed = [];
  query.mockResolvedValue({ state: 'granted' });
  getUserMedia.mockResolvedValue(stream);
  create.mockResolvedValue({ id: 42 });
  vi.stubGlobal('navigator', { permissions: { query }, mediaDevices: { getUserMedia } });
  vi.stubGlobal('chrome', {
    runtime: {
      id: 'test',
      getURL: (path: string) => 'chrome-extension://test/' + path,
      onMessage: {
        addListener: (listener: (typeof messages)[number]) => messages.push(listener),
        removeListener: (listener: (typeof messages)[number]) => {
          messages = messages.filter((item) => item !== listener);
        },
      },
    },
    tabs: {
      create,
      remove: vi.fn().mockResolvedValue(undefined),
      onRemoved: {
        addListener: (listener: (typeof removed)[number]) => removed.push(listener),
        removeListener: (listener: (typeof removed)[number]) => {
          removed = removed.filter((item) => item !== listener);
        },
      },
    },
  });
});
afterEach(() => vi.unstubAllGlobals());

function reply(error?: string) {
  const url = new URL(create.mock.calls[0]![0].url);
  messages[0]!(
    {
      type: 'microphone-permission',
      requestId: url.searchParams.get('requestId'),
      error,
      name: error ? 'NotAllowedError' : undefined,
    },
    { id: 'test' },
  );
}

describe('microphone source', () => {
  it('uses an existing grant, disables processing, and releases tracks on stop', async () => {
    const source = createMicSource();
    await source.start(engine);
    expect(create).not.toHaveBeenCalled();
    expect(getUserMedia).toHaveBeenCalledWith(MIC_CONSTRAINTS);
    expect(connect).toHaveBeenCalledWith(node);
    source.stop();
    source.stop();
    expect(stopTrack).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
  it('opens one permission tab and waits before acquiring audio', async () => {
    query.mockResolvedValue({ state: 'prompt' });
    const source = createMicSource();
    const pending = source.start(engine);
    await vi.waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(getUserMedia).not.toHaveBeenCalled();
    reply();
    await pending;
    expect(connect).toHaveBeenCalledWith(node);
    expect(messages).toHaveLength(0);
    expect(removed).toHaveLength(0);
    source.stop();
  });
  it('does not reopen a prompt for an existing denial', async () => {
    query.mockResolvedValue({ state: 'denied' });
    await expect(createMicSource().start(engine)).rejects.toMatchObject({
      name: 'NotAllowedError',
    });
    expect(create).not.toHaveBeenCalled();
    expect(getUserMedia).not.toHaveBeenCalled();
  });
  it('reports denial from the permission tab immediately', async () => {
    query.mockResolvedValue({ state: 'prompt' });
    const pending = createMicSource().start(engine);
    const failure = expect(pending).rejects.toMatchObject({ name: 'NotAllowedError' });
    await vi.waitFor(() => expect(create).toHaveBeenCalled());
    reply('Blocked');
    await failure;
    expect(getUserMedia).not.toHaveBeenCalled();
  });
  it('recovers when the permission tab is closed without a grant', async () => {
    query.mockResolvedValue({ state: 'prompt' });
    const pending = createMicSource().start(engine);
    const failure = expect(pending).rejects.toThrow('setup was closed');
    await vi.waitFor(() => expect(create).toHaveBeenCalled());
    removed[0]!(42);
    await failure;
    expect(messages).toHaveLength(0);
  });
  it('stops a stream acquired after cancellation instead of connecting it', async () => {
    let resolve!: (value: typeof stream) => void;
    getUserMedia.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const source = createMicSource();
    const pending = source.start(engine);
    const failure = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    await vi.waitFor(() => expect(getUserMedia).toHaveBeenCalled());
    source.stop();
    resolve(stream);
    await failure;
    expect(stopTrack).toHaveBeenCalledTimes(1);
    expect(connect).not.toHaveBeenCalled();
  });
});
