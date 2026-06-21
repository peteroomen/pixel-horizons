/**
 * Mining Run v2 — ball physics core (ADR-003 / GDD §6).
 *
 * Fixed-timestep circle-vs-formation sim. Determinism contract: same field + same shots ⇒
 * identical break/drop streams. No bounce budget — a ball runs until it falls past the floor
 * (fellOut) or is consumed by a Bloom (consumed). The settle path acts as a safety valve only.
 * Mineral drops are first-class physics objects that auto-magnet back to the pod at the top.
 *
 * Pure sim: no React, Pixi, or DOM.
 */

export type BallType = 'standard' | 'heavy' | 'split' | 'drill' | 'ghost';
export type PegKind = 'mineral' | 'ore' | 'hard' | 'crystal' | 'rock' | 'bloom';

type ResourceKind = 'scrap' | 'biominerals' | 'coreCrystals';

export interface Peg {
  id: number;
  x: number;
  y: number;
  /** Collision radius (circular for all kinds except ore, which uses box). */
  r: number;
  kind: PegKind;
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
  live: boolean;
  end?: ShotEnd;
  /** Safety-valve: seconds spent below REST_SPEED. */
  lowSpeedTime: number;
  /** True once a split ball has already forked — prevents infinite splitting. */
  didSplit: boolean;
  /** Per-peg re-hit cooldown (id → seconds remaining). */
  cooldown: Map<number, number>;
}

export interface MineralDrop {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  resource: ResourceKind;
  amount: number;
  live: boolean;
}

export interface ShotInput {
  type: BallType;
  angleRad: number;
  power: number;
}

export interface CoreBreakerConfig {
  gravity: number;
  restitution: number;
  width: number;
  height: number;
  floorY: number;
  step: number;
  launch: { x: number; y: number };
  maxSteps: number;
  /**
   * Y coordinate of the pod — now at the TOP of the screen, embedded in the planet surface.
   * Balls fire downward from here; mineral drops float back up and are collected here.
   */
  podY: number;
}

export interface Drop {
  pegId: number;
  kind: PegKind;
  resource: ResourceKind;
  amount: number;
}

export interface StepEvents {
  broken: number[];
  drops: Drop[];
  /** New balls to add to the sim (spawned by split fork). */
  spawned: Ball[];
  /** New mineral drops emitted by shattering formations this step. */
  newMinerals: MineralDrop[];
}

export interface MineralStepResult {
  caught: Drop[];
  lost: number[];
}

export type ShotEnd = 'settled' | 'fellOut' | 'consumed' | 'maxSteps';

export interface ShotResult {
  brokenPegIds: number[];
  drops: Drop[];
  steps: number;
  end: ShotEnd;
}

// ─── Formation definitions ────────────────────────────────────────────────────

interface PegDef {
  maxHits: number;
  resource: ResourceKind | null;
  amount: number;
  /** If true, drop resource on every hit, not just on shatter. */
  dropPerHit: boolean;
}

const PEG_DEFS: Record<PegKind, PegDef> = {
  mineral: { maxHits: 1, resource: 'biominerals', amount: 1, dropPerHit: false },
  hard: { maxHits: 1, resource: 'scrap', amount: 1, dropPerHit: false },
  ore: { maxHits: 3, resource: 'biominerals', amount: 2, dropPerHit: true },
  crystal: { maxHits: 4, resource: 'coreCrystals', amount: 1, dropPerHit: false },
  rock: { maxHits: 2, resource: null, amount: 0, dropPerHit: false },
  bloom: { maxHits: 99, resource: null, amount: 0, dropPerHit: false },
};

// Ore bar box collision half-extents (matches data/mining-run.ts PEG_ABAR).
const ORE_HW = 26;
const ORE_HH = 7;

// Safety-valve constants — not gameplay limits, just prevent stuck-ball loops.
const REST_SPEED = 20; // px/s
const REST_TIME = 1.5; // seconds of continuous low speed before settling
const HIT_COOLDOWN = 0.08; // seconds before the same peg counts as hit again

let _nextMineralId = 0;

// ─── Public API ──────────────────────────────────────────────────────────────

export function defaultConfig(): CoreBreakerConfig {
  return {
    gravity: 900,
    restitution: 0.72,
    width: 360,
    height: 640,
    floorY: 628,
    step: 1 / 240,
    launch: { x: 180, y: 30 },
    maxSteps: 10_000,
    podY: 30,
  };
}

export function pegDef(kind: PegKind): PegDef {
  return PEG_DEFS[kind];
}

