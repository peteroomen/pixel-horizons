/**
 * Core Breaker — the deterministic surface physics core (CB.1, ADR 011).
 *
 * A seeded-elsewhere, fixed-timestep, circle-vs-peg simulation: a ball is fired into a field of
 * deposit pegs, caroms off them, shatters them, and emits an ordered stream of resource drops.
 * This is the sim half of the Peglin-style extraction loop that replaced the platformer.
 *
 * Determinism contract (ADR 003): the solver is RNG-free and is driven purely by the fixed
 * `cfg.step` — never wall-clock or frame time. Same field + same shot inputs ⇒ identical
 * break/drop streams. The renderer (CB.4) owns the accumulator that turns real frame time into
 * fixed steps; field layout (the only randomness) is seeded in field-gen (CB.2). Pure sim: no
 * React, Pixi, or DOM imports here.
 */

import type { Resources } from '@/game/sim/run-state';

export type BallType = 'pierce' | 'bouncy' | 'homing' | 'phase';
export type PegKind = 'mineral' | 'ore' | 'hardrock' | 'bloom' | 'crystal';

type ResourceKind = keyof Resources;

export interface Peg {
  id: number;
  x: number;
  y: number;
  r: number;
  kind: PegKind;
  /** Remaining hits before it shatters. */
  hits: number;
  maxHits: number;
}

export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  type: BallType;
  /** True while the shot is in flight. */
  live: boolean;
  /** Why the shot ended (undefined while live). */
  end?: ShotEnd;
  /** Seconds spent below the rest speed threshold (settle detection). */
  lowSpeedTime: number;
  /** A `phase` ball has already passed through one Bloom growth. */
  phaseUsed: boolean;
  /** Per-peg re-hit cooldown (peg id → seconds remaining) so one overlap counts as one hit. */
  cooldown: Map<number, number>;
}

/** A resolved shot — angle (radians, y-down screen space) + launch speed. Input is RNG-free. */
export interface ShotInput {
  type: BallType;
  /** Radians, y-down: ~π/2 fires straight down, 0 right, π left. */
  angleRad: number;
  /** Initial speed, px/s. */
  power: number;
}

export interface CoreBreakerConfig {
  gravity: number;
  restitution: number;
  ballRadius: number;
  width: number;
  height: number;
  /** Y below which the shot ends (ball fell out the bottom into the hopper). */
  floorY: number;
  /** Fixed sub-step seconds — small enough to avoid fast-ball tunneling. */
  step: number;
  /** Where balls spawn. */
  launch: { x: number; y: number };
  /** Hard cap on sub-steps per shot so a pathological shot can't loop forever. */
  maxSteps: number;
}

export interface Drop {
  pegId: number;
  kind: PegKind;
  resource: ResourceKind;
  amount: number;
}

export interface StepEvents {
  /** Peg ids that shattered this step, in resolution order. */
  broken: number[];
  drops: Drop[];
}

export type ShotEnd = 'settled' | 'fellOut' | 'consumed' | 'maxSteps';

export interface ShotResult {
  /** All peg ids shattered over the shot, in break order. */
  brokenPegIds: number[];
  /** Drop stream in break order — banking to RunState is wired in CB.4. */
  drops: Drop[];
  /** Sub-steps the shot ran. */
  steps: number;
  end: ShotEnd;
}

interface PegDef {
  maxHits: number;
  resource: ResourceKind;
  amount: number;
}

/** Peg behaviour table (GDD §6.7, Sector 1). Data, not logic. */
const PEG_DEFS: Record<PegKind, PegDef> = {
  mineral: { maxHits: 1, resource: 'scrap', amount: 1 },
  ore: { maxHits: 3, resource: 'biominerals', amount: 2 },
  hardrock: { maxHits: 2, resource: 'scrap', amount: 1 },
  bloom: { maxHits: 1, resource: 'scrap', amount: 1 },
  crystal: { maxHits: 4, resource: 'coreCrystals', amount: 1 },
};

