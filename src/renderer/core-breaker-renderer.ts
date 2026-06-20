/**
 * Core Breaker renderer (CB.4, ADR 011). Draws the deterministic CB.1 sim + CB.2 field, themed
 * from the visited planet's Resurrect 64 ramp (ADR 010), with drag-to-aim/release-to-fire touch
 * input, shatter/drop FX, and a shots/banked HUD. Pixi owns the world; the page owns the shell and
 * passes in the sim pieces (field, bag, shots) + an `onComplete` callback (ADR 001 boundary).
 *
 * The carom physics is NOT re-implemented here — every sub-step goes through `step()` from the
 * sim, so what you see matches what the headless sim would produce for the same shot.
 */

import { Application, Container, Graphics, Rectangle, Text } from 'pixi.js';

import type { Resources } from '@/game/sim/run-state';
import {
  type Ball,
  type CoreBreakerConfig,
  type Peg,
  defaultConfig,
  spawnBall,
  step,
} from '@/game/surface/core-breaker';
import type { BagBall } from '@/game/surface/ball-projection';

import { RESURRECT_64, type Ramp } from './palette';

export interface CoreBreakerOptions {
  /** Field for this drop — mutated as pegs shatter. */
  pegs: Peg[];
  /** Firing order; cycles when emptied. Empty bag ⇒ a default bouncy ball so it stays playable. */
  bag: BagBall[];
  shotsPerDrop: number;
  /** The visited planet's land ramp — the crust/peg theming (ADR 010 / §6.8). */
  landRamp: Ramp;
  cfg?: CoreBreakerConfig;
  onComplete?: (banked: Resources) => void;
}

const MAX_FRAME = 0.05;

// Peg colours: crust-harmonious pegs from the planet ramp; hazard/reward pegs get fixed R64 hues
// so they read by colour AND shape (accessibility — not colour alone), per the design brief.
const ORE_COLOR = hexToNum(RESURRECT_64[31]); // green
const BLOOM_COLOR = hexToNum(RESURRECT_64[53]); // violet — biological hazard
const CRYSTAL_COLOR = hexToNum(RESURRECT_64[44]); // cyan
const BALL_COLOR = 0xf4e9d8;

export interface CoreBreakerHandle {
  destroy(): void;
}

