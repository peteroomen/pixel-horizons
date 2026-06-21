/**
 * Mining Run v2 renderer (ADR-003). PixiJS-powered portrait physics loop:
 * the pod is embedded at the top of the planet surface and fires balls downward.
 * Mineral drops auto-magnet back up to the pod — no player input during flight.
 *
 * Phases:
 *  'aim'  — drag down from the pod rig to set trajectory.
 *  'play' — ball in flight; minerals floating up; no player input.
 *  'complete' — run ended; onComplete is fired with the banked haul.
 *
 * Physics lives entirely in core-breaker.ts; this file drives the accumulator,
 * renders state, and owns pointer input.
 */

import { Application, Container, Graphics, Text } from 'pixi.js';

import type { Resources } from '@/game/sim/run-state';
import {
  type CoreBreakerConfig,
  type Peg,
  type Ball,
  type MineralDrop,
  defaultConfig,
  spawnBall,
  step,
  stepMinerals,
} from '@/game/surface/core-breaker';
import type { RosterBall } from '@/game/surface/ball-projection';
import { RESURRECT_64, type Ramp } from './palette';

export interface CoreBreakerOptions {
  pegs: Peg[];
  roster: RosterBall[];
  landRamp: Ramp;
  cfg?: CoreBreakerConfig;
  onComplete?: (banked: Resources) => void;
}

export interface CoreBreakerHandle {
  destroy(): void;
}

const MAX_FRAME = 0.05;
const RUN_DURATION = 180;

// Fixed formation colours — same meaning across all planet ramps (read by silhouette AND colour).
const C_ORE = hexNum(RESURRECT_64[31]); // green
const C_BLOOM = hexNum(RESURRECT_64[53]); // violet
const C_CRYSTAL = hexNum(RESURRECT_64[44]); // cyan
const C_ROCK = 0x54607e;

// Ball colours per type.
const BALL_COLORS: Record<string, number> = {
  standard: 0xe6904e,
  heavy: 0xcd683d,
  split: 0x9aa6c9,
  drill: 0x239aa6,
  ghost: 0x0b8a8f,
};

