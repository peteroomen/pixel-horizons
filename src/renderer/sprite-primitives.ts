/**
 * Shared pixel-art drawing primitives — the helpers inherited from the FOUNDRY design
 * docs' `support.js`, used by both the combat (`sprites.ts`) and surface
 * (`surface-sprites.ts`) sprite factories.
 *
 * Each factory paints into an offscreen <canvas> with canvas-2D fillRect, then the
 * renderer wraps it in a nearest-neighbor PixiJS texture (see textures.ts). This is the
 * design's exact render path (integer-scaled, no anti-aliasing), so the art stays
 * pixel-perfect to the spec.
 *
 * Two palettes, one law (the design's thesis): the world is Resurrect 64, muted and
 * ramped; FOUNDRY's pure accents are reserved for signals — the only fully-saturated
 * pixels allowed to touch the world.
 *
 * Browser-only: every factory calls document.createElement and must run client-side.
 */

export type Ctx = CanvasRenderingContext2D;

/** Shared darkest-violet selout from Resurrect 64 (the spec's `E`). */
export const OUTLINE = '#2e222f';

/** Filled rect, integer-snapped — the spec's `R`. */
export const R = (g: Ctx, x: number, y: number, w: number, h: number, c: string): void => {
  g.fillStyle = c;
  g.fillRect(x | 0, y | 0, w | 0, h | 0);
};

const hx = (c: string): [number, number, number] => {
  const s = c.replace('#', '');
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
};

/** Linear blend of two hexes — used for depth-by-recolor and ramps toward the void. */
export const mix = (a: string, b: string, t: number): string => {
  const A = hx(a);
  const B = hx(b);
  return `rgb(${Math.round(A[0] + (B[0] - A[0]) * t)},${Math.round(A[1] + (B[1] - A[1]) * t)},${Math.round(A[2] + (B[2] - A[2]) * t)})`;
};

/** Seeded LCG — deterministic art, no game RNG stream consumed. */
export const rng = (s: number) => (): number => {
  s = (s * 1103515245 + 12345) & 0x7fffffff;
  return s / 0x7fffffff;
};

/** Wobbly filled ellipse — the Bloom's organic mass (anti-grid by construction). */
export const blob = (
  g: Ctx,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  c: string,
  seed: number,
  wob: number,
): void => {
  const r = rng(seed);
  g.fillStyle = c;
  for (let y = Math.floor(cy - ry - wob); y <= Math.ceil(cy + ry + wob); y++) {
    const t = (y - cy) / ry;
    if (Math.abs(t) > 1) continue;
    const half = rx * Math.sqrt(1 - t * t);
    const wl = (r() - 0.5) * 2 * wob;
    const wr = (r() - 0.5) * 2 * wob;
    const x0 = Math.round(cx - half + wl);
    const x1 = Math.round(cx + half + wr);
    g.fillRect(x0, y, Math.max(1, x1 - x0), 1);
  }
};

/** Noise mottle over existing opaque pixels — the Bloom's wet, uneven flesh. */
export const dither = (
  g: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  c: string,
  seed: number,
  dens: number,
): void => {
  const r = rng(seed);
  g.fillStyle = c;
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      if (r() < dens) {
        const px = x + xx;
        const py = y + yy;
        const a = g.getImageData(px, py, 1, 1).data;
        if (a[3] > 0) g.fillRect(px, py, 1, 1);
      }
    }
  }
};

/** 1px selective outline in `col` around every opaque pixel. */
export const outline = (g: Ctx, w: number, h: number, col: string): void => {
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  const op = (i: number): boolean => d[i * 4 + 3] > 0;
  const add: Array<[number, number]> = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (op(i)) continue;
      let near = false;
      if (x > 0 && op(i - 1)) near = true;
      else if (x < w - 1 && op(i + 1)) near = true;
      else if (y > 0 && op(i - w)) near = true;
      else if (y < h - 1 && op(i + w)) near = true;
      if (near) add.push([x, y]);
    }
  }
  g.fillStyle = col;
  for (const [x, y] of add) g.fillRect(x, y, 1, 1);
};

export function makeCanvas(w: number, h: number): { canvas: HTMLCanvasElement; g: Ctx } {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  if (g === null) throw new Error('2d context unavailable');
  g.imageSmoothingEnabled = false;
  return { canvas, g };
}

/** Builds a sprite canvas: paint with `fn`, then apply the selout `oc` if given. */
export const make = (
  w: number,
  h: number,
  fn: (g: Ctx) => void,
  oc?: string,
): HTMLCanvasElement => {
  const { canvas, g } = makeCanvas(w, h);
  fn(g);
  if (oc) outline(g, w, h, oc);
  return canvas;
};
