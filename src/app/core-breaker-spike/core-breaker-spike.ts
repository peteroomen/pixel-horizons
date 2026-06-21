/**
 * THROWAWAY — CB.0 Core Breaker feel prototype (`/core-breaker-spike`). Not the real sim.
 *
 * Hand-rolled 2D circle-vs-peg physics, NON-deterministic on purpose: `Math.random()` is used
 * for field layout here only. The real deterministic, seeded, fixed-timestep core lands in CB.1
 * as `src/game/surface/core-breaker.ts`. Delete this whole folder when CB.4 wires the real loop.
 *
 * Pure module: no Pixi, no React, no DOM. The page imports it and only draws what it returns.
 */

export type BallType = 'pierce' | 'bouncy' | 'homing';

export interface Vec {
  x: number;
  y: number;
}

export interface Peg {
  id: number;
  x: number;
  y: number;
  r: number;
  /** Remaining hits before it shatters (1 = single-hit). */
  hits: number;
  maxHits: number;
  /** Ore pegs are the homing target + worth more. */
  ore: boolean;
  alive: boolean;
}

export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  type: BallType;
  /** True while the shot is in flight; false once it settles or falls out the floor. */
  live: boolean;
  /** Seconds spent below the rest speed threshold (settle detection). */
  lowSpeedTime: number;
  /** Per-peg re-hit cooldown (peg id → seconds remaining) so one overlap = one hit. */
  cooldown: Map<number, number>;
}

export interface Knobs {
  gravity: number;
  restitution: number;
  ballRadius: number;
  pegRadius: number;
  pegCount: number;
  launchPower: number;
  wallBounce: boolean;
  shotsPerDrop: number;
  width: number;
  height: number;
  /** Y below which the shot ends (ball fell out the bottom). */
  floorY: number;
}

export const LAUNCH: Vec = { x: 320, y: 22 };

const FIELD_TOP = 72;
const FIELD_BOTTOM = 320;
const REST_SPEED = 26; // px/s — below this the ball is "settling"
const REST_TIME = 0.5; // s of low speed before the shot ends
const HIT_COOLDOWN = 0.08; // s before the same peg can be hit again
const PIERCE_DRAG = 0.86; // velocity retained per peg a pierce ball punches through
const HOMING_STEER = 1350; // px/s² steering accel toward the nearest ore peg
const BOUNCY_AOE = 34; // px radius of the bouncy ball's on-rest shatter

export function defaultKnobs(): Knobs {
  return {
    gravity: 900,
    restitution: 0.72,
    ballRadius: 6,
    pegRadius: 7,
    pegCount: 46,
    launchPower: 300,
    wallBounce: true,
    shotsPerDrop: 9,
    width: 640,
    height: 360,
    floorY: 348,
  };
}

/** Jittered grid of pegs; ~20% ore (multi-hit, worth more), a few hardrock (2-hit). */
export function buildField(knobs: Knobs): Peg[] {
  const pegs: Peg[] = [];
  const cols = 8;
  const colW = knobs.width / (cols + 1);
  const rows = Math.ceil(knobs.pegCount / cols);
  const rowH = (FIELD_BOTTOM - FIELD_TOP) / rows;
  let id = 0;
  for (let r = 0; r < rows && pegs.length < knobs.pegCount; r++) {
    // Offset alternate rows for a denser, more carom-friendly packing.
    const offset = r % 2 === 0 ? 0 : colW / 2;
    for (let c = 0; c < cols && pegs.length < knobs.pegCount; c++) {
      const jx = (Math.random() - 0.5) * colW * 0.45;
      const jy = (Math.random() - 0.5) * rowH * 0.45;
      const x = colW * (c + 1) + offset + jx;
      const y = FIELD_TOP + rowH * (r + 0.5) + jy;
      if (x < knobs.pegRadius * 2 || x > knobs.width - knobs.pegRadius * 2) continue;
      const roll = Math.random();
      const ore = roll < 0.2;
      const hard = !ore && roll < 0.35;
      const maxHits = ore ? 3 : hard ? 2 : 1;
      pegs.push({ id: id++, x, y, r: knobs.pegRadius, hits: maxHits, maxHits, ore, alive: true });
    }
  }
  return pegs;
}

