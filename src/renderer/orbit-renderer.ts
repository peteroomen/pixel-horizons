import { Application, Container, Sprite, type Ticker } from 'pixi.js';

import type { PlanetDescriptor } from '@/game/sim/planet';
import { type AnimatedPlanet, createAnimatedPlanet } from './planet';
import { compositeShipFromModules } from './sprites';
import { nearestTexture } from './textures';

/**
 * Orbit view: the runtime-generated planet (slowly rotating) with the player's ship composited
 * from its installed modules in the foreground, idling on a gentle bob — shown when the run
 * arrives at a planet node before the clone drops to the surface (6.1). The DROP control +
 * planet name live in the DOM overlay. Mounted on the shared app stage and torn down
 * symmetrically by main.ts, same as the combat/surface modes.
 *
 * The persistent starfield (starfield.ts) provides the star background — no static stars here.
 */
export interface OrbitRenderer {
  destroy(): void;
}

const PLANET_SIZE = 200;
const SHIP_PX = 3; // integer so the composited ship stays pixel-crisp, matching combat

export function createOrbitRenderer(
  app: Application,
  descriptor: PlanetDescriptor,
  hullId: string,
  shipModules: readonly string[],
  virtW: number,
  virtH: number,
): OrbitRenderer {
  const scene = new Container();
  app.stage.addChild(scene);

  // Portrait positions: planet in the upper half, ship lower-left facing into frame.
  const PLANET_X = virtW / 2;
  const PLANET_Y = Math.round(virtH * 0.4);
  const SHIP_X = Math.round(virtW * 0.22);
  const SHIP_Y = Math.round(virtH * 0.82);

  // The planet, rotating (re-baked each tick).
  const planet: AnimatedPlanet = createAnimatedPlanet(app, descriptor, PLANET_SIZE);
  const planetSprite = new Sprite(planet.texture);
  planetSprite.anchor.set(0.5);
  planetSprite.position.set(PLANET_X, PLANET_Y);
  scene.addChild(planetSprite);

  // The player's ship — real hull + components, the same composite combat uses — foreground.
  const ship = new Sprite(nearestTexture(compositeShipFromModules(hullId, shipModules)));
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
