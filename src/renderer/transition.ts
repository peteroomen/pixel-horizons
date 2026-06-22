import { Application, Container, Graphics, Sprite, type Ticker } from 'pixi.js';

import type { PlanetDescriptor } from '@/game/sim/planet';
import { type AnimatedPlanet, createAnimatedPlanet } from './planet';
import { nearestTexture } from './textures';

/**
 * Scene transitions (6.9): the hyperspace seam and the orbit→surface pod drop.
 *
 * **Lane Drop** (`lane-drop`, 2.4s): hyperspace → orbit. The coral spiral decelerates,
 * a cyan punch-flash, the planet rises to the orbit pose — the orbit screen appears
 * seamlessly behind the flash. **Lane Launch** (`lane-launch`, 2.5s): orbit/node →
 * hyperspace. Engine wash spools up, cyan jump-flash, the spiral blooms outward and
 * accelerates into the lane. Both share a two-arm pixelated spiral (muted R64 coral)
 * and a gentle camera push. **Drop Pod Deploy** (`pod-deploy`, 3.6s): orbit → surface.
 * Scene A holds on the ship as the pod detaches and shrinks toward the planet; at
 * atmosphere contact an amber heat-glow peaks and fills frame (masks the cut); Scene B
 * rides the pod down — streak in, retro-burn, 1-frame red impact flash + 3 px camera
 * shake, ramp drops, onComplete → enterSurface.
 *
 * Two palettes, one law: the scene is Resurrect 64; only the five FOUNDRY accents fire
 * on their beat (cyan drop/jump flash, orange engine wash, amber re-entry, red impact).
 * Honors `prefers-reduced-motion`. Renders as a full-screen overlay on the shared stage;
 * main.ts swaps to the real phase on `onComplete`.
 */
export type TransitionKind = 'lane-drop' | 'lane-launch' | 'pod-deploy';

export interface TransitionAssets {
  /** The player's composited ship (hull + components) — shown in frame during transitions. */
  ship: HTMLCanvasElement;
  /** Lane Drop + Pod Deploy: the planet that rises into / fills the orbit view. */
  planet?: PlanetDescriptor;
  /** Pod Deploy only: the sealed pod shell (podLaunchSprite from surface-sprites). */
  pod?: HTMLCanvasElement;
}

export interface Transition {
  /** Cancel without firing onComplete — used when the game tears down mid-transition. */
  cancel(): void;
}

// Chunky pixel grid — the spiral is drawn as CHUNK-snapped squares so it reads pixel-art.
const CHUNK = 7;
const SHIP_PX = 3;
// Two interleaved spiral arms (each 140 points) → 280 total; fills the frame with no gaps.
const SPIRAL_POINTS = 140;
const D_THETA = 0.22;
const PLANET_SIZE = 200; // matches orbit-renderer so the Drop hands off seamlessly

const DROP_MS = 2400;
const LAUNCH_MS = 2500;
const POD_DEPLOY_MS = 3600;
const REDUCED_MS = 260;

const STREAK_A = 0xc32454; // coral red (Resurrect 64)
const STREAK_B = 0x8a4276; // muted magenta
const FLASH = 0x6ad1e3; // cyan punch beat (lane drop/launch)
const WASH_WARM = 0xff9e2c; // engine wash / retro-burn (orange)
const WASH_COOL = 0x30e1b9; // engine wash (cyan)
const AMBER = 0xffb454; // atmosphere re-entry heat (pod-deploy A→B wipe)
const IMPACT_RED = 0xff4757; // touchdown flash (pod-deploy impact beat)
const VOID = 0x05060d;

