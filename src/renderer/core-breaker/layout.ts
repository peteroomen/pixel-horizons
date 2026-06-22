/**
 * Fit transforms for the Core Breaker scene. Two nested fits:
 *  1. the portrait "column" (header + playfield + tray) fitted into the host viewport — handles
 *     the main game's landscape 640×360 stage, where the column renders as a centered letterboxed
 *     column; on the standalone portrait route the viewport equals the column so it's a no-op.
 *  2. the full cfg sim space fitted into the playfield band between the header and tray.
 */

export interface FitTransform {
  scale: number;
  /** Offset (in outer space) of the inner box's top-left after centering. */
  x: number;
  y: number;
}

/** Contain-fit an inner box into an outer box, centered on both axes. */
export function fitTransform(
  inner: { width: number; height: number },
  outer: { width: number; height: number },
): FitTransform {
  const scale = Math.min(outer.width / inner.width, outer.height / inner.height);
  return {
    scale,
    x: (outer.width - inner.width * scale) / 2,
    y: (outer.height - inner.height * scale) / 2,
  };
}

/** height:width used for the portrait canvas on a non-portrait (desktop) host. */
const DESKTOP_PORTRAIT_ASPECT = 2;

/**
 * The portrait viewport for a Core Breaker run — used identically by the standalone route and the
 * in-game mining phase so both fill the same way: match a portrait host's aspect exactly (so the
 * run fills the whole screen, no letterbox), and fall back to a phone-shaped portrait canvas on a
 * landscape host (desktop). Width is always the sim width.
 */
export function coreBreakerViewport(
  hostWidth: number,
  hostHeight: number,
  simWidth: number,
): { width: number; height: number } {
  const aspect = hostHeight / Math.max(1, hostWidth);
  const useAspect = aspect >= 1 ? aspect : DESKTOP_PORTRAIT_ASPECT;
  return { width: simWidth, height: Math.round(simWidth * useAspect) };
}
