import { describe, expect, it, vi } from 'vitest';
import type { AudioEngine } from '@/audio/engine';
import { createFileSource } from '@/audio/sources/file';

function makeEngine() {
  const source = {
    buffer: undefined as unknown,
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    addEventListener: vi.fn(),
  };
  const context = {
    decodeAudioData: vi.fn().mockResolvedValue('decoded-buffer'),
    createBufferSource: vi.fn().mockReturnValue(source),
    destination: {},
  };
  return {
    context,
    connect: vi.fn(),
    disconnect: vi.fn(),
    resume: vi.fn(),
    getFrequencyData: vi.fn(),
    setFftSize: vi.fn(),
    setSmoothing: vi.fn(),
    sampleRate: 48000,
    fftSize: 2048,
    source,
  } as unknown as AudioEngine & { source: typeof source };
}

describe('createFileSource', () => {
  it('decodes, connects, and starts the selected file', async () => {
    const engine = makeEngine();
    const file = { arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(4)) } as unknown as File;

    await createFileSource(file).start(engine);

    expect(file.arrayBuffer).toHaveBeenCalledOnce();
    expect(engine.context.decodeAudioData).toHaveBeenCalledOnce();
    expect(engine.source.buffer).toBe('decoded-buffer');
    expect(engine.connect).toHaveBeenCalledWith(engine.source);
    expect(engine.source.connect).toHaveBeenCalledWith(engine.context.destination);
    expect(engine.source.start).toHaveBeenCalledOnce();
  });

  it('notifies the panel when playback ends', async () => {
    const engine = makeEngine();
    const onEnded = vi.fn();
    const file = { arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)) } as unknown as File;

    await createFileSource(file).start(engine, { onEnded });
    const ended = engine.source.addEventListener.mock.calls[0]?.[1] as () => void;
    ended();

    expect(onEnded).toHaveBeenCalledOnce();
    expect(engine.source.disconnect).toHaveBeenCalledOnce();
  });

  it('stops playback without reporting a natural end', async () => {
    const engine = makeEngine();
    const onEnded = vi.fn();
    const file = { arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)) } as unknown as File;
    const source = createFileSource(file);

    await source.start(engine, { onEnded });
    source.stop();

    expect(engine.source.stop).toHaveBeenCalledOnce();
    expect(onEnded).not.toHaveBeenCalled();
  });
});
