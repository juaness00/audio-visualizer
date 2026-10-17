import { describe, expect, it, vi } from 'vitest';
import type { AudioEngine } from '@/audio/engine';
import { createFileSource, isFileSource } from '@/audio/sources/file';

/** A playback node that records calls and lets a test fire its 'ended' event. */
function fakeNode() {
  const listeners: Record<string, () => void> = {};
  return {
    buffer: null as unknown,
    loop: false,
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    addEventListener: vi.fn((type: string, fn: () => void) => {
      listeners[type] = fn;
    }),
    fire(type: string) {
      listeners[type]?.();
    },
  };
}

/** An engine whose clock the test moves by hand, playing a 10 second file. */
function setup(duration = 10) {
  const nodes: ReturnType<typeof fakeNode>[] = [];
  const context = {
    currentTime: 0,
    destination: {},
    decodeAudioData: vi.fn().mockResolvedValue({ duration }),
    createBufferSource: vi.fn(() => {
      const node = fakeNode();
      nodes.push(node);
      return node;
    }),
  };
  const engine = {
    context,
    connect: vi.fn(),
    disconnect: vi.fn(),
    resume: vi.fn(),
    getFrequencyData: vi.fn(),
    setFftSize: vi.fn(),
    setSmoothing: vi.fn(),
    sampleRate: 48000,
    fftSize: 2048,
  } as unknown as AudioEngine;
  const file = { arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)) } as unknown as File;
  const onEnded = vi.fn();
  const source = createFileSource(file);
  return {
    context,
    nodes,
    engine,
    onEnded,
    source,
    start: () => source.start(engine, { onEnded }),
  };
}

describe('file transport', () => {
  it('is recognised as a file source', () => {
    expect(isFileSource(setup().source)).toBe(true);
    expect(isFileSource(undefined)).toBe(false);
  });

  it('starts at 0 and follows the clock', async () => {
    const t = setup();
    await t.start();
    expect(t.nodes[0]?.start).toHaveBeenCalledWith(0, 0);
    expect(t.source.duration).toBe(10);
    t.context.currentTime = 3;
    expect(t.source.position()).toBe(3);
  });

  it('pause keeps the position and stops the node without reporting an end', async () => {
    const t = setup();
    await t.start();
    t.context.currentTime = 4;
    t.source.pause();
    expect(t.source.paused).toBe(true);
    expect(t.nodes[0]?.stop).toHaveBeenCalledOnce();
    t.context.currentTime = 9;
    expect(t.source.position()).toBe(4);
    t.nodes[0]?.fire('ended');
    expect(t.onEnded).not.toHaveBeenCalled();
  });

  it('resume starts a fresh node where it paused', async () => {
    const t = setup();
    await t.start();
    t.context.currentTime = 4;
    t.source.pause();
    t.context.currentTime = 9;
    t.source.resume();
    expect(t.nodes).toHaveLength(2);
    expect(t.nodes[1]?.start).toHaveBeenCalledWith(0, 4);
    t.context.currentTime = 10;
    expect(t.source.position()).toBe(5);
  });

  it('seek while playing restarts at the new time', async () => {
    const t = setup();
    await t.start();
    t.context.currentTime = 2;
    t.source.seek(7);
    expect(t.nodes[0]?.stop).toHaveBeenCalledOnce();
    expect(t.nodes[1]?.start).toHaveBeenCalledWith(0, 7);
    t.context.currentTime = 3;
    expect(t.source.position()).toBe(8);
  });

  it('seek while paused only moves the position, and resume starts there', async () => {
    const t = setup();
    await t.start();
    t.context.currentTime = 2;
    t.source.pause();
    t.source.seek(6);
    expect(t.nodes).toHaveLength(1);
    expect(t.source.position()).toBe(6);
    t.source.resume();
    expect(t.nodes[1]?.start).toHaveBeenCalledWith(0, 6);
  });

  it('seek is clamped to the file', async () => {
    const t = setup();
    await t.start();
    t.source.seek(-5);
    expect(t.nodes[1]?.start).toHaveBeenCalledWith(0, 0);
    t.source.seek(99);
    expect(t.nodes[2]?.start).toHaveBeenCalledWith(0, 10);
  });

  it('loop sets the node to loop and wraps the position', async () => {
    const t = setup();
    await t.start();
    t.source.setLoop(true);
    expect(t.nodes[0]?.loop).toBe(true);
    expect(t.source.looping).toBe(true);
    t.context.currentTime = 13;
    expect(t.source.position()).toBe(3);
    t.source.setLoop(false);
    expect(t.nodes[0]?.loop).toBe(false);
    t.context.currentTime = 14;
    expect(t.source.position()).toBe(4);
  });

  it('a seek keeps looping on', async () => {
    const t = setup();
    await t.start();
    t.source.setLoop(true);
    t.source.seek(5);
    expect(t.nodes[1]?.loop).toBe(true);
  });

  it('reports a natural end once, and ignores nodes it replaced', async () => {
    const t = setup();
    await t.start();
    t.source.seek(5);
    t.nodes[0]?.fire('ended');
    expect(t.onEnded).not.toHaveBeenCalled();
    t.nodes[1]?.fire('ended');
    expect(t.onEnded).toHaveBeenCalledOnce();
  });

  it('stop is safe twice, and nothing restarts it afterwards', async () => {
    const t = setup();
    await t.start();
    t.source.stop();
    t.source.stop();
    t.source.resume();
    t.source.seek(3);
    expect(t.nodes).toHaveLength(1);
    expect(t.onEnded).not.toHaveBeenCalled();
  });

  it('a stop during decoding means it never starts playing', async () => {
    const t = setup();
    const starting = t.start();
    t.source.stop();
    await starting;
    expect(t.nodes).toHaveLength(0);
  });
});
