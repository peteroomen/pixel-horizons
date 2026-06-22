import { Application, Container, Sprite } from 'pixi.js';

import { nearestTexture } from './textures';

export interface Starfield {
  destroy(): void;
}

interface StarLayer {
  count: number;
  /** Virtual px per 60-fps tick. */
  speed: number;
  /** Sprite scale (1 = 1 virt px, 2 = 2 virt px). */
  size: number;
  alphaMin: number;
  alphaMax: number;
}

const LAYERS: StarLayer[] = [
  { count: 50, speed: 0.28, size: 1, alphaMin: 0.12, alphaMax: 0.32 }, // far
  { count: 22, speed: 0.75, size: 1, alphaMin: 0.32, alphaMax: 0.55 }, // mid
  { count: 8, speed: 1.7, size: 2, alphaMin: 0.52, alphaMax: 0.78 }, // near
];

function make1x1(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 1;
  c.height = 1;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 1, 1);
  return c;
}

/**
 * Animated three-layer parallax starfield — always the bottom-most layer of the stage.
 * Stars drift downward (sense of forward flight), wrapping when they exit the canvas.
 * Seeded so the star pattern is stable across hot-reloads.
 */
export function createStarfield(
  app: Application,
  virtW: number,
  virtH: number,
  seed: number = 0x5a7e91,
): Starfield {
  const container = new Container();
  app.stage.addChildAt(container, 0);

  // LCG matching the pattern used in sprites.ts for deterministic placement.
  let s = seed >>> 0 || 0x5a7e91;
  const rand = (): number => {
    s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };

  const tex = nearestTexture(make1x1());

  interface StarSprite {
    sprite: Sprite;
    speed: number;
  }
  const stars: StarSprite[] = [];

  for (const layer of LAYERS) {
    for (let i = 0; i < layer.count; i++) {
      const sprite = new Sprite(tex);
      sprite.scale.set(layer.size);
      sprite.alpha = layer.alphaMin + rand() * (layer.alphaMax - layer.alphaMin);
      sprite.x = Math.floor(rand() * virtW);
      sprite.y = Math.floor(rand() * virtH);
      container.addChild(sprite);
      stars.push({ sprite, speed: layer.speed * (0.7 + rand() * 0.6) });
    }
  }

  const tick = (): void => {
    for (const { sprite, speed } of stars) {
      sprite.y += speed;
      if (sprite.y >= virtH) sprite.y -= virtH;
    }
  };

  app.ticker.add(tick);

  return {
    destroy(): void {
      app.ticker.remove(tick);
      container.destroy({ children: true, texture: false });
    },
  };
}
