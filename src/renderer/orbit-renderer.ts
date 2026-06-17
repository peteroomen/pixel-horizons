import { Application, Container, Graphics, Sprite, type Ticker } from 'pixi.js';

import type { PlanetDescriptor } from '@/game/sim/planet';
import { type AnimatedPlanet, createAnimatedPlanet } from './planet';
import { VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from './pixel-scale';
import { type ShipModuleKind, compositeShip, shipModuleKind } from './sprites';
import { nearestTexture } from './textures';

/**
 * Orbit view: the runtime-generated planet (slowly rotating) with the player's ship composited
 * from its installed modules in the foreground, idling on a gentle bob — shown when the run
 * arrives at a planet node before the clone drops to the surface (6.1). The DROP control +
 * planet name live in the DOM overlay. Mounted on the shared app stage and torn down
 * symmetrically by main.ts, same as the combat/surface modes.
 */
export interface OrbitRenderer {
  destroy(): void;
}

const PLANET_SIZE = 200;
const SHIP_PX = 3; // integer so the composited ship stays pixel-crisp, matching combat
const SHIP_X = 128;
const SHIP_Y = VIRTUAL_HEIGHT - 86;

export function createOrbitRenderer(
  app: Application,
  descriptor: PlanetDescriptor,
  shipModules: readonly string[],
): OrbitRenderer {
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

  // The planet, rotating (re-baked each tick).
  const planet: AnimatedPlanet = createAnimatedPlanet(app, descriptor, PLANET_SIZE);
  const planetSprite = new Sprite(planet.texture);
  planetSprite.anchor.set(0.5);
  planetSprite.position.set(VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2);
  scene.addChild(planetSprite);

  // The player's ship, composited from its installed modules, foreground lower-left.
  const kinds = new Set<ShipModuleKind>();
  for (const name of shipModules) kinds.add(shipModuleKind(name));
  const ship = new Sprite(nearestTexture(compositeShip([...kinds])));
  ship.anchor.set(0.5);
  ship.scale.set(SHIP_PX);
  ship.position.set(SHIP_X, SHIP_Y);
  scene.addChild(ship);

  // Idle: rotate the planet and bob the ship (with a faint drift so it reads as adrift in space).
  let t = 0;
  const tick = (ticker: Ticker): void => {
    const dt = ticker.deltaMS / 1000;
    t += dt;
    planet.update(dt);
    ship.position.y = SHIP_Y + Math.sin(t * 1.4) * 4;
    ship.rotation = Math.sin(t * 0.6) * 0.03;
  };
  app.ticker.add(tick);

  return {
    destroy(): void {
      app.ticker.remove(tick);
      scene.destroy({ children: true });
      planet.destroy();
    },
  };
}