// Feel constants — inherited from the CB.0 spike; tuned numbers, not gameplay data.
const REST_SPEED = 26; // px/s — below this the ball is "settling"
const REST_TIME = 0.5; // s of continuous low speed before the shot settles
const HIT_COOLDOWN = 0.08; // s before the same peg can be hit again
const PIERCE_DRAG = 0.86; // velocity retained per peg a pierce ball punches through
const HOMING_STEER = 1350; // px/s² steering accel toward the nearest ore peg
const BOUNCY_AOE = 34; // px radius of the bouncy ball's on-rest shatter

export function defaultConfig(): CoreBreakerConfig {
  return {
    gravity: 900,
    restitution: 0.72,
    ballRadius: 6,
    width: 640,
    height: 360,
    floorY: 348,
    step: 1 / 240,
    launch: { x: 320, y: 22 },
    maxSteps: 10_000,
  };
}

export function pegDef(kind: PegKind): PegDef {
  return PEG_DEFS[kind];
}

/** A peg at full health for its kind. */
export function createPeg(id: number, x: number, y: number, kind: PegKind, r: number): Peg {
  const { maxHits } = PEG_DEFS[kind];
  return { id, x, y, r, kind, hits: maxHits, maxHits };
}

/** Fire a ball from the config launch point along `shot`. */
export function spawnBall(shot: ShotInput, cfg: CoreBreakerConfig): Ball {
  return {
    x: cfg.launch.x,
    y: cfg.launch.y,
    vx: Math.cos(shot.angleRad) * shot.power,
    vy: Math.sin(shot.angleRad) * shot.power,
    r: cfg.ballRadius,
    type: shot.type,
    live: true,
    lowSpeedTime: 0,
    phaseUsed: false,
    cooldown: new Map(),
  };
}

/**
 * Advance the ball by exactly one fixed sub-step against `pegs`. Mutates both and returns the
 * pegs shattered this step. Sets `ball.live = false` (+ `ball.end`) when the shot ends. This is
 * the renderer-facing entry point; `simulateShot` wraps it for pure, headless resolution.
 */
export function step(ball: Ball, pegs: Peg[], cfg: CoreBreakerConfig): StepEvents {
  const events: StepEvents = { broken: [], drops: [] };
  if (!ball.live) return events;

  // Decay per-peg cooldowns.
  for (const [pid, t] of ball.cooldown) {
    const next = t - cfg.step;
    if (next <= 0) ball.cooldown.delete(pid);
    else ball.cooldown.set(pid, next);
  }

  // Homing steers toward the nearest alive ore peg at/below it.
  if (ball.type === 'homing') {
    const target = nearestOre(ball, pegs);
    if (target !== null) {
      let sx = target.x - ball.x;
      let sy = target.y - ball.y;
      const sl = Math.hypot(sx, sy) || 1;
      sx /= sl;
      sy /= sl;
      ball.vx += sx * HOMING_STEER * cfg.step;
      ball.vy += sy * HOMING_STEER * cfg.step;
    }
  }

  // Gravity + integrate.
  ball.vy += cfg.gravity * cfg.step;
  ball.x += ball.vx * cfg.step;
  ball.y += ball.vy * cfg.step;

  // Walls — always reflect (the field is bounded; floor is the only exit).
  if (ball.x < ball.r) {
    ball.x = ball.r;
    ball.vx = Math.abs(ball.vx) * cfg.restitution;
  } else if (ball.x > cfg.width - ball.r) {
    ball.x = cfg.width - ball.r;
    ball.vx = -Math.abs(ball.vx) * cfg.restitution;
  }

  // Peg collisions — stable array order for determinism.
  for (const peg of pegs) {
    if (peg.hits <= 0) continue;
    const dx = ball.x - peg.x;
    const dy = ball.y - peg.y;
    const minDist = ball.r + peg.r;
    const d2 = dx * dx + dy * dy;
    if (d2 >= minDist * minDist) continue;

    const d = Math.sqrt(d2) || 0.0001;
    const nx = dx / d;
    const ny = dy / d;
    const onCooldown = ball.cooldown.has(peg.id);

    if (peg.kind === 'bloom') {
      const passes = ball.type === 'pierce' || (ball.type === 'phase' && !ball.phaseUsed);
      if (ball.type === 'phase' && passes) ball.phaseUsed = true;
      if (passes) {
        // Punch/phase through: clear the growth, no reflection.
        if (!onCooldown) {
          registerHit(ball, peg, events);
          if (ball.type === 'pierce') applyPierceDrag(ball);
        }
      } else {
        // Consumed — the shot is wasted (the growth is NOT cleared).
        ball.live = false;
        ball.end = 'consumed';
        return events;
      }
      continue;
    }

    if (ball.type === 'pierce') {
      // Straight shot punches through; bleed speed once per peg, no reflection / correction.
      if (!onCooldown) {
        registerHit(ball, peg, events);
        applyPierceDrag(ball);
      }
    } else {
      // Push out to exactly touching, then reflect with restitution.
      const overlap = minDist - d;
      ball.x += nx * overlap;
      ball.y += ny * overlap;
      const vDotN = ball.vx * nx + ball.vy * ny;
      if (vDotN < 0) {
        const j = (1 + cfg.restitution) * vDotN;
        ball.vx -= j * nx;
        ball.vy -= j * ny;
      }
      if (!onCooldown) registerHit(ball, peg, events);
    }
  }

  // Settle / fall-out.
  const speed = Math.hypot(ball.vx, ball.vy);
  if (speed < REST_SPEED) ball.lowSpeedTime += cfg.step;
  else ball.lowSpeedTime = 0;

  if (ball.y - ball.r > cfg.floorY) {
    ball.live = false;
    ball.end = 'fellOut';
  } else if (ball.lowSpeedTime >= REST_TIME) {
    ball.live = false;
    ball.end = 'settled';
    if (ball.type === 'bouncy') {
      // On-rest AoE shatter — the missile's payoff.
      for (const peg of pegs) {
        if (peg.hits <= 0) continue;
        if (Math.hypot(peg.x - ball.x, peg.y - ball.y) <= BOUNCY_AOE) {
          peg.hits = 0;
          emitDrop(peg, events);
        }
      }
    }
  }

  return events;
}

