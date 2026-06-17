import { Application, Container, Graphics, Sprite, type Texture } from 'pixi.js';

import type { PlanetDescriptor } from '@/game/sim/planet';
import { renderPlanetTexture } from './planet';
import { VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from './pixel-scale';

/**
 * Orbit view: the runtime-generated planet, large and centred, shown when the run arrives at
 * a planet node before the clone drops to the surface (6.1). Static bake (ADR 010) — the
 * planet's identity is the point; the DROP control + planet name live in the DOM overlay.
 * Mounted on the shared app stage and destroyed symmetrically by main.ts, same as the
 * combat/surface modes.
 */
export interface OrbitRenderer {
  destroy(): void;
}

const PLANET_SIZE = 200;

export function createOrbitRenderer(app: Application, descriptor: PlanetDescriptor): OrbitRenderer {
  const scene = new Container();
  app.stage.addChild(scene);

  // A few static stars so the void doesn't read as empty (placeholder until the 6.1
  // space-background generator slice). Deterministic from the planet seed.
  const stars = new Graphics();
  let s = descriptor.seed >>> 0;
  const rand = (): number => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  for (let i = 0; i < 70; i++) {
    const a = 0.25 + rand() * 0.5;
    stars
      .rect(Math.floor(rand() * VIRTUAL_WIDTH), Math.floor(rand() * VIRTUAL_HEIGHT), 1, 1)
      .fill({ color: 0xc7dcd0, alpha: a });
  }
  scene.addChild(stars);

  const texture: Texture = renderPlanetTexture(app, descriptor, PLANET_SIZE);
  const planet = new Sprite(texture);
  planet.anchor.set(0.5);
  planet.position.set(VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2);
  scene.addChild(planet);

  return {
    destroy(): void {
      scene.destroy({ children: true });
      texture.destroy(true);
    },
  };
}
