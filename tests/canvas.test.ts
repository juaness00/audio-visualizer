import { afterEach, describe, expect, it, vi } from 'vitest';
import { resizeToDisplaySize, setCanvasSize } from '@/utils/canvas';

// Only the fields the helpers touch; no DOM needed.
function fakeCanvas(clientWidth = 0, clientHeight = 0) {
  return { clientWidth, clientHeight, width: 300, height: 150 } as HTMLCanvasElement;
}

describe('setCanvasSize', () => {
  it('assigns the backing store and reports a change', () => {
    const canvas = fakeCanvas();
    expect(setCanvasSize(canvas, 640, 480)).toBe(true);
    expect(canvas.width).toBe(640);
    expect(canvas.height).toBe(480);
  });

  it('reports no change when the size already matches', () => {
    const canvas = fakeCanvas();
    setCanvasSize(canvas, 640, 480);
    expect(setCanvasSize(canvas, 640, 480)).toBe(false);
  });
});

describe('resizeToDisplaySize', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('scales CSS size by devicePixelRatio', () => {
    vi.stubGlobal('window', { devicePixelRatio: 2 });
    const canvas = fakeCanvas(320, 200);
    expect(resizeToDisplaySize(canvas)).toBe(true);
    expect(canvas.width).toBe(640);
    expect(canvas.height).toBe(400);
  });

  it('rounds fractional device pixels', () => {
    vi.stubGlobal('window', { devicePixelRatio: 1.25 });
    const canvas = fakeCanvas(101, 33);
    resizeToDisplaySize(canvas);
    expect(canvas.width).toBe(126);
    expect(canvas.height).toBe(41);
  });

  it('treats a missing devicePixelRatio as 1', () => {
    vi.stubGlobal('window', { devicePixelRatio: 0 });
    const canvas = fakeCanvas(320, 200);
    resizeToDisplaySize(canvas);
    expect(canvas.width).toBe(320);
  });
});