export function createPeg(id: number, x: number, y: number, kind: PegKind, r: number): Peg {
  const { maxHits } = PEG_DEFS[kind];
  return { id, x, y, r, kind, hits: maxHits, maxHits };
}

export function spawnBall(shot: ShotInput, cfg: CoreBreakerConfig): Ball {
  return {
    x: cfg.launch.x,
    y: cfg.launch.y,
    vx: Math.cos(shot.angleRad) * shot.power,
    vy: Math.sin(shot.angleRad) * shot.power,
    r: ballRadius(shot.type),
    type: shot.type,
    live: true,
    lowSpeedTime: 0,
    didSplit: false,
    cooldown: new Map(),
  };
}

/**
 * Advance one fixed sub-step. Mutates ball and pegs; returns events for this step.
 */
export function step(ball: Ball, pegs: Peg[], cfg: CoreBreakerConfig): StepEvents {
  const events: StepEvents = {
    broken: [],
    drops: [],
    spawned: [],
    newMinerals: [],
  };
  if (!ball.live) return events;

  // Decay per-peg cooldowns.
  for (const [id, t] of ball.cooldown) {
    const next = t - cfg.step;
    if (next <= 0) ball.cooldown.delete(id);
    else ball.cooldown.set(id, next);
  }

  // Integrate.
  ball.vy += cfg.gravity * cfg.step;
  ball.x += ball.vx * cfg.step;
  ball.y += ball.vy * cfg.step;

  // Walls.
  if (ball.x < ball.r) {
    ball.x = ball.r;
    ball.vx = Math.abs(ball.vx) * cfg.restitution;
  } else if (ball.x > cfg.width - ball.r) {
    ball.x = cfg.width - ball.r;
    ball.vx = -Math.abs(ball.vx) * cfg.restitution;
  }

  // Floor / fell out.
  if (ball.y - ball.r > cfg.floorY) {
    ball.live = false;
    ball.end = 'fellOut';
    return events;
  }

  // Formation collisions.
  for (const peg of pegs) {
    if (peg.hits <= 0) continue;

    // ── Bloom: consumes all non-ghost balls; ghost passes through harmlessly ──
    if (peg.kind === 'bloom') {
      if (ball.type !== 'ghost') {
        const pr = peg.r;
        const dx = ball.x - peg.x;
        const dy = ball.y - peg.y;
        if (dx * dx + dy * dy < (ball.r + pr) * (ball.r + pr)) {
          ball.live = false;
          ball.end = 'consumed';
          return events;
        }
      }
      // Ghost passes through bloom without deflecting or damaging it.
      continue;
    }

    // ── Ore bar: box collision ─────────────────────────────────────────────
    let nx: number, ny: number, overlap: number, overlapping: boolean;
    if (peg.kind === 'ore') {
      const qx = Math.max(peg.x - ORE_HW, Math.min(ball.x, peg.x + ORE_HW));
      const qy = Math.max(peg.y - ORE_HH, Math.min(ball.y, peg.y + ORE_HH));
      const ddx = ball.x - qx;
      const ddy = ball.y - qy;
      const dd = Math.hypot(ddx, ddy) || 0.001;
      overlapping = dd < ball.r;
      nx = ddx / dd;
      ny = ddy / dd;
      overlap = ball.r - dd;
    } else {
      // ── Circular collision ───────────────────────────────────────────────
      const dx = ball.x - peg.x;
      const dy = ball.y - peg.y;
      const min = ball.r + peg.r;
      const d2 = dx * dx + dy * dy;
      overlapping = d2 < min * min;
      if (overlapping) {
        const d = Math.sqrt(d2) || 0.001;
        nx = dx / d;
        ny = dy / d;
        overlap = min - d;
      } else {
        nx = 0;
        ny = 0;
        overlap = 0;
      }
    }

    if (!overlapping) {
      ball.cooldown.delete(peg.id);
      continue;
    }

    const onCooldown = ball.cooldown.has(peg.id);

    // Ghost deflects off nothing (it passes through all formations).
    // Drill deflects only off rock.
    const deflect = ball.type !== 'ghost' && !(ball.type === 'drill' && peg.kind !== 'rock');

    if (deflect) {
      ball.x += nx * (overlap + 0.5);
      ball.y += ny * (overlap + 0.5);
      const vDotN = ball.vx * nx + ball.vy * ny;
      if (vDotN < 0) {
        const j = (1 + cfg.restitution) * vDotN;
        ball.vx -= j * nx;
        ball.vy -= j * ny;
      }
    }

    if (!onCooldown) {
      ball.cooldown.set(peg.id, HIT_COOLDOWN);
      const damage = ball.type === 'heavy' ? 2 : 1;
      registerHit(ball, peg, damage, events);

      // Split fork: spawn a sibling on the first formation contact.
      if (ball.type === 'split' && !ball.didSplit) {
        ball.didSplit = true;
        const forkAngle = Math.atan2(ball.vy, ball.vx) + 0.45;
        const speed = Math.hypot(ball.vx, ball.vy);
        events.spawned.push({
          x: ball.x,
          y: ball.y,
          vx: Math.cos(forkAngle) * speed,
          vy: Math.sin(forkAngle) * speed,
          r: ball.r,
          type: 'split',
          live: true,
          lowSpeedTime: 0,
          didSplit: true,
          cooldown: new Map(),
        });
      }
    }
  }

  // Safety-valve settle detection.
  const speed = Math.hypot(ball.vx, ball.vy);
  if (speed < REST_SPEED) ball.lowSpeedTime += cfg.step;
  else ball.lowSpeedTime = 0;

  if (ball.lowSpeedTime >= REST_TIME) {
    ball.live = false;
    ball.end = 'settled';
  }

  return events;
}