/** Fire a ball from the launch point toward `aim`, with speed scaled by drag distance. */
export function spawnBall(type: BallType, aim: Vec, knobs: Knobs): Ball {
  let dx = aim.x - LAUNCH.x;
  let dy = aim.y - LAUNCH.y;
  const len = Math.hypot(dx, dy) || 1;
  dx /= len;
  dy /= len;
  // Drag distance → power, clamped. Always fire at least somewhat downward so it enters the field.
  const speed = clamp(len * 2.4, knobs.launchPower * 0.55, knobs.launchPower * 1.8);
  const downBias = Math.max(dy, 0.25); // never fire straight up out of the field
  const nlen = Math.hypot(dx, downBias) || 1;
  return {
    x: LAUNCH.x,
    y: LAUNCH.y,
    vx: (dx / nlen) * speed,
    vy: (downBias / nlen) * speed,
    r: knobs.ballRadius,
    type,
    live: true,
    lowSpeedTime: 0,
    cooldown: new Map(),
  };
}

/**
 * Advance one fixed sub-step. Mutates `ball` and `pegs`. Returns the ids of pegs that shattered
 * this step (for the renderer's burst FX). When the shot ends, sets `ball.live = false`.
 */
export function stepPhysics(ball: Ball, pegs: Peg[], knobs: Knobs, dt: number): number[] {
  if (!ball.live) return [];
  const shattered: number[] = [];

  // Decay per-peg cooldowns.
  for (const [pid, t] of ball.cooldown) {
    const next = t - dt;
    if (next <= 0) ball.cooldown.delete(pid);
    else ball.cooldown.set(pid, next);
  }

  // Homing steers toward the nearest alive ore peg ahead of it.
  if (ball.type === 'homing') {
    const target = nearestOre(ball, pegs);
    if (target !== null) {
      let sx = target.x - ball.x;
      let sy = target.y - ball.y;
      const sl = Math.hypot(sx, sy) || 1;
      sx /= sl;
      sy /= sl;
      ball.vx += sx * HOMING_STEER * dt;
      ball.vy += sy * HOMING_STEER * dt;
    }
  }

  // Gravity + integrate.
  ball.vy += knobs.gravity * dt;
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  // Walls.
  if (ball.x < ball.r) {
    ball.x = ball.r;
    ball.vx = knobs.wallBounce ? Math.abs(ball.vx) * knobs.restitution : 0;
  } else if (ball.x > knobs.width - ball.r) {
    ball.x = knobs.width - ball.r;
    ball.vx = knobs.wallBounce ? -Math.abs(ball.vx) * knobs.restitution : 0;
  }

  // Peg collisions.
  for (const peg of pegs) {
    if (!peg.alive) continue;
    const dx = ball.x - peg.x;
    const dy = ball.y - peg.y;
    const minDist = ball.r + peg.r;
    const d2 = dx * dx + dy * dy;
    if (d2 >= minDist * minDist) continue;

    const d = Math.sqrt(d2) || 0.0001;
    const nx = dx / d;
    const ny = dy / d;

    const onCooldown = ball.cooldown.has(peg.id);
    if (!onCooldown) {
      ball.cooldown.set(peg.id, HIT_COOLDOWN);
      peg.hits -= 1;
      if (peg.hits <= 0) {
        peg.alive = false;
        shattered.push(peg.id);
      }
    }

    if (ball.type === 'pierce') {
      // Punch straight through; bleed a little speed, no reflection, no positional correction.
      ball.vx *= PIERCE_DRAG;
      ball.vy *= PIERCE_DRAG;
    } else {
      // Push the ball back out to exactly touching, then reflect with restitution.
      const overlap = minDist - d;
      ball.x += nx * overlap;
      ball.y += ny * overlap;
      const vDotN = ball.vx * nx + ball.vy * ny;
      if (vDotN < 0) {
        const j = (1 + knobs.restitution) * vDotN;
        ball.vx -= j * nx;
        ball.vy -= j * ny;
      }
    }
  }

  // Settle / fall-out detection.
  const speed = Math.hypot(ball.vx, ball.vy);
  if (speed < REST_SPEED) ball.lowSpeedTime += dt;
  else ball.lowSpeedTime = 0;

  if (ball.y - ball.r > knobs.floorY) {
    ball.live = false;
  } else if (ball.lowSpeedTime >= REST_TIME) {
    ball.live = false;
    if (ball.type === 'bouncy') {
      // On-rest AoE shatter — the missile's payoff.
      for (const peg of pegs) {
        if (!peg.alive) continue;
        if (Math.hypot(peg.x - ball.x, peg.y - ball.y) <= BOUNCY_AOE) {
          peg.hits = 0;
          peg.alive = false;
          shattered.push(peg.id);
        }
      }
    }
  }

  return shattered;
}

function nearestOre(ball: Ball, pegs: Peg[]): Peg | null {
  let best: Peg | null = null;
  let bestD = Infinity;
  for (const peg of pegs) {
    if (!peg.alive || !peg.ore) continue;
    if (peg.y < ball.y - 8) continue; // only steer toward ore at/below the ball
    const d = (peg.x - ball.x) ** 2 + (peg.y - ball.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = peg;
    }
  }
  return best;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
