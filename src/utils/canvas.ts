/**
 * Set the canvas backing store to an exact device-pixel size.
 * Returns true when the size changed, so callers can skip redundant work.
 * Assigning width/height clears the canvas, hence the equality check.
 */
export function setCanvasSize(canvas: HTMLCanvasElement, width: number, height: number): boolean {
  if (canvas.width === width && canvas.height === height) return false;
  canvas.width = width;
  canvas.height = height;
  return true;
}

/**
 * Match the canvas backing store to its CSS size × devicePixelRatio.
 * Approximate (rounding can land a pixel off); prefer observeCanvasSize.
 */
export function resizeToDisplaySize(canvas: HTMLCanvasElement): boolean {
  const dpr = window.devicePixelRatio || 1;
  return setCanvasSize(
    canvas,
    Math.round(canvas.clientWidth * dpr),
    Math.round(canvas.clientHeight * dpr),
  );
}

/**
 * Keep the canvas backing store matched to its on-screen size in device
 * pixels, otherwise everything renders blurry on retina panels.
 * `device-pixel-content-box` gives exact pixel counts and also fires when
 * devicePixelRatio changes (zoom, moving to another monitor), which a plain
 * content-box observer misses. Fires once on observe, so no initial call needed.
 * `onResize` runs after the backing store changed (and was cleared).
 * Returns a function that stops observing.
 */
export function observeCanvasSize(
  canvas: HTMLCanvasElement,
  onResize?: (width: number, height: number) => void,
): () => void {
  const observer = new ResizeObserver(([entry]) => {
    const size = entry?.devicePixelContentBoxSize?.[0];
    const changed = size
      ? setCanvasSize(canvas, size.inlineSize, size.blockSize)
      : resizeToDisplaySize(canvas);
    if (changed) onResize?.(canvas.width, canvas.height);
  });
  observer.observe(canvas, { box: 'device-pixel-content-box' });
  return () => observer.disconnect();
}
