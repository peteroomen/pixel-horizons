export const VIRTUAL_WIDTH = 640;
export const VIRTUAL_HEIGHT = 360;

/** Portrait virtual space — the universal canvas orientation for all non-mining phases. */
export const PORTRAIT_WIDTH = 360;
export const PORTRAIT_HEIGHT = 720;

export interface ScaleResult {
  /** Stage scale: canvas backing pixels per virtual pixel. */
  zoom: number;
  /** Canvas CSS size — backing size divided by dpr, so CSS px map 1:1 onto device px. */
  cssWidth: number;
  cssHeight: number;
  /** Canvas backing-store size in device pixels. */
  backingWidth: number;
  backingHeight: number;
}

/**
 * Zoom is computed in device pixels (CSS size × devicePixelRatio), never CSS pixels, so
 * an integer zoom still lands on exact physical-pixel squares when the viewport allows.
 *
 * The zoom is the exact contain ratio — fractional values allowed — so the canvas always
 * fills the viewport's width or height (whichever binds) with no letterbox dead bands on
 * that axis. Integer snapping was dropped: it left up to a full zoom-step of dead space
 * around the scene (a 320×180 canvas on a 375px phone), and the slight pixel unevenness
 * of fractional zoom is the accepted trade-off, same as the sub-1× case below.
 */
export function computeScale(
  availCssWidth: number,
  availCssHeight: number,
  dpr: number,
  virtualWidth: number = VIRTUAL_WIDTH,
  virtualHeight: number = VIRTUAL_HEIGHT,
): ScaleResult {
  const availW = availCssWidth * dpr;
  const availH = availCssHeight * dpr;
  const raw = Math.min(availW / virtualWidth, availH / virtualHeight);
  const zoom = Math.max(raw, 0.1);
  const backingWidth = Math.round(virtualWidth * zoom);
  const backingHeight = Math.round(virtualHeight * zoom);
  return {
    zoom,
    cssWidth: backingWidth / dpr,
    cssHeight: backingHeight / dpr,
    backingWidth,
    backingHeight,
  };
}
