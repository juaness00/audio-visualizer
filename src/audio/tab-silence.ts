import { createSilenceDetector } from './silence';
import type { SourceKind } from './sources/types';

/** Observe active tab audio without stopping the sampling needed for recovery. */
export function createTabSilence() {
  const detector = createSilenceDetector();
  let silent = false;
  const reset = () => {
    detector.reset();
    silent = false;
  };
  return {
    reset,
    update(kind: SourceKind | undefined, bins: Uint8Array, now: number) {
      if (kind !== 'tab') {
        reset();
        return;
      }
      const next = detector.update(bins, now);
      if (next === silent) return;
      silent = next;
      return next ? ('silence' as const) : ('sound' as const);
    },
  };
}
