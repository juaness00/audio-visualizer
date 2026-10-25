import { describe, expect, it } from 'vitest';
import { createTabSilence } from '@/audio/tab-silence';

const quiet = new Uint8Array(4);
const loud = Uint8Array.from([0, 40, 0, 0]);

describe('tab silence observation', () => {
  it('holds for two seconds, emits transitions only, and recovers', () => {
    const observer = createTabSilence();
    expect(observer.update('tab', quiet, 0)).toBeUndefined();
    expect(observer.update('tab', quiet, 1999)).toBeUndefined();
    expect(observer.update('tab', quiet, 2000)).toBe('silence');
    expect(observer.update('tab', quiet, 2500)).toBeUndefined();
    expect(observer.update('tab', loud, 2501)).toBe('sound');
    expect(observer.update('tab', loud, 2502)).toBeUndefined();
    expect(observer.update('tab', quiet, 3000)).toBeUndefined();
    expect(observer.update('tab', quiet, 5000)).toBe('silence');
  });

  it('resets the quiet hold and previous notification on source release', () => {
    const observer = createTabSilence();
    observer.update('tab', quiet, 0);
    observer.update('tab', quiet, 2000);
    observer.reset();
    expect(observer.update('tab', loud, 2001)).toBeUndefined();
    expect(observer.update('tab', quiet, 3000)).toBeUndefined();
    expect(observer.update('tab', quiet, 5000)).toBe('silence');
  });

  it.each(['file', 'mic', undefined] as const)(
    'ignores %s and resets stale tab observation',
    (kind) => {
      const observer = createTabSilence();
      observer.update('tab', quiet, 0);
      expect(observer.update('tab', quiet, 2000)).toBe('silence');
      expect(observer.update(kind, quiet, 5000)).toBeUndefined();
      expect(observer.update(kind, quiet, 9000)).toBeUndefined();
      expect(observer.update('tab', quiet, 10000)).toBeUndefined();
      expect(observer.update('tab', quiet, 12000)).toBe('silence');
    },
  );
});
