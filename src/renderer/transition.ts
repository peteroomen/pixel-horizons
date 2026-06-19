import { Application, Container, Graphics, type Ticker } from 'pixi.js';

import { VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from './pixel-scale';

/**
 * Scene transitions (6.9, slice A): the reversible hyperspace seam. One warp-streak
 * timeline plays decelerating for the **Lane Drop** (hyperspace → orbit, on planet
 * arrival) and accelerating for the **Lane Launch** (node → hyperspace, on departure).
 * Two palettes, one law: the streak field is muted Resurrect-64 coral; the only pure
 * accents are the cyan punch flash and the orange/cyan engine wash, fired on their beat.
 *
 * Renders as its own overlay on the shared stage (the previous mode is already torn
 * down by main.ts), runs off the app ticker, and calls `onComplete` once — where main.ts
 * swaps to the real phase. Honors prefers-reduced-motion with a short flash-cut.
 */
export type TransitionKind = 'lane-drop' | 'lane-launch';

export interface Transition {
  /** Cancel without firing onComplete — used when the game tears down mid-transition. */
  cancel(): void;
}

const CX = VIRTUAL_WIDTH / 2;
const CY = VIRTUAL_HEIGHT / 2;
const STREAK_COUNT = 64;
const MAX_LEN = Math.hypot(VIRTUAL_WIDTH, VIRTUAL_HEIGHT) / 2; // streaks can reach the corners

const DROP_MS = 2400;
const LAUNCH_MS = 2500;
const REDUCED_MS = 220;

// Resurrect-64 coral lane field (muted, the "place"); cyan + orange are the pure beats.
const STREAK_A = 0xc32454; // coral red
const STREAK_B = 0x8a4276; // muted magenta
const FLASH = 0x6ad1e3; // cyan punch-out / punch-in
const WASH_WARM = 0xff9e2c; // engine wash (orange)
const WASH_COOL = 0x30e1b9; // engine wash (cyan)
const VOID = 0x05060d;

const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);
const easeInCubic = (t: number): number => t * t * t;
const bump = (t: number, lo: number, hi: number): number =>
  t < lo || t > hi ? 0 : Math.sin(((t - lo) / (hi - lo)) * Math.PI);

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  );
}

interface Streak {
  angle: number;
  /** Per-streak 0..1 offset so the field doesn't pulse in lockstep. */
  offset: number;
  color: number;
}

export function playTransition(
  app: Application,
  kind: TransitionKind,
  onComplete: () => void,
): Transition {
  const layer = new Container();
  app.stage.addChild(layer);

  const bg = new Graphics().rect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT).fill({ color: VOID });
  layer.addChild(bg);

  const wash = new Graphics();
  wash.blendMode = 'add';
  layer.addChild(wash);

  const streaks = new Graphics();
  layer.addChild(streaks);

  const flash = new Graphics().rect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT).fill({ color: FLASH });
  flash.alpha = 0;
  layer.addChild(flash);

  // Deterministic streak field — a cheap index hash, never Math.random (sim determinism
  // aside, the renderer keeps the same discipline).
  const field: Streak[] = [];
  for (let i = 0; i < STREAK_COUNT; i++) {
    const offset = ((i * 2654435761) >>> 0) / 0xffffffff;
    field.push({
      angle: (i / STREAK_COUNT) * Math.PI * 2 + (i % 3) * 0.05,
      offset,
      color: i % 2 === 0 ? STREAK_A : STREAK_B,
    });
  }

  const reduced = prefersReducedMotion();
  const duration = reduced ? REDUCED_MS : kind === 'lane-drop' ? DROP_MS : LAUNCH_MS;

  let elapsed = 0;
  let scroll = 0; // accumulates so streaks fly outward (warp), faster as speed rises
  let done = false;

  const finish = (fireComplete: boolean): void => {
    if (done) return;
    done = true;
    app.ticker.remove(tick);
    layer.destroy({ children: true });
    if (fireComplete) onComplete();
  };

  const tick = (ticker: Ticker): void => {
    elapsed += ticker.deltaMS;
    const t = Math.min(1, elapsed / duration);

    if (reduced) {
      flash.alpha = Math.sin(t * Math.PI); // a single cyan beat, no streaks
      if (t >= 1) finish(true);
      return;
    }

    // speed = streak intensity 0..1; flashA = cyan beat; washA = engine spool-up (launch).
    let speed: number;
    let flashA: number;
    let washA = 0;
    if (kind === 'lane-drop') {
      // rush in fast, decelerate to a near-stop by ~0.7, punch-flash, collapse away.
      speed = t < 0.7 ? 1 - easeOutCubic(t / 0.7) * 0.82 : 0.18 * Math.max(0, 1 - (t - 0.7) / 0.3);
      flashA = bump(t, 0.7, 0.86);
    } else {
      // calm spool-up (~0.6s), then accelerate the funnel outward into the jump.
      speed = t < 0.24 ? 0.04 : easeInCubic((t - 0.24) / 0.76);
      washA = bump(t, 0, 0.34) * 0.7;
      flashA = bump(t, 0.6, 0.7);
    }

    scroll += (ticker.deltaMS / 1000) * (0.25 + speed * 2.4);
    const len = MAX_LEN * (0.1 + speed * 0.9);

    streaks.clear();
    for (const s of field) {
      const f = (s.offset + scroll) % 1; // 0..1, recycles → continuous outward flight
      const near = 14 + f * 70;
      const far = near + len;
      const cos = Math.cos(s.angle);
      const sin = Math.sin(s.angle);
      streaks
        .moveTo(CX + cos * near, CY + sin * near)
        .lineTo(CX + cos * far, CY + sin * far)
        .stroke({ width: 2, color: s.color, alpha: 0.2 + speed * 0.6 });
    }

    wash.clear();
    if (washA > 0) {
      for (let r = 1; r <= 3; r++) {
        wash
          .circle(CX, CY, 44 * r * (0.6 + speed))
          .fill({ color: r % 2 === 1 ? WASH_WARM : WASH_COOL, alpha: (washA * 0.16) / r });
      }
    }

    flash.alpha = flashA;
    if (t >= 1) finish(true);
  };

  app.ticker.add(tick);
  return { cancel: () => finish(false) };
}