export function createCoreBreakerRenderer(
  app: Application,
  opts: CoreBreakerOptions,
): CoreBreakerHandle {
  const cfg = opts.cfg ?? defaultConfig();
  const ramp = opts.landRamp.map(hexNum);
  const crust = ramp[5];
  const mineral = ramp[2];
  const hard = ramp[1];

  // Mutable sim state.
  const initialPegs: Peg[] = opts.pegs.map((p) => ({ ...p }));
  let pegs: Peg[] = opts.pegs;
  const roster = opts.roster;

  let balls: Ball[] = [];
  let minerals: MineralDrop[] = [];
  let rosterIdx = 0;
  let phase: 'aim' | 'play' | 'complete' = 'aim';
  let haul: Resources = { scrap: 0, biominerals: 0, coreCrystals: 0, blueprints: 0 };
  let timer = RUN_DURATION;
  let acc = 0;
  let completed = false;

  // Aim state — player drags downward from the pod to set angle.
  let aiming = false;
  let aimDragging = false;
  const aimPt = { x: cfg.launch.x, y: cfg.launch.y + 80 };

  // ── Scene ──────────────────────────────────────────────────────────────────
  const scene = new Container();
  app.stage.addChild(scene);

  const bgGfx = new Graphics();
  const fieldGfx = new Graphics();
  const mineralGfx = new Graphics();
  const aimGfx = new Graphics();
  const ballGfx = new Graphics();
  const podGfx = new Graphics();
  const rigGfx = new Graphics();
  scene.addChild(bgGfx, fieldGfx, mineralGfx, aimGfx, ballGfx, podGfx, rigGfx);

  const hud = new Text({
    text: '',
    style: { fontFamily: 'monospace', fontSize: 9, fill: 0xf4e9d8, lineHeight: 11 },
  });
  hud.position.set(6, 4);
  scene.addChild(hud);

  const flash = new Text({
    text: '',
    style: { fontFamily: 'monospace', fontSize: 12, fill: 0xff9e2c, align: 'center' },
  });
  flash.anchor.set(0.5);
  flash.position.set(cfg.width / 2, cfg.height / 2 - 40);
  flash.alpha = 0;
  scene.addChild(flash);

  // ── Input ──────────────────────────────────────────────────────────────────
  app.stage.eventMode = 'static';
  app.stage.hitArea = { contains: () => true } as never;

  const toLocal = (e: { global: { x: number; y: number } }) => app.stage.toLocal(e.global);

  const onDown = (e: { global: { x: number; y: number } }): void => {
    if (completed) {
      redrop();
      return;
    }
    const p = toLocal(e);
    if (phase === 'aim') {
      aiming = aimDragging = true;
      aimPt.x = p.x;
      aimPt.y = p.y;
    }
  };

  const onMove = (e: { global: { x: number; y: number } }): void => {
    const p = toLocal(e);
    if (aimDragging) {
      aimPt.x = p.x;
      aimPt.y = p.y;
    }
  };

  const onUp = (): void => {
    if (!aimDragging) return;
    aimDragging = false;
    if (phase !== 'aim' || roster.length === 0) return;
    const type = roster[rosterIdx % roster.length].type;
    const aim = computeAim(aimPt, cfg);
    const ball = spawnBall({ type, angleRad: aim.angle, power: aim.power }, cfg);
    balls.push(ball);
    phase = 'play';
    aimGfx.clear();
  };

  app.stage.on('pointerdown', onDown);
  app.stage.on('pointermove', onMove);
  app.stage.on('pointerup', onUp);
  app.stage.on('pointerupoutside', onUp);

  // ── Helpers ────────────────────────────────────────────────────────────────
  function setFlash(text: string): void {
    flash.text = text;
    flash.alpha = 1;
  }

  function advanceTurn(): void {
    rosterIdx++;
    if (rosterIdx >= roster.length) {
      endRun();
    } else {
      phase = 'aim';
      setFlash('PROBE LOST');
    }
  }

  function endRun(): void {
    if (completed) return;
    completed = true;
    phase = 'complete';
    setFlash('MINING COMPLETE');
    opts.onComplete?.({ ...haul });
  }

  function redrop(): void {
    pegs = initialPegs.map((p) => ({ ...p }));
    opts.pegs = pegs;
    balls = [];
    minerals = [];
    rosterIdx = 0;
    haul = { scrap: 0, biominerals: 0, coreCrystals: 0, blueprints: 0 };
    timer = RUN_DURATION;
    phase = 'aim';
    completed = false;
    acc = 0;
    flash.alpha = 0;
  }

  // ── Draw helpers ───────────────────────────────────────────────────────────
  const pegColor = (peg: Peg): number => {
    switch (peg.kind) {
      case 'ore':
        return C_ORE;
      case 'bloom':
        return C_BLOOM;
      case 'crystal':
        return C_CRYSTAL;
      case 'rock':
        return C_ROCK;
      case 'hard':
        return hard;
      default:
        return mineral;
    }
  };

  function drawBg(): void {
    bgGfx.clear();
    // Underground rock fill.
    bgGfx.rect(0, 0, cfg.width, cfg.height).fill(ramp[4]);
    // Planet surface band at the top (where the pod is embedded).
    bgGfx.rect(0, 0, cfg.width, cfg.podY + 14).fill(crust);
    // Surface edge line.
    bgGfx.rect(0, cfg.podY + 14, cfg.width, 2).fill(ramp[3]);
  }

  function drawField(): void {
    fieldGfx.clear();
    for (const peg of pegs) {
      if (peg.hits <= 0) continue;
      const col = pegColor(peg);
      const alpha = peg.maxHits > 1 ? 0.5 + 0.5 * (peg.hits / peg.maxHits) : 1;
      if (peg.kind === 'ore') {
        // Ore renders as a wide horizontal bar.
        const hw = 26,
          hh = 7;
        fieldGfx.rect(peg.x - hw, peg.y - hh, hw * 2, hh * 2).fill({ color: col, alpha });
        fieldGfx
          .rect(peg.x - hw, peg.y - hh, hw * 2, hh * 2)
          .stroke({ color: 0xffffff, alpha: 0.2, width: 1 });
      } else {
        fieldGfx.circle(peg.x, peg.y, peg.r).fill({ color: col, alpha });
        if (peg.kind === 'crystal') {
          fieldGfx.circle(peg.x, peg.y, peg.r - 3).stroke({ color: 0xf4e9d8, width: 1 });
        } else if (peg.kind === 'bloom') {
          fieldGfx.circle(peg.x, peg.y, peg.r + 2).stroke({ color: C_BLOOM, width: 1, alpha: 0.5 });
        }
      }
    }
  }

  function drawMinerals(): void {
    mineralGfx.clear();
    for (const m of minerals) {
      if (!m.live) continue;
      const col =
        m.resource === 'biominerals'
          ? 0x91db69
          : m.resource === 'coreCrystals'
            ? 0x6ad1e3
            : 0x9aa0ad;
      mineralGfx.rect(m.x - 2, m.y - 2, 4, 4).fill(col);
    }
  }

  function drawAim(): void {
    aimGfx.clear();
    if (phase !== 'aim' || !aiming || roster.length === 0) return;
    const aim = computeAim(aimPt, cfg);
    let px = cfg.launch.x,
      py = cfg.launch.y;
    const vx = Math.cos(aim.angle) * aim.power;
    let vy = Math.sin(aim.angle) * aim.power;
    for (let i = 0; i < 28; i++) {
      for (let s = 0; s < 6; s++) {
        vy += cfg.gravity * cfg.step;
        px += vx * cfg.step;
        py += vy * cfg.step;
      }
      if (py > cfg.floorY || px < 0 || px > cfg.width) break;
      aimGfx.circle(px, py, 1.5).fill({ color: 0xf4e9d8, alpha: 0.45 - i * 0.013 });
    }
  }

  function drawBalls(): void {
    ballGfx.clear();
    for (const b of balls) {
      if (!b.live) continue;
      const col = BALL_COLORS[b.type] ?? 0xf4e9d8;
      const alpha = b.type === 'ghost' ? 0.55 : 1;
      ballGfx.circle(b.x, b.y, b.r).fill({ color: col, alpha });
    }
  }

  function drawRig(): void {
    // Pod is embedded in the planet surface at the top, launching downward.
    podGfx.clear();
    rigGfx.clear();
    const lx = cfg.launch.x;
    const ly = cfg.launch.y;
    // Surface housing (wider band).
    podGfx.rect(lx - 22, 0, 44, ly + 10).fill(crust);
    podGfx.rect(lx - 18, ly - 2, 36, 12).fill(0x3a3e48);
    // Launch tube pointing downward.
    rigGfx.rect(lx - 5, ly, 10, 18).fill(0x2e2c38);
    // Barrel tip + aim glow.
    if (phase === 'aim' && aiming) {
      const aim = computeAim(aimPt, cfg);
      const tx = lx + Math.cos(aim.angle) * 10;
      const ty = ly + 18 + Math.sin(aim.angle) * 6;
      rigGfx.circle(tx, ty, 2.5).fill(0x6ad1e3);
    } else if (phase === 'aim') {
      rigGfx.circle(lx, ly + 20, 2.5).fill({ color: 0x6ad1e3, alpha: 0.65 });
    }
  }

  function drawHUD(): void {
    const cur = roster[rosterIdx];
    const ahead = roster.slice(rosterIdx + 1);
    const line1 = cur
      ? `ARMED ${cur.type.toUpperCase().padEnd(8)} QUEUE +${ahead.length}`
      : 'RUN COMPLETE';
    const line2 = `SCRAP ${haul.scrap}  BIO ${haul.biominerals}  CORE ${haul.coreCrystals}`;
    const secs = Math.ceil(timer);
    const line3 = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
    hud.text = `${line1}\n${line2}\n${line3}`;
  }

  // ── Tick ──────────────────────────────────────────────────────────────────
  const tick = (): void => {
    const dt = Math.min(app.ticker.deltaMS / 1000, MAX_FRAME);

    if (!completed) {
      timer = Math.max(0, timer - dt);
      if (timer <= 0) endRun();
    }

    if (phase === 'play') {
      acc += dt;
      while (acc >= cfg.step) {
        // Step all live balls.
        const toAdd: Ball[] = [];
        for (const b of balls) {
          if (!b.live) continue;
          const ev = step(b, pegs, cfg);
          for (const d of ev.drops) {
            haul[d.resource] += Math.round(d.amount * (roster[rosterIdx]?.yieldMultiplier ?? 1));
          }
          for (const m of ev.newMinerals) minerals.push(m);
          for (const s of ev.spawned) toAdd.push(s);
        }
        for (const b of toAdd) balls.push(b);

        // Step minerals — magnet target is the fixed pod center.
        const mr = stepMinerals(minerals, cfg.launch.x, cfg);
        for (const d of mr.caught) haul[d.resource] += d.amount;

        acc -= cfg.step;
      }

      // Prune dead balls.
      balls = balls.filter((b) => b.live);
      minerals = minerals.filter((m) => m.live);

      // Turn resolution: all balls + minerals settled.
      if (balls.length === 0 && minerals.length === 0) {
        advanceTurn();
      }
    }

    // Fade flash text.
    if (flash.alpha > 0) flash.alpha = Math.max(0, flash.alpha - dt * 0.8);

    drawBg();
    drawField();
    drawMinerals();
    drawAim();
    drawBalls();
    drawRig();
    drawHUD();
  };

  app.ticker.add(tick);
  drawBg();
  drawField();

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Compute aim angle + power from where the user dragged on screen. */
function computeAim(
  pt: { x: number; y: number },
  cfg: CoreBreakerConfig,
): { angle: number; power: number } {
  const dx = pt.x - cfg.launch.x;
  const dy = pt.y - cfg.launch.y;
  const len = Math.hypot(dx, dy) || 1;
  // Clamp to downward hemisphere — never let the ball fire upward out of the field.
  const downY = Math.max(dy, 0.25 * len);
  const angle = Math.atan2(downY, dx);
  const power = clamp(len * 2.4, 170, 560);
  return { angle, power };
}

function hexNum(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