/**
 * Resolve a whole shot headlessly: spawn the ball and loop `step` until it settles, falls out,
 * is consumed, or hits the step cap. Mutates `pegs` (the field degrades shot to shot, like a real
 * drop). Returns the ordered break/drop stream — this is the determinism-pinned surface.
 */
export function simulateShot(pegs: Peg[], shot: ShotInput, cfg: CoreBreakerConfig): ShotResult {
  const ball = spawnBall(shot, cfg);
  const brokenPegIds: number[] = [];
  const drops: Drop[] = [];
  let steps = 0;

  while (ball.live && steps < cfg.maxSteps) {
    const ev = step(ball, pegs, cfg);
    for (const id of ev.broken) brokenPegIds.push(id);
    for (const d of ev.drops) drops.push(d);
    steps++;
  }

  const end: ShotEnd = ball.live ? 'maxSteps' : (ball.end ?? 'settled');
  return { brokenPegIds, drops, steps, end };
}

function registerHit(ball: Ball, peg: Peg, events: StepEvents): void {
  ball.cooldown.set(peg.id, HIT_COOLDOWN);
  peg.hits -= 1;
  if (peg.hits <= 0) emitDrop(peg, events);
}

function emitDrop(peg: Peg, events: StepEvents): void {
  peg.hits = 0;
  const def = PEG_DEFS[peg.kind];
  events.broken.push(peg.id);
  events.drops.push({ pegId: peg.id, kind: peg.kind, resource: def.resource, amount: def.amount });
}

function applyPierceDrag(ball: Ball): void {
  ball.vx *= PIERCE_DRAG;
  ball.vy *= PIERCE_DRAG;
}

function nearestOre(ball: Ball, pegs: Peg[]): Peg | null {
  let best: Peg | null = null;
  let bestD = Infinity;
  for (const peg of pegs) {
    if (peg.hits <= 0 || peg.kind !== 'ore') continue;
    if (peg.y < ball.y - 8) continue; // only steer toward ore at/below the ball
    const d = (peg.x - ball.x) ** 2 + (peg.y - ball.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = peg;
    }
  }
  return best;
}
