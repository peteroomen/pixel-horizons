/**
 * Crust + ceiling background bake — a port of `_crustBG` / `_drawCeiling` (and the floor band
 * baked in `_startRun`) from `docs/design/mining-run-v2.dc.html`. One baked texture sized to the
 * full sim space: a vertical ramp[4]→ramp[5] gradient, dithered, with wall pillars, a ceiling
 * surface-transition band, the breach scar where the pod punched through, and a floor band.
 */

import type { Texture } from 'pixi.js';

import type { Ramp } from '../palette';
import { type Ctx, R, mix, dither, make, canvasTexture } from './sprite-toolkit';

const CEILING_H = 14;

function crustBG(g: Ctx, W: number, H: number, ramp: Ramp): void {
  for (let y = 0; y < H; y++) {
    R(g, 0, y, W, 1, mix(ramp[4], ramp[5], y / H));
  }
  dither(g, 0, 0, W, H, mix(ramp[5], '#000000', 0.15), 21, 0.06);
  dither(g, 0, 0, W, H, mix(ramp[3], ramp[4], 0.5), 28, 0.04);
  // Wall pillars at the left/right edges.
  R(g, 0, 0, 4, H, ramp[5]);
  R(g, 4, 0, 1, H, ramp[4]);
  R(g, W - 4, 0, 4, H, ramp[5]);
  R(g, W - 5, 0, 1, H, ramp[4]);
}

function drawCeiling(g: Ctx, W: number, ramp: Ramp): void {
  for (let y = 0; y < CEILING_H; y++) {
    const t = y / CEILING_H;
    R(g, 0, y, W, 1, mix(mix(ramp[0], ramp[2], 0.4), ramp[4], t));
  }
  R(g, 0, CEILING_H - 2, W, 1, ramp[0]);
  R(g, 0, CEILING_H - 1, W, 1, ramp[1]);
  R(g, 0, CEILING_H, W, 2, ramp[2]);
  dither(g, 0, 2, W, CEILING_H - 3, ramp[1], 88, 0.05);
  // Scar where the pod punched through (centred on the breach point).
  const cx = W / 2;
  R(g, cx - 9, CEILING_H - 1, 18, 3, ramp[3]);
  R(g, cx - 7, CEILING_H, 14, 4, ramp[4]);
}

/** Bake the full-field crust background texture for a planet ramp. */
export function buildBackground(width: number, height: number, ramp: Ramp): Texture {
  const canvas = make(width, height, (g: Ctx) => {
    crustBG(g, width, height, ramp);
    drawCeiling(g, width, ramp);
    // Floor band at the bottom.
    R(g, 0, height - 7, width, 7, ramp[5]);
    R(g, 0, height - 7, width, 1, ramp[4]);
  });
  return canvasTexture(canvas);
}