// Pod Deploy phase breakpoints in normalised t (0..1 over POD_DEPLOY_MS):
const PD_DETACH = 0.194; // pod detaches from ship  (0.7 s of 3.6 s)
const PD_A_END = 0.361; // end of orbit Scene A    (1.3 s)
const PD_AB_END = 0.556; // end of amber wipe A→B  (2.0 s)
const PD_B_END = 0.778; // end of descent Scene B  (2.8 s)
const PD_IMPACT_END = 0.833; // end of impact beat (3.0 s)
// Settle: PD_IMPACT_END → 1.0 (3.0–3.6 s)

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
  virtW: number,
  virtH: number,
): Transition {
  // Compute layout constants from the portrait virtual dimensions.
  const CX = virtW / 2;
  const CY = virtH / 2;
  const REACH = Math.max(virtW, virtH) * 0.8;
  // Orbit-screen ship/planet poses — mirror orbit-renderer so the Drop hands off seamlessly.
  const ORBIT_SHIP_X = Math.round(virtW * 0.22);
  const ORBIT_SHIP_Y = Math.round(virtH * 0.82);

  const isDrop = kind === 'lane-drop';
  const isPodDeploy = kind === 'pod-deploy';

  const layer = new Container();
  app.stage.addChild(layer);

  const bg = new Graphics().rect(0, 0, virtW, virtH).fill({ color: VOID });
  layer.addChild(bg);

  // `world` carries the camera push (scale around screen centre) and the impact shake
  // (position offset). The amber wipe and flash quads live above it so they're full-frame.
  const world = new Container();
  world.position.set(CX, CY);
  world.pivot.set(CX, CY);
  layer.addChild(world);

  const wash = new Graphics();
  wash.blendMode = 'add';
  world.addChild(wash);

  const spiral = new Graphics();
  world.addChild(spiral);

  // Planet: Lane Drop rises it from below; Pod Deploy shows it already in the orbit centre.
  let planet: AnimatedPlanet | null = null;
  let planetSprite: Sprite | null = null;
  if ((isDrop || isPodDeploy) && assets.planet !== undefined) {
    planet = createAnimatedPlanet(app, assets.planet, PLANET_SIZE);
    planetSprite = new Sprite(planet.texture);
    planetSprite.anchor.set(0.5);
    planetSprite.position.set(
      CX,
      isDrop ? virtH + PLANET_SIZE : CY, // Lane Drop: below frame; Pod Deploy: orbit centre
    );
    world.addChild(planetSprite);
  }

  // Pod sprite — Pod Deploy Scene A (shrinks toward planet) and Scene B (streaks in nose-down).
  let podSprite: Sprite | null = null;
  if (isPodDeploy && assets.pod !== undefined) {
    podSprite = new Sprite(nearestTexture(assets.pod));
    podSprite.anchor.set(0.5);
    podSprite.scale.set(0.6);
    podSprite.position.set(ORBIT_SHIP_X + 14, ORBIT_SHIP_Y - 8);
    podSprite.alpha = 0;
    world.addChild(podSprite);
  }

  const ship = new Sprite(nearestTexture(assets.ship));
  ship.anchor.set(0.5);
  ship.scale.set(SHIP_PX);
  // Pod Deploy: ship starts at orbit pose (Scene A); Lane transitions: ship at screen centre.
  ship.position.set(isPodDeploy ? ORBIT_SHIP_X : CX, isPodDeploy ? ORBIT_SHIP_Y : CY);
  ship.alpha = isPodDeploy ? 0 : 1;
  world.addChild(ship);

  // Amber wipe — pod-deploy A→B heat-glow (above world, below cyan/red flashes).
  const amberLayer = new Graphics().rect(0, 0, virtW, virtH).fill({ color: AMBER });
  amberLayer.alpha = 0;
  layer.addChild(amberLayer);

  // Cyan punch flash — lane Drop/Launch beat.
  const flash = new Graphics().rect(0, 0, virtW, virtH).fill({ color: FLASH });
  flash.alpha = 0;
  layer.addChild(flash);

  // Red impact flash — pod-deploy touchdown beat.
  const impactFlash = new Graphics().rect(0, 0, virtW, virtH).fill({ color: IMPACT_RED });
  impactFlash.alpha = 0;
  layer.addChild(impactFlash);

  const reduced = prefersReducedMotion();
  const duration = reduced
    ? REDUCED_MS
    : isPodDeploy
      ? POD_DEPLOY_MS
      : isDrop
        ? DROP_MS
        : LAUNCH_MS;

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

  // Two-arm spiral: arm 1 at `rot`, arm 2 at `rot + π` — continuous tunnel, no gaps.
  const drawSpiral = (speed: number, alpha: number): void => {
    spiral.clear();
    if (alpha <= 0.01) return;
    for (let arm = 0; arm < 2; arm++) {
      const thetaOff = arm * Math.PI;
      for (let i = 0; i < SPIRAL_POINTS; i++) {
        const f = i / SPIRAL_POINTS;
        const theta = i * D_THETA + rot + thetaOff;
        const flow = isDrop ? f - scroll : f + scroll;
        const r = ((flow % 1) + 1) % 1; // 0..1, recycles for continuous flight
        const radius = 26 + r * REACH;
        const x = snap(CX + Math.cos(theta) * radius);
        const y = snap(CY + Math.sin(theta) * radius);
        const fade = r < 0.12 ? r / 0.12 : 1; // born small near ship, not popping in
        spiral.rect(x, y, CHUNK, CHUNK).fill({
          color: i % 2 === 0 ? STREAK_A : STREAK_B,
          alpha: alpha * fade * (0.3 + speed * 0.6),
        });
      }
    }
  };

  const tick = (ticker: Ticker): void => {
    const dt = ticker.deltaMS / 1000;
    elapsed += ticker.deltaMS;
    const t = Math.min(1, elapsed / duration);
    planet?.update(dt);

    // ── Pod Deploy timeline ───────────────────────────────────────────────────
    if (isPodDeploy) {
      if (reduced) {
        // Collapse to a quick amber fade-in / fade-out cut — no long animation.
        amberLayer.alpha = t < 0.5 ? t * 2 : (1 - t) * 2;
        if (t >= 1) finish(true);
        return;
      }

      // Default: world at orbit scale with no camera push; shake is applied in impact phase.
      world.scale.set(1);
      world.position.set(CX, CY);
      spiral.clear();

      if (t < PD_A_END) {
        // Scene A: orbit view — ship + planet + pod detaches and falls toward planet.
        const at = t / PD_A_END; // 0..1 within phase A
        const detachNorm = PD_DETACH / PD_A_END; // detach point in phase-A-local t

        ship.alpha = at < 0.1 ? at / 0.1 : 1;
        ship.position.set(ORBIT_SHIP_X, ORBIT_SHIP_Y);
        if (planetSprite !== null) planetSprite.alpha = 1;

        if (podSprite !== null) {
          if (at < detachNorm) {
            // Docked: fade in near the ship.
            const dockT = at / detachNorm;
            podSprite.position.set(ORBIT_SHIP_X + 14, ORBIT_SHIP_Y - 8);
            podSprite.scale.set(0.6);
            podSprite.alpha = dockT < 0.4 ? dockT / 0.4 : 1;
            podSprite.rotation = 0;
          } else {
            // Detached: fall toward planet centre, shrinking.
            const fallT = (at - detachNorm) / (1 - detachNorm);
            const eased = easeInCubic(fallT);
            podSprite.position.set(
              lerp(ORBIT_SHIP_X + 14, CX, eased),
              lerp(ORBIT_SHIP_Y - 8, CY, eased),
            );
            podSprite.scale.set(lerp(0.6, 0.12, fallT));
            podSprite.alpha = 1;
            podSprite.rotation = 0;
          }
        }

        // Brief retro-puff when detaching.
        wash.clear();
        const puffWindow = 0.12;
        if (at >= detachNorm && at < detachNorm + puffWindow) {
          const puffT = (at - detachNorm) / puffWindow;
          wash
            .circle(ORBIT_SHIP_X + 14, ORBIT_SHIP_Y - 8, 12 * puffT)
            .fill({ color: WASH_WARM, alpha: (1 - puffT) * 0.55 });
        }

        flash.alpha = 0;
        amberLayer.alpha = 0;
        impactFlash.alpha = 0;
      } else if (t < PD_AB_END) {
        // A→B wipe: amber heat-glow expands from planet edge and peaks to fill frame.
        const wipeT = (t - PD_A_END) / (PD_AB_END - PD_A_END);
        const eWipe = easeInOut(wipeT);

        ship.alpha = Math.max(0, 1 - easeInCubic(wipeT * 1.2));
        ship.position.set(ORBIT_SHIP_X, ORBIT_SHIP_Y);
        if (planetSprite !== null) planetSprite.alpha = Math.max(0, 1 - easeInCubic(wipeT * 1.4));

        if (podSprite !== null) {
          // Pod shrinks to a mote as the wipe takes over.
          podSprite.scale.set(lerp(0.12, 0.04, wipeT));
          podSprite.position.set(lerp(CX, CX, wipeT), lerp(CY, CY + 20, wipeT));
          podSprite.alpha = Math.max(0, 1 - wipeT * 1.8);
          podSprite.rotation = 0;
        }

        // Amber glow radiates from planet centre outward.
        wash.clear();
        for (let ring = 3; ring >= 1; ring--) {
          wash
            .circle(CX, CY, virtH * eWipe * 0.85 * ring * 0.45)
            .fill({ color: AMBER, alpha: (eWipe * 0.18) / ring });
        }

        amberLayer.alpha = easeInCubic(wipeT);
        flash.alpha = 0;
        impactFlash.alpha = 0;
      } else if (t < PD_B_END) {
        // Scene B: pod streaks in from above on dark background.
        const bT = (t - PD_AB_END) / (PD_B_END - PD_AB_END);

        amberLayer.alpha = Math.max(0, lerp(1, 0, easeOutCubic(bT * 1.4)));

        ship.alpha = 0;
        if (planetSprite !== null) planetSprite.alpha = 0;

        if (podSprite !== null) {
          // Pod enters from off-screen top and decelerates to the landing zone.
          const podScale = lerp(1.2, 2.8, bT);
          const podY = lerp(-30, CY + 20, easeOutCubic(clamp01(bT * 1.3)));
          podSprite.position.set(CX, podY);
          podSprite.scale.set(podScale);
          podSprite.alpha = 1;
          podSprite.rotation = Math.PI; // nose-down descent

          // Amber heat trail extends above the pod (in the direction it came from).
          const podHalfH = 26 * podScale; // half of 52-px sprite at current scale
          const trailLen = lerp(20, 90, bT);
          wash.clear();
          wash
            .rect(CX - 3, podY - podHalfH - trailLen, 6, trailLen)
            .fill({ color: AMBER, alpha: Math.min(1, bT * 1.5) * 0.55 });

          // Orange retro-burn glow above pod (thrusters fire up to brake descent).
          if (bT > 0.45) {
            const retroT = (bT - 0.45) / 0.55;
            wash
              .circle(CX, podY - podHalfH - 4, 10 + 8 * retroT)
              .fill({ color: WASH_WARM, alpha: retroT * 0.65 });
          }
        } else {
          wash.clear();
        }

        flash.alpha = 0;
        impactFlash.alpha = 0;
      } else if (t < PD_IMPACT_END) {
        // Impact: 1-frame red flash + 3 px deterministic camera shake.
        const impT = (t - PD_B_END) / (PD_IMPACT_END - PD_B_END);

        impactFlash.alpha = Math.max(0, 1 - easeOutCubic(impT));

        // Shake decays to zero as impact fades.
        const shakeAmp = 3 * (1 - impT);
        world.position.set(
          CX + Math.sin(elapsed * 0.11) * shakeAmp,
          CY + Math.cos(elapsed * 0.09) * shakeAmp,
        );

        if (podSprite !== null) {
          podSprite.position.set(CX, CY + 20);
          podSprite.scale.set(2.8);
          podSprite.alpha = 1;
          podSprite.rotation = Math.PI;
        }

        ship.alpha = 0;
        if (planetSprite !== null) planetSprite.alpha = 0;
        amberLayer.alpha = 0;
        flash.alpha = 0;
        wash.clear();
      } else {
        // Settle: fade pod out, then onComplete → enterSurface.
        const settleT = (t - PD_IMPACT_END) / (1 - PD_IMPACT_END);

        impactFlash.alpha = 0;
        flash.alpha = 0;
        amberLayer.alpha = 0;
        world.position.set(CX, CY);
        ship.alpha = 0;
        if (planetSprite !== null) planetSprite.alpha = 0;
        wash.clear();

        if (podSprite !== null) {
          podSprite.position.set(CX, CY + 20);
          podSprite.scale.set(2.8);
          podSprite.rotation = Math.PI;
          podSprite.alpha = Math.max(0, 1 - easeOutCubic(settleT));
        }
      }

      if (t >= 1) finish(true);
      return;
    }

    // ── Lane Drop / Lane Launch timeline ─────────────────────────────────────
    if (reduced) {
      // Settle the Drop's planet/ship pose under the flash so the orbit screen
      // inherits them without a jump, then punch the flash.
      if (isDrop && planetSprite !== null) planetSprite.position.set(CX, CY);
      if (isDrop) ship.position.set(ORBIT_SHIP_X, ORBIT_SHIP_Y);
      spiral.clear();
      flash.alpha = Math.sin(t * Math.PI);
      amberLayer.alpha = 0;
      impactFlash.alpha = 0;
      if (t >= 1) finish(true);
      return;
    }

    // speed = spiral intensity; flashA = cyan beat; washA = engine spool; cam = push scale.
    let speed: number;
    let flashA: number;
    let washA = 0;
    let cam: number;
    if (isDrop) {
      // Rush in, decelerate to ~0 by 0.7, punch-flash, collapse + settle to orbit pose.
      speed = t < 0.7 ? 1 - easeOutCubic(t / 0.7) * 0.85 : 0.15 * Math.max(0, 1 - (t - 0.7) / 0.3);
      flashA = bump(t, 0.68, 0.84);
      cam = lerp(1.12, 1.0, easeInOut(clamp01(t / 0.9)));
      // Settle pose during the collapse so the orbit screen inherits it seamlessly.
      const settle = easeInOut(clamp01((t - 0.62) / 0.38));
      ship.position.set(lerp(CX, ORBIT_SHIP_X, settle), lerp(CY, ORBIT_SHIP_Y, settle));
      if (planetSprite !== null) {
        planetSprite.position.set(CX, lerp(virtH + PLANET_SIZE, CY, easeOutCubic(settle)));
      }
    } else {
      // Calm spool-up (~0.6s), jump-flash, then bloom outward and accelerate into the lane.
      speed = t < 0.24 ? 0.05 : easeInCubic((t - 0.24) / 0.76);
      washA = bump(t, 0, 0.36) * 0.8;
      flashA = bump(t, 0.6, 0.7);
      cam = lerp(0.96, 1.12, easeInCubic(t));
      ship.position.set(CX, CY - bump(t, 0.55, 1) * 6); // small forward kick on the punch
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
    amberLayer.alpha = 0;
    impactFlash.alpha = 0;
    if (t >= 1) finish(true);
  };

  app.ticker.add(tick);
  return { cancel: () => finish(false) };
}
