/**
 * Core Breaker field generation (CB.2, ADR 011 / GDD §6.7).
 *
 * Deterministic peg layout from the planet descriptor (run seed + node id → `PlanetDescriptor`,
 * ADR 010). Same descriptor + difficulty ⇒ identical field. Bloom growths are weighted to guard
 * ore/crystal rewards (risk gates reward), and every emitted peg is reachable by at least one
 * launch trajectory (checked headlessly with CB.1's `simulateShot`). Replaces the platformer's
 * `tilemap.ts` chunk grammar. Pure sim: no React/Pixi/DOM.
 */

import type { PlanetDescriptor } from '@/game/sim/planet';
import { createRng, type Rng } from '@/game/sim/rng';

import {
  type CoreBreakerConfig,
  type Peg,
  type PegKind,
  createPeg,
  defaultConfig,
  pegDef,
  simulateShot,
} from './core-breaker';

export interface FieldGenOptions {
  /** 0 = Sector 1 baseline; higher = denser, richer (more ore/crystal), more Bloom guards. */
  difficulty?: number;
}

const PEG_R = 7;
const COLS = 8;
const BASE_ROWS = 6;
const MARGIN_X = 44;
const TOP_HALF_WIDTH = 96; // reachable horizontal half-span at the top of the funnel
const FIELD_TOP = 64;
const FIELD_BOTTOM = 300;

// Reachability probe fan — angles span the downward arc, powers span near/far.
const PROBE_ANGLES = 9;
const PROBE_POWERS = [240, 360, 500, 660] as const;

/** Deterministic Sector-1 field for a planet. */
export function generateField(
  descriptor: PlanetDescriptor,
  cfg: CoreBreakerConfig = defaultConfig(),
  opts: FieldGenOptions = {},
): Peg[] {
  const difficulty = Math.max(0, opts.difficulty ?? 0);
  const rng = createRng(`core-breaker-field:${descriptor.seed}:${descriptor.type}:${difficulty}`);

  const rows = BASE_ROWS + Math.min(difficulty, 4);
  const rowH = (FIELD_BOTTOM - FIELD_TOP) / (rows - 1);
  const centerX = cfg.width / 2;

  const pegs: Peg[] = [];
  let id = 0;
  for (let r = 0; r < rows; r++) {
    const depth01 = rows === 1 ? 0 : r / (rows - 1);
    // Funnel: narrow near the launch point (only the centre is reachable), full width by the floor.
    const halfWidth = lerp(TOP_HALF_WIDTH, cfg.width / 2 - MARGIN_X, depth01);
    const colW = (halfWidth * 2) / (COLS - 1);
    const offset = r % 2 === 0 ? 0 : colW / 2;
    for (let c = 0; c < COLS; c++) {
      // Occasional gaps keep the field from reading as a rigid lattice.
      if (rng.next() < 0.12) continue;
      const jx = (rng.next() - 0.5) * colW * 0.4;
      const jy = (rng.next() - 0.5) * rowH * 0.4;
      const x = clamp(
        centerX - halfWidth + colW * c + offset + jx,
        PEG_R * 2,
        cfg.width - PEG_R * 2,
      );
      const y = FIELD_TOP + rowH * r + jy;
      pegs.push(createPeg(id++, x, y, rollKind(rng, difficulty, depth01), PEG_R));
    }
  }

  addBloomGuards(pegs, rng, difficulty);

  // Invariant: never emit a peg no trajectory can touch (GDD §6.7 — all reachable).
  return pegs.filter((peg) => isReachable(peg, cfg));
}

/**
 * Can any launch trajectory contact this peg's position? Tested in isolation (a fresh 1-hit peg,
 * no neighbours) over a fan of pierce shots — i.e. is the location geometrically reachable, before
 * other pegs add deflections. Used as the field-gen invariant + its test.
 */
export function isReachable(peg: Peg, cfg: CoreBreakerConfig = defaultConfig()): boolean {
  for (const power of PROBE_POWERS) {
    for (let a = 0; a < PROBE_ANGLES; a++) {
      const t = a / (PROBE_ANGLES - 1);
      const angleRad = (0.18 + 0.64 * t) * Math.PI; // span the downward arc, left→right
      const probe = [createPeg(peg.id, peg.x, peg.y, 'mineral', peg.r)];
      const res = simulateShot(probe, { type: 'pierce', angleRad, power }, cfg);
      if (res.brokenPegIds.includes(peg.id)) return true;
    }
  }
  return false;
}

function rollKind(rng: Rng, difficulty: number, depth01: number): PegKind {
  const mineral = 55;
  const hardrock = 20;
  const ore = 16 + difficulty * 3;
  const crystal = 2 + difficulty;
  const total = mineral + hardrock + ore + crystal;

  let roll = rng.next() * total;
  if ((roll -= mineral) < 0) return 'mineral';
  if ((roll -= hardrock) < 0) return 'hardrock';
  if ((roll -= ore) < 0) return 'ore';
  // Crystals only deep in the field; a shallow crystal roll becomes ore.
  return depth01 >= 0.55 ? 'crystal' : 'ore';
}

/**
 * Convert a plain peg sitting above some ore/crystal rewards into a Bloom growth, so reaching the
 * reward means clearing or piercing a hazard first (GDD §6.7 "Bloom weighted to guard ore/crystal").
 */
function addBloomGuards(pegs: Peg[], rng: Rng, difficulty: number): void {
  const guardProb = Math.min(0.85, 0.4 + difficulty * 0.1);
  const rewards = pegs.filter((p) => p.kind === 'ore' || p.kind === 'crystal');
  const bloom = pegDef('bloom');

  for (const reward of rewards) {
    if (rng.next() > guardProb) continue;
    let best: Peg | null = null;
    let bestD = Infinity;
    for (const p of pegs) {
      if (p === reward || (p.kind !== 'mineral' && p.kind !== 'hardrock')) continue;
      if (p.y >= reward.y) continue; // must sit on the entry (upper) side of the reward
      const d = (p.x - reward.x) ** 2 + (p.y - reward.y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    if (best !== null && bestD <= 60 * 60) {
      best.kind = 'bloom';
      best.maxHits = bloom.maxHits;
      best.hits = bloom.maxHits;
    }
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
