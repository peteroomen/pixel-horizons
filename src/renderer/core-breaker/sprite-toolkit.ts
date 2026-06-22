/**
 * Pixel-art sprite toolkit for the Core Breaker visual pass — a near-verbatim port of the
 * canvas drawing helpers in `docs/design/mining-run-v2.dc.html` (`R/hx/mix/rng/blob/dither/
 * outline/make`). Sprites are baked on an offscreen 2D canvas and wrapped as nearest-filtered
 * PixiJS textures, giving pixel-perfect parity with the design prototype.
 *
 * Renderer layer only — DOM/canvas use is allowed here (this is not sim code).
 */

import { Texture } from 'pixi.js';

export type Ctx = CanvasRenderingContext2D;

/** Filled pixel rect (integer-snapped) — the prototype's `R`. */
export function R(g: Ctx, x: number, y: number, w: number, h: number, c: string): void {
  g.fillStyle = c;
  g.fillRect(x | 0, y | 0, w | 0, h | 0);
}

/** Hex → [r,g,b]. */
export function hx(c: string): [number, number, number] {
  const s = c.replace('#', '');
  return [
    Number.parseInt(s.slice(0, 2), 16),
    Number.parseInt(s.slice(2, 4), 16),
    Number.parseInt(s.slice(4, 6), 16),
  ];
}

/** Linear blend of two hex colours → `rgb(...)`. */
export function mix(a: string, b: string, t: number): string {
  const A = hx(a);
  const B = hx(b);
  return `rgb(${Math.round(A[0] + (B[0] - A[0]) * t)},${Math.round(
    A[1] + (B[1] - A[1]) * t,
  )},${Math.round(A[2] + (B[2] - A[2]) * t)})`;
}

/** Seeded LCG → [0,1). Mirrors the prototype's `rng`. */
export function rng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

/** Filled wobbly ellipse drawn as horizontal spans — the prototype's `blob`. */
export function blob(
  g: Ctx,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  c: string,
  seed: number,
  wob: number,
): void {
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
}

/**
 * Sparse seeded dither over a region. The prototype only stamps over already-opaque pixels;
 * every call site pre-fills the region solid, so the alpha read is redundant and dropped here
 * (a per-pixel `getImageData` read would be a real cost over a full-screen background bake).
 */
export function dither(
  g: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  c: string,
  seed: number,
  dens: number,
): void {
  const r = rng(seed);
  g.fillStyle = c;
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      if (r() < dens) g.fillRect(x + xx, y + yy, 1, 1);
    }
  }
}

/** 1px neon edge around every opaque pixel — the prototype's `outline`. */
export function outline(g: Ctx, w: number, h: number, col: string): void {
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
}

/** Allocate an offscreen pixel canvas, run the draw fn, optionally add a neon outline. */
export function make(
  w: number,
  h: number,
  fn: (g: Ctx) => void,
  oc?: string | null,
): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  if (g === null) throw new Error('2d context unavailable');
  g.imageSmoothingEnabled = false;
  fn(g);
  if (oc) outline(g, w, h, oc);
  return c;
}

/** Wrap a baked pixel canvas as a nearest-filtered PixiJS texture. */
export function canvasTexture(canvas: HTMLCanvasElement): Texture {
  const tex = Texture.from(canvas);
  tex.source.scaleMode = 'nearest';
  return tex;
}

/** The dead-rock edge colour the prototype uses for inert rock (`T.E`). */
export const EDGE = '#2e222f';