const MINERAL_MAGNET = 700; // px/s² toward pod
const MINERAL_MAX_SPEED = 320; // px/s cap

/**
 * Advance mineral drops one sub-step.
 * Drops are pulled toward the pod at the top of the screen (podY ≈ 30).
 * Auto-collected when close enough to the pod; never fall past the floor.
 */
export function stepMinerals(
  minerals: MineralDrop[],
  podX: number,
  cfg: CoreBreakerConfig,
): MineralStepResult {
  const result: MineralStepResult = { caught: [], lost: [] };
  for (const m of minerals) {
    if (!m.live) continue;
    const dx = podX - m.x;
    const dy = cfg.podY - m.y; // negative ⇒ upward
    const dist = Math.hypot(dx, dy) + 1;
    m.vx += (dx / dist) * MINERAL_MAGNET * cfg.step;
    m.vy += (dy / dist) * MINERAL_MAGNET * cfg.step;
    const spd = Math.hypot(m.vx, m.vy);
    if (spd > MINERAL_MAX_SPEED) {
      m.vx = (m.vx / spd) * MINERAL_MAX_SPEED;
      m.vy = (m.vy / spd) * MINERAL_MAX_SPEED;
    }
    m.x += m.vx * cfg.step;
    m.y += m.vy * cfg.step;

    if (m.y <= cfg.podY + 15) {
      m.live = false;
      result.caught.push({ pegId: -1, kind: 'mineral', resource: m.resource, amount: m.amount });
      continue;
    }
    // Safety — should not happen with magnet active, but guards against edge cases.
    if (m.y > cfg.floorY + 12) {
      m.live = false;
      result.lost.push(m.id);
    }
  }
  return result;
}

/**
 * Headless full-shot resolver — runs `step` until the ball settles/falls/maxSteps.
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ballRadius(type: BallType): number {
  const R: Record<BallType, number> = {
    standard: 6,
    heavy: 8,
    split: 6,
    drill: 5,
    ghost: 6,
  };
  return R[type];
}

function registerHit(ball: Ball, peg: Peg, damage: number, events: StepEvents): void {
  const was = peg.hits;
  peg.hits = Math.max(0, peg.hits - damage);
  const def = PEG_DEFS[peg.kind];

  // Ore drops a mineral on every hit (the "rich vein" mechanic).
  if (def.dropPerHit && def.resource !== null && peg.hits < was) {
    const drop: Drop = {
      pegId: peg.id,
      kind: peg.kind,
      resource: def.resource,
      amount: def.amount,
    };
    events.drops.push(drop);
    events.newMinerals.push(spawnMineral(peg, drop));
  }

  if (peg.hits <= 0) {
    events.broken.push(peg.id);
    if (!def.dropPerHit && def.resource !== null) {
      const drop: Drop = {
        pegId: peg.id,
        kind: peg.kind,
        resource: def.resource,
        amount: def.amount,
      };
      events.drops.push(drop);
      events.newMinerals.push(spawnMineral(peg, drop));
    }
  }

  void ball; // ball param reserved for future use (e.g. crystal scatter)
}

function spawnMineral(peg: Peg, drop: Drop): MineralDrop {
  return {
    id: _nextMineralId++,
    x: peg.x + (Math.random() - 0.5) * 8,
    y: peg.y,
    vx: (Math.random() - 0.5) * 30,
    vy: -40 - Math.random() * 30,
    resource: drop.resource,
    amount: drop.amount,
    live: true,
  };
}
