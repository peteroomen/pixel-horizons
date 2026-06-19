import { Application, Container, Graphics, Sprite, type Ticker } from 'pixi.js';

import type { PlanetDescriptor } from '@/game/sim/planet';
import { type AnimatedPlanet, createAnimatedPlanet } from './planet';
import { VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from './pixel-scale';
import { nearestTexture } from './textures';

/**
 * Scene transitions (6.9, slice A): the hyperspace seam, with the ship in frame.
 *
 * A pixelated coral lane-spiral whirls around the player's ship: for the **Lane Drop**
 * (hyperspace → orbit, on planet arrival) the spiral *closes in* and decelerates, the
 * planet rises into the lower third, and the ship eases to its orbit pose so the orbit
 * screen appears seamlessly behind a cyan punch-flash. For the **Lane Launch**
 * (node → hyperspace, on departure) it runs the other way: the engine wash spools up,
 * a cyan jump-flash, and the spiral *blooms outward* and accelerates as the ship punches
 * into the lane. A gentle camera push (scale ease) keeps both smooth.
 *
 * Two palettes, one law: the spiral is muted Resurrect-64 coral, the only pure accents
 * are the cyan flash and the orange/cyan engine wash. Renders as its own overlay on the
 * shared stage; main.ts swaps to the real phase on `onComplete`. Honors reduced motion.
 */
export type TransitionKind = 'lane-drop' | 'lane-launch';

export interface TransitionAssets {
  /** The player's composited ship (hull + components) — kept in frame, screen-centre. */
  ship: HTMLCanvasElement;
  /** Lane Drop only: the planet that rises into view and the orbit screen inherits. */
  planet?: PlanetDescriptor;
}

export interface Transition {
  /** Cancel without firing onComplete — used when the game tears down mid-transition. */
  cancel(): void;
}

const CX = VIRTUAL_WIDTH / 2;
const CY = VIRTUAL_HEIGHT / 2;
const REACH = Math.max(VIRTUAL_WIDTH, VIRTUAL_HEIGHT) * 0.8; // spiral fills the frame

// Chunky pixel grid — the spiral is drawn as snapped squares so it reads pixel-art,
// extra-chunky on a small (mobile) viewport. Ship/planet keep the world's PX scale.
const CHUNK = 7;
const SHIP_PX = 3;
const SPIRAL_POINTS = 150;
const D_THETA = 0.22; // ~5 turns across the arm
const PLANET_SIZE = 200; // matches the orbit screen so the Drop hands off seamlessly

// Orbit-screen ship/planet poses (mirror orbit-renderer) — the Drop settles here.
const ORBIT_SHIP_X = 128;
const ORBIT_SHIP_Y = VIRTUAL_HEIGHT - 86;

const DROP_MS = 2400;
const LAUNCH_MS = 2500;
const REDUCED_MS = 260;

const STREAK_A = 0xc32454; // coral red (Resurrect 64)
const STREAK_B = 0x8a4276; // muted magenta
const FLASH = 0x6ad1e3; // cyan punch beat
const WASH_WARM = 0xff9e2c; // engine wash (orange)
const WASH_COOL = 0x30e1b9; // engine wash (cyan)
const VOID = 0x05060d;

const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);
const easeInCubic = (t: number): number => t * t * t;
const easeInOut = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const bump = (t: number, lo: number, hi: number): number =>
  t < lo || t > hi ? 0 : Math.sin(((t - lo) / (hi - lo)) * Math.PI);
const clamp01 = (t: number): number => Math.max(0, Math.min(1, t));
const lerp = (a: number, b: number, t: number): number => a + (b - a) * clamp01(t);
const snap = (v: number): number => Math.round(v / CHUNK) * CHUNK;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  );
}

