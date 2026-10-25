import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRenderLoop, frameDelta } from '@/render/loop';
import { particles } from '@/render/modes/particles';
import type { RenderFrame, Renderer } from '@/render/renderer';
import { MAX_FRAME_DT } from '@/render/renderer';
import { DEFAULT_SETTINGS } from '@/settings/schema';

const SAMPLE_RATE = 48000;
const FFT_SIZE = 2048;
const BIN_COUNT = FFT_SIZE / 2;
const RATES = [30, 60, 120];

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('frameDelta', () => {
  it('is 0 for the first picture', () => {
    expect(frameDelta(1000, undefined)).toBe(0);
  });

  it('is the seconds between two pictures', () => {
    expect(frameDelta(1016, 1000)).toBeCloseTo(0.016, 6);
  });

  it('caps a long stall, so nothing teleports', () => {
    expect(frameDelta(61000, 1000)).toBe(MAX_FRAME_DT);
  });

  it('is 0 if the clock goes backwards or is not a number', () => {
    expect(frameDelta(900, 1000)).toBe(0);
    expect(frameDelta(Number.NaN, 1000)).toBe(0);
  });
});

describe('render loop timing', () => {
  /** A fake browser: the test fires animation frames and visibility changes by hand. */
  function fakeBrowser() {
    let pending: ((now: number) => void) | undefined;
    let onVisibility: (() => void) | undefined;
    const doc = {
      hidden: false,
      addEventListener: (_: string, fn: () => void) => (onVisibility = fn),
      removeEventListener: () => (onVisibility = undefined),
    };
    vi.stubGlobal('document', doc);
    vi.stubGlobal('requestAnimationFrame', (fn: (now: number) => void) => {
      pending = fn;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', () => (pending = undefined));
    return {
      frameAt(now: number) {
        const fn = pending;
        pending = undefined;
        fn?.(now);
      },
      setHidden(hidden: boolean) {
        doc.hidden = hidden;
        onVisibility?.();
      },
    };
  }

  function loopRecordingDt() {
    const seen: number[] = [];
    const frame = {
      bins: new Uint8Array(),
      waveform: new Uint8Array(),
      sampleRate: SAMPLE_RATE,
      fftSize: FFT_SIZE,
      pulse: 0,
      dt: 0,
    };
    const renderer: Renderer = { id: 'bars', draw: () => {} };
    const canvas = {
      width: 10,
      height: 10,
      getContext: () => ({ clearRect() {} }),
    } as unknown as HTMLCanvasElement;
    const loop = createRenderLoop({
      canvas,
      nextFrame(dt) {
        seen.push(dt);
        frame.dt = dt;
        return frame;
      },
      renderer: () => renderer,
      settings: () => DEFAULT_SETTINGS,
    });
    return { loop, seen };
  }

  it('passes real elapsed seconds, starting from 0', () => {
    const browser = fakeBrowser();
    const { loop, seen } = loopRecordingDt();
    loop.start();
    browser.frameAt(1000);
    browser.frameAt(1016);
    browser.frameAt(1049);
    expect(seen[0]).toBe(0);
    expect(seen[1]).toBeCloseTo(0.016, 6);
    expect(seen[2]).toBeCloseTo(0.033, 6);
    loop.stop();
  });

  it('a long hidden interval restarts the clock instead of jumping', () => {
    const browser = fakeBrowser();
    const { loop, seen } = loopRecordingDt();
    loop.start();
    browser.frameAt(1000);
    browser.frameAt(1016);
    browser.setHidden(true);
    browser.setHidden(false); // a minute later
    browser.frameAt(61016);
    browser.frameAt(61032);
    expect(seen[2]).toBe(0);
    expect(seen[3]).toBeCloseTo(0.016, 6);
    loop.stop();
  });
});

describe('particles at different refresh rates', () => {
  /** Records each dot drawn (its y and fade) and the trail wash strength. */
  function recordingContext() {
    const ctx = {
      canvas: { width: 400, height: 600 },
      globalAlpha: 1,
      fillStyle: '',
      dots: [] as { y: number; alpha: number }[],
      washes: [] as number[],
      fillRect() {
        ctx.washes.push(ctx.globalAlpha);
      },
      beginPath() {},
      arc(_x: number, y: number) {
        ctx.dots.push({ y, alpha: ctx.globalAlpha });
      },
      fill() {},
    };
    return ctx;
  }

  const silence = () => new Uint8Array(BIN_COUNT);
  /** A loud bass note: band 0 only, round(energy * 3) = 2 dots per picture at 60 Hz. */
  function loudBass() {
    const bins = silence();
    bins[2] = bins[3] = bins[4] = 255;
    return bins;
  }
  /** A quieter bass note: 1 dot per picture at 60 Hz, so 60 dots a second. */
  function softBass() {
    const bins = silence();
    bins[1] = bins[2] = bins[3] = bins[4] = 90;
    return bins;
  }

  function frameOf(bins: Uint8Array, dt: number): RenderFrame {
    return {
      bins,
      waveform: new Uint8Array(FFT_SIZE),
      sampleRate: SAMPLE_RATE,
      fftSize: FFT_SIZE,
      pulse: 0,
      dt,
    };
  }

  /** Draw pictures at a refresh rate; returns what the LAST picture drew. */
  function run(rate: number, seconds: number, binsAt: (picture: number) => Uint8Array) {
    particles.reset?.();
    const ctx = recordingContext();
    const pictures = Math.round(rate * seconds);
    for (let i = 0; i < pictures; i++) {
      ctx.dots = [];
      particles.draw(
        ctx as unknown as CanvasRenderingContext2D,
        frameOf(binsAt(i), 1 / rate),
        DEFAULT_SETTINGS,
      );
    }
    return ctx;
  }

  it('dots travel the same distance and fade the same at 30, 60 and 120 Hz', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // no sideways drift, so paths are exact
    const results = RATES.map((rate) => run(rate, 0.5, (i) => (i === 0 ? loudBass() : silence())));
    for (const r of results) expect(r.dots.length).toBeGreaterThan(0);
    const first = results.map((r) => r.dots[0]!);
    const at30 = first[0]!;
    const at60 = first[1]!;
    const at120 = first[2]!;
    expect(at30.y).toBeCloseTo(at60.y, 4);
    expect(at120.y).toBeCloseTo(at60.y, 4);
    expect(at60.alpha).toBeCloseTo(0.5, 6); // half of a 1 second life
    expect(at30.alpha).toBeCloseTo(at60.alpha, 6);
    expect(at120.alpha).toBeCloseTo(at60.alpha, 6);
  });

  it('dots live one second at every refresh rate', () => {
    for (const rate of RATES) {
      expect(run(rate, 1.05, (i) => (i === 0 ? loudBass() : silence())).dots).toHaveLength(0);
    }
  });

  it('spawns the same number of dots per second at 30, 60 and 120 Hz', () => {
    const counts = RATES.map((rate) => run(rate, 0.5, softBass).dots.length);
    for (const count of counts) expect(count).toBe(30); // 60 a second, for half a second
  });

  it('fades the trail by the same amount per second at every refresh rate', () => {
    const remaining = RATES.map((rate) => {
      const wash = run(rate, 1 / rate, silence).washes[0]!;
      return Math.pow(1 - wash, rate * 0.5); // what's left of a dot's glow after 0.5 s
    });
    expect(remaining[0]).toBeCloseTo(remaining[1]!, 6);
    expect(remaining[2]).toBeCloseTo(remaining[1]!, 6);
  });

  it('a huge step is capped: no teleport, no burst of dots', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    particles.reset?.();
    const ctx = recordingContext();
    const draw = (bins: Uint8Array, dt: number) => {
      ctx.dots = [];
      particles.draw(
        ctx as unknown as CanvasRenderingContext2D,
        frameOf(bins, dt),
        DEFAULT_SETTINGS,
      );
    };
    draw(loudBass(), 30); // 30 seconds in one picture
    // At most MAX_FRAME_DT worth of dots: 2 per picture at 60 Hz, for 0.1 s.
    expect(ctx.dots.length).toBe(12);

    particles.reset?.();
    draw(loudBass(), 1 / 60);
    const start = ctx.dots[0]!.y;
    draw(silence(), 30);
    expect(ctx.dots).toHaveLength(2); // still alive, so no time was skipped
    const moved = start - ctx.dots[0]!.y;
    particles.reset?.();
    draw(loudBass(), 1 / 60);
    draw(silence(), MAX_FRAME_DT);
    expect(moved).toBeCloseTo(start - ctx.dots[0]!.y, 6); // moved exactly a capped step
  });

  it('the first picture after a resume, with dt 0, changes nothing', () => {
    particles.reset?.();
    const ctx = recordingContext();
    particles.draw(
      ctx as unknown as CanvasRenderingContext2D,
      frameOf(loudBass(), 0),
      DEFAULT_SETTINGS,
    );
    expect(ctx.dots).toHaveLength(0);
    expect(ctx.washes[0]).toBe(0);
  });

  it('reset also clears dots owed between pictures', () => {
    const ctx = recordingContext();
    const draw = (dt: number) => {
      ctx.dots = [];
      particles.draw(
        ctx as unknown as CanvasRenderingContext2D,
        frameOf(softBass(), dt),
        DEFAULT_SETTINGS,
      );
    };
    particles.reset?.();
    draw(1 / 120); // owes half a dot
    draw(1 / 120); // now owes a whole one
    expect(ctx.dots).toHaveLength(1);

    particles.reset?.();
    draw(1 / 120); // owes half a dot
    particles.reset?.(); // mode switch
    draw(1 / 120); // starts from nothing again
    expect(ctx.dots).toHaveLength(0);
  });
});
