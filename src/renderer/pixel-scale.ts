export const VIRTUAL_WIDTH = 640;
export const VIRTUAL_HEIGHT = 360;

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
 * Zoom is computed in device pixels (CSS size × devicePixelRatio) so integer zoom means
 * one virtual pixel covers an exact square of physical pixels — crisp on HiDPI displays.
 *
 * Below 1× (viewport smaller than 640×360 device px) we allow fractional downscale so the
 * whole scene always fits. Chosen over minimum-1×-with-scroll because mobile fit is a
 * launch requirement; slight pixel unevenness on sub-1× screens is the accepted trade-off.
 */
export function computeScale(
  availCssWidth: number,
  availCssHeight: number,
  dpr: number,
): ScaleResult {
  const availW = availCssWidth * dpr;
  const availH = availCssHeight * dpr;
  const raw = Math.min(availW / VIRTUAL_WIDTH, availH / VIRTUAL_HEIGHT);
  const zoom = raw >= 1 ? Math.floor(raw) : Math.max(raw, 0.1);
  const backingWidth = Math.round(VIRTUAL_WIDTH * zoom);
  const backingHeight = Math.round(VIRTUAL_HEIGHT * zoom);
  return {
    zoom,
    cssWidth: backingWidth / dpr,
    cssHeight: backingHeight / dpr,
    backingWidth,
    backingHeight,
  };
}