export function playTransition(
  app: Application,
  kind: TransitionKind,
  assets: TransitionAssets,
  onComplete: () => void,
): Transition {
  const isDrop = kind === 'lane-drop';

  const layer = new Container();
  app.stage.addChild(layer);

  const bg = new Graphics().rect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT).fill({ color: VOID });
  layer.addChild(bg);

  // `world` carries the camera push (scale around screen centre); the flash sits above it
  // full-frame so the punch covers the whole viewport regardless of zoom.
  const world = new Container();
  world.position.set(CX, CY);
  world.pivot.set(CX, CY);
  layer.addChild(world);

  const wash = new Graphics();
  wash.blendMode = 'add';
  world.addChild(wash);

  const spiral = new Graphics();
  world.addChild(spiral);

  // The planet rises into view on the Drop, ending at the orbit-screen pose so the
  // handoff is seamless. Rotates with the same generator the orbit screen uses.
  let planet: AnimatedPlanet | null = null;
  let planetSprite: Sprite | null = null;
  if (isDrop && assets.planet !== undefined) {
    planet = createAnimatedPlanet(app, assets.planet, PLANET_SIZE);
    planetSprite = new Sprite(planet.texture);
    planetSprite.anchor.set(0.5);
    planetSprite.position.set(CX, VIRTUAL_HEIGHT + PLANET_SIZE); // starts below frame
    world.addChild(planetSprite);
  }

  const ship = new Sprite(nearestTexture(assets.ship));
  ship.anchor.set(0.5);
  ship.scale.set(SHIP_PX);
  ship.position.set(CX, CY);
  world.addChild(ship);

  const flash = new Graphics().rect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT).fill({ color: FLASH });
  flash.alpha = 0;
  layer.addChild(flash);

  const reduced = prefersReducedMotion();
  const duration = reduced ? REDUCED_MS : isDrop ? DROP_MS : LAUNCH_MS;

  let elapsed = 0;
  let scroll = 0; // radial flow accumulator — outward on launch, inward on drop
  let rot = 0;
  let done = false;

  const finish = (fireComplete: boolean): void => {
    if (done) return;
    done = true;
    app.ticker.remove(tick);
    planet?.destroy();
    layer.destroy({ children: true });
    if (fireComplete) onComplete();
  };

  const drawSpiral = (speed: number, alpha: number): void => {
    spiral.clear();
    if (alpha <= 0.01) return;
    for (let i = 0; i < SPIRAL_POINTS; i++) {
      const f = i / SPIRAL_POINTS;
      const theta = i * D_THETA + rot;
      // Drop pulls the field inward (closing in); launch pushes it outward (rushing away).
      const flow = isDrop ? f - scroll : f + scroll;
      const r = ((flow % 1) + 1) % 1; // 0..1, recycles for continuous flight
      const radius = 26 + r * REACH;
      const x = snap(CX + Math.cos(theta) * radius);
      const y = snap(CY + Math.sin(theta) * radius);
      const fade = r < 0.12 ? r / 0.12 : 1; // born small near the ship, not popping in
      spiral
        .rect(x, y, CHUNK, CHUNK)
        .fill({
          color: i % 2 === 0 ? STREAK_A : STREAK_B,
          alpha: alpha * fade * (0.3 + speed * 0.6),
        });
    }
  };

  const tick = (ticker: Ticker): void => {
    const dt = ticker.deltaMS / 1000;
    elapsed += ticker.deltaMS;
    const t = Math.min(1, elapsed / duration);
    planet?.update(dt);

    if (reduced) {
      // Skip the choreography: settle the Drop's planet/ship pose, just punch the flash.
      if (isDrop && planetSprite !== null) planetSprite.position.set(CX, CY);
      if (isDrop) ship.position.set(ORBIT_SHIP_X, ORBIT_SHIP_Y);
      spiral.clear();
      flash.alpha = Math.sin(t * Math.PI);
      if (t >= 1) finish(true);
      return;
    }

    // speed = spiral intensity; flashA = cyan beat; washA = engine spool; cam = push scale.
    let speed: number;
    let flashA: number;
    let washA = 0;
    let cam: number;
    if (isDrop) {
      // rush in, decelerate to ~0 by 0.7, punch-flash, collapse + settle to orbit pose.
      speed = t < 0.7 ? 1 - easeOutCubic(t / 0.7) * 0.85 : 0.15 * Math.max(0, 1 - (t - 0.7) / 0.3);
      flashA = bump(t, 0.68, 0.84);
      cam = lerp(1.12, 1.0, easeInOut(clamp01(t / 0.9))); // gentle push-out to the orbit frame
      // Settle pose during the collapse so the orbit screen inherits it seamlessly.
      const settle = easeInOut(clamp01((t - 0.62) / 0.38));
      ship.position.set(lerp(CX, ORBIT_SHIP_X, settle), lerp(CY, ORBIT_SHIP_Y, settle));
      if (planetSprite !== null) {
        planetSprite.position.set(CX, lerp(VIRTUAL_HEIGHT + PLANET_SIZE, CY, easeOutCubic(settle)));
      }
    } else {
      // calm spool-up (~0.6s), jump-flash, then bloom outward and accelerate into the lane.
      speed = t < 0.24 ? 0.05 : easeInCubic((t - 0.24) / 0.76);
      washA = bump(t, 0, 0.36) * 0.8;
      flashA = bump(t, 0.6, 0.7);
      cam = lerp(0.96, 1.12, easeInCubic(t)); // push in as the jump accelerates
      ship.position.set(CX, CY - bump(t, 0.55, 1) * 6); // a small forward kick on the punch
    }

    rot += dt * (0.4 + speed * 1.6) * (isDrop ? -1 : 1);
    scroll += dt * (0.15 + speed * 1.1);
    world.scale.set(cam);

    drawSpiral(speed, isDrop ? clamp01(1 - (t - 0.78) / 0.22) : 1);

    wash.clear();
    if (washA > 0) {
      for (let ring = 1; ring <= 3; ring++) {
        wash
          .circle(CX, CY, 46 * ring * (0.6 + speed))
          .fill({ color: ring % 2 === 1 ? WASH_WARM : WASH_COOL, alpha: (washA * 0.16) / ring });
      }
    }

    flash.alpha = flashA;
    if (t >= 1) finish(true);
  };

  app.ticker.add(tick);
  return { cancel: () => finish(false) };
}
