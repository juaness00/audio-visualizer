/**
 * Match the canvas backing store to its CSS size × devicePixelRatio.
 * Returns true when the size changed, so callers can skip redundant work.
 */
export function resizeToDisplaySize(canvas: HTMLCanvasElement): boolean {
  const dpr = window.devicePixelRatio || 1;
  const width = Math.round(canvas.clientWidth * dpr);
  const height = Math.round(canvas.clientHeight * dpr);
  if (canvas.width === width && canvas.height === height) return false;
  canvas.width = width;
  canvas.height = height;
  return true;
}
