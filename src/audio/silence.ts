export interface SilenceDetectorOptions {
  /** How long every bin must stay quiet before it counts as silence. */
  holdMs?: number;
  /** A bin at or below this magnitude (0–255) counts as quiet. */
  floor?: number;
}

export interface SilenceDetector {
  /** Feed one frame of bins. Returns true once the input has been silent for holdMs. */
  update(bins: Uint8Array, now: number): boolean;
  reset(): void;
}

/**
 * "This tab isn't playing anything" (LOS-19). Meant to run inside the render
 * loop, so update() allocates nothing.
 */
export function createSilenceDetector({
  holdMs = 2000,
  floor = 0,
}: SilenceDetectorOptions = {}): SilenceDetector {
  let quietSince = -1;

  return {
    update(bins, now) {
      for (let i = 0; i < bins.length; i++) {
        if (bins[i]! > floor) {
          quietSince = -1;
          return false;
        }
      }
      if (quietSince < 0) quietSince = now;
      return now - quietSince >= holdMs;
    },
    reset() {
      quietSince = -1;
    },
  };
}