export function createCoreBreakerRenderer(
  app: Application,
  opts: CoreBreakerOptions,
): CoreBreakerHandle {
  const cfg = opts.cfg ?? defaultConfig();
  const ramp = opts.landRamp.map(hexToNum);
  const crust = ramp[5];
  const pegMineral = ramp[2];
  const pegHardrock = ramp[1];

  const initial = opts.pegs.map((p) => ({ ...p }));
  let pegs = opts.pegs;
  const bag = opts.bag.length > 0 ? opts.bag : null;

  let ball: Ball | null = null;
  let bagIndex = 0;
  let shotsLeft = opts.shotsPerDrop;
  const banked: Resources = { scrap: 0, biominerals: 0, coreCrystals: 0, blueprints: 0 };
  let acc = 0;
  let aiming = false;
  let completed = false;
  const aimPoint = { x: cfg.launch.x, y: 150 };
  const bursts: { g: Graphics; life: number }[] = [];

  // ---- Scene -------------------------------------------------------------
  const scene = new Container();
  app.stage.addChild(scene);

  const bg = new Graphics();
  bg.rect(0, 0, cfg.width, cfg.height).fill(crust);
  bg.rect(0, cfg.floorY, cfg.width, cfg.height - cfg.floorY).fill(ramp[4]); // hopper, a shade up
  scene.addChild(bg);

  const fieldGfx = new Graphics();
  scene.addChild(fieldGfx);
  const burstLayer = new Container();
  scene.addChild(burstLayer);
  const aimGfx = new Graphics();
  scene.addChild(aimGfx);
  const ballGfx = new Graphics();
  scene.addChild(ballGfx);

  const launchDot = new Graphics();
  launchDot
    .circle(cfg.launch.x, cfg.launch.y, 4)
    .fill(BALL_COLOR)
    .stroke({ color: 0x10121c, width: 1 });
  scene.addChild(launchDot);

  const hud = new Text({
    text: '',
    style: { fontFamily: 'monospace', fontSize: 9, fill: 0xf4e9d8, lineHeight: 11 },
  });
  hud.position.set(6, 4);
  scene.addChild(hud);

  const banner = new Text({
    text: '',
    style: { fontFamily: 'monospace', fontSize: 13, fill: 0xf4e9d8, align: 'center' },
  });
  banner.anchor.set(0.5);
  banner.position.set(cfg.width / 2, cfg.height / 2);
  scene.addChild(banner);

  // ---- Input (pointer only — touch-first) --------------------------------
  app.stage.eventMode = 'static';
  app.stage.hitArea = new Rectangle(0, 0, cfg.width, cfg.height);

  const toLocal = (e: { global: { x: number; y: number } }) => app.stage.toLocal(e.global);

  const onDown = (e: { global: { x: number; y: number } }): void => {
    if (completed) {
      redrop();
      return;
    }
    if (ball !== null || shotsLeft <= 0) return;
    aiming = true;
    const p = toLocal(e);
    aimPoint.x = p.x;
    aimPoint.y = p.y;
  };
  const onMove = (e: { global: { x: number; y: number } }): void => {
    if (!aiming) return;
    const p = toLocal(e);
    aimPoint.x = p.x;
    aimPoint.y = p.y;
  };
  const onUp = (): void => {
    if (!aiming) return;
    aiming = false;
    if (ball !== null || shotsLeft <= 0) return;
    const type = bag !== null ? bag[bagIndex % bag.length].type : 'bouncy';
    const aim = aimAngleAndPower(aimPoint, cfg);
    ball = spawnBall({ type, angleRad: aim.angle, power: aim.power }, cfg);
    bagIndex += 1;
    shotsLeft -= 1;
  };

  app.stage.on('pointerdown', onDown);
  app.stage.on('pointermove', onMove);
  app.stage.on('pointerup', onUp);
  app.stage.on('pointerupoutside', onUp);

  function redrop(): void {
    pegs = initial.map((p) => ({ ...p }));
    opts.pegs = pegs;
    ball = null;
    bagIndex = 0;
    shotsLeft = opts.shotsPerDrop;
    banked.scrap = banked.biominerals = banked.coreCrystals = banked.blueprints = 0;
    completed = false;
    for (const b of bursts) b.g.destroy();
    bursts.length = 0;
  }

  // ---- Draw --------------------------------------------------------------
  const pegColor = (peg: Peg): number => {
    switch (peg.kind) {
      case 'ore':
        return ORE_COLOR;
      case 'bloom':
        return BLOOM_COLOR;
      case 'crystal':
        return CRYSTAL_COLOR;
      case 'hardrock':
        return pegHardrock;
      default:
        return pegMineral;
    }
  };

  const drawField = (): void => {
    fieldGfx.clear();
    for (const peg of pegs) {
      if (peg.hits <= 0) continue;
      const damaged = peg.maxHits > 1 ? 0.55 + 0.45 * (peg.hits / peg.maxHits) : 1;
      fieldGfx.circle(peg.x, peg.y, peg.r).fill({ color: pegColor(peg), alpha: damaged });
      if (peg.kind === 'crystal') {
        fieldGfx.circle(peg.x, peg.y, peg.r - 3).stroke({ color: 0xf4e9d8, width: 1 });
      } else if (peg.kind === 'bloom') {
        fieldGfx
          .circle(peg.x, peg.y, peg.r + 1)
          .stroke({ color: BLOOM_COLOR, width: 1, alpha: 0.5 });
      }
    }
  };

  const drawAim = (): void => {
    aimGfx.clear();
    if (!aiming || ball !== null || completed) return;
    const aim = aimAngleAndPower(aimPoint, cfg);
    let px = cfg.launch.x;
    let py = cfg.launch.y;
    const vx = Math.cos(aim.angle) * aim.power;
    let vy = Math.sin(aim.angle) * aim.power;
    for (let i = 0; i < 24; i++) {
      for (let s = 0; s < 6; s++) {
        vy += cfg.gravity * cfg.step;
        px += vx * cfg.step;
        py += vy * cfg.step;
      }
      if (py > cfg.floorY || px < 0 || px > cfg.width) break;
      aimGfx.circle(px, py, 1.5).fill({ color: BALL_COLOR, alpha: 0.5 - i * 0.017 });
    }
  };

  const drawBall = (): void => {
    ballGfx.clear();
    if (ball === null) return;
    ballGfx.circle(ball.x, ball.y, ball.r).fill(BALL_COLOR);
  };

  const spawnBurst = (peg: Peg): void => {
    const g = new Graphics();
    const color = pegColor(peg);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      g.circle(peg.x + Math.cos(a) * 3, peg.y + Math.sin(a) * 3, 1.5).fill(color);
    }
    burstLayer.addChild(g);
    bursts.push({ g, life: 0.3 });
  };

  // Yield multiplier of the ball currently in flight (the one most recently fired from the bag).
  const flyingYield = (): number =>
    bag !== null ? bag[(bagIndex - 1 + bag.length) % bag.length].yieldMultiplier : 1;

  // ---- Loop --------------------------------------------------------------
  const tick = (): void => {
    const dt = Math.min(app.ticker.deltaMS / 1000, MAX_FRAME);

    if (ball !== null) {
      acc += dt;
      while (acc >= cfg.step) {
        const ev = step(ball, pegs, cfg);
        const yieldMult = flyingYield();
        for (const id of ev.broken) {
          const peg = pegs.find((p) => p.id === id);
          if (peg) spawnBurst(peg);
        }
        for (const d of ev.drops) {
          banked[d.resource] += Math.round(d.amount * yieldMult);
        }
        acc -= cfg.step;
      }
      if (!ball.live) {
        ball = null;
        acc = 0;
      }
    }

    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i];
      b.life -= dt;
      b.g.alpha = Math.max(0, b.life / 0.3);
      if (b.life <= 0) {
        b.g.destroy();
        bursts.splice(i, 1);
      }
    }

    drawField();
    drawAim();
    drawBall();

    const next = bag !== null ? bag[bagIndex % bag.length].type.toUpperCase() : 'BOUNCY';
    hud.text =
      `SHOTS ${shotsLeft}/${opts.shotsPerDrop}\n` +
      `SCRAP ${banked.scrap}  BIO ${banked.biominerals}  CRYS ${banked.coreCrystals}\n` +
      `NEXT ${next}`;

    if (!completed && shotsLeft <= 0 && ball === null) {
      completed = true;
      opts.onComplete?.({ ...banked });
    }
    banner.text = completed ? `DROP COMPLETE\nbanked ${totalBanked(banked)}\ntap to re-drop` : '';
  };

  app.ticker.add(tick);

  return {
    destroy(): void {
      app.ticker.remove(tick);
      app.stage.off('pointerdown', onDown);
      app.stage.off('pointermove', onMove);
      app.stage.off('pointerup', onUp);
      app.stage.off('pointerupoutside', onUp);
      scene.destroy({ children: true });
    },
  };
}

/** Drag from launch toward the pointer: direction sets angle, drag distance sets power (clamped). */
function aimAngleAndPower(
  aim: { x: number; y: number },
  cfg: CoreBreakerConfig,
): { angle: number; power: number } {
  const dx = aim.x - cfg.launch.x;
  const dy = aim.y - cfg.launch.y;
  const len = Math.hypot(dx, dy) || 1;
  const down = Math.max(dy, 0.25 * len); // never fire up out of the field
  const angle = Math.atan2(down, dx);
  const power = clamp(len * 2.4, 170, 560);
  return { angle, power };
}

function totalBanked(r: Resources): number {
  return r.scrap + r.biominerals + r.coreCrystals + r.blueprints;
}

function hexToNum(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
