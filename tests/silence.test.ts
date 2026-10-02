import { describe, expect, it } from 'vitest';
import { createSilenceDetector } from '@/audio/silence';

const quiet = new Uint8Array(8);
const loud = Uint8Array.from([0, 0, 40, 0, 0, 0, 0, 0]);

describe('createSilenceDetector', () => {
  it('is not silent until the hold time has passed', () => {
    const detector = createSilenceDetector({ holdMs: 2000 });
    expect(detector.update(quiet, 0)).toBe(false);
    expect(detector.update(quiet, 1999)).toBe(false);
    expect(detector.update(quiet, 2000)).toBe(true);
    expect(detector.update(quiet, 5000)).toBe(true);
  });

  it('any sound resets the timer', () => {
    const detector = createSilenceDetector({ holdMs: 2000 });
    detector.update(quiet, 0);
    expect(detector.update(loud, 1500)).toBe(false);
    expect(detector.update(quiet, 2500)).toBe(false);
    expect(detector.update(quiet, 4500)).toBe(true);
  });

  it('treats bins at or below the floor as quiet', () => {
    const detector = createSilenceDetector({ holdMs: 100, floor: 40 });
    detector.update(loud, 0);
    expect(detector.update(loud, 100)).toBe(true);
  });

  it('reset() starts the hold over', () => {
    const detector = createSilenceDetector({ holdMs: 100 });
    detector.update(quiet, 0);
    detector.reset();
    expect(detector.update(quiet, 150)).toBe(false);
    expect(detector.update(quiet, 250)).toBe(true);
  });

  it('defaults to a 2 s hold', () => {
    const detector = createSilenceDetector();
    detector.update(quiet, 0);
    expect(detector.update(quiet, 1999)).toBe(false);
    expect(detector.update(quiet, 2000)).toBe(true);
  });
});
