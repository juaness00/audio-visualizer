import type { Renderer } from '../renderer';

/**
 * Vertical bars, one per bin group. Map bins to x on a log scale: a linear
 * mapping crams every musically interesting bin into the left 10% of the canvas.
 */
export const bars: Renderer = {
  id: 'bars',
  draw() {
    throw new Error('TODO LOS-12: bars renderer');
  },
};
