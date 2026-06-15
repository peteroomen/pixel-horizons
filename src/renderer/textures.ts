import { Texture } from 'pixi.js';

/**
 * Wraps a sprite canvas in a PixiJS texture with nearest-neighbor sampling, so the
 * pixel art stays crisp when the scene is integer-scaled to the device (ADR 002 /
 * the World Art Direction render path).
 */
export function nearestTexture(canvas: HTMLCanvasElement): Texture {
  const texture = Texture.from(canvas);
  texture.source.scaleMode = 'nearest';
  return texture;
}
