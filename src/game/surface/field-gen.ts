/**
 * Mining Run v2 field generation (ADR-003 / GDD §6.7).
 *
 * Dense staggered 6×11 grid of mineral/hard/rock pegs, plus hardcoded ore bars, Bloom hazards
 * (threatening the central lanes toward the crystal), and a Core Crystal funnelled by inert-rock
 * wedges near the floor. Deterministic from a string seed via the project's seeded RNG.
 *
 * Portrait layout: 360×640 virtual pixels. Pod embedded at top (y≈30); field runs y=90→490;
 * crystal sits near the floor at y≈520. No reachability filter — positions are designed in.
 * Pure sim: no React, Pixi, or DOM.
 */

import { createRng } from '@/game/sim/rng';
import { PEG_HP, PEG_RADIUS } from '@/game/data/mining-run';
import type { CoreBreakerConfig } from './core-breaker';
import { createPeg, defaultConfig } from './core-breaker';
import type { Peg } from './core-breaker';

export interface FieldGenOptions {
  difficulty?: number;
}

// Grid parameters in 360×640 virtual pixels (portrait, matching defaultConfig).
const COLS = 6;
const ROWS = 11;
const GRID_X0 = 35;
const GRID_X1 = 325;
const GRID_Y0 = 90;
const GRID_Y1 = 490;
const SKIP_CHANCE = 0.08;

export function generateField(
  seed: string,
  cfg: CoreBreakerConfig = defaultConfig(),
  opts: FieldGenOptions = {},
): Peg[] {
  const rng = createRng(`mining-field:${seed}:${opts.difficulty ?? 0}`);
  const difficulty = Math.max(0, opts.difficulty ?? 0);
  const cx = cfg.width / 2;

  const pegs: Peg[] = [];
  let id = 0;

  // ── Dense staggered mineral/hard/rock grid ───────────────────────────────
  const colStep = (GRID_X1 - GRID_X0) / (COLS - 1);
  const rowStep = (GRID_Y1 - GRID_Y0) / (ROWS - 1);

  for (let row = 0; row < ROWS; row++) {
    const stagger = row % 2 === 1 ? colStep / 2 : 0;
    for (let col = 0; col < COLS; col++) {
      if (rng.next() < SKIP_CHANCE) continue;
      const jx = (rng.next() - 0.5) * colStep * 0.35;
      const jy = (rng.next() - 0.5) * rowStep * 0.35;
      const x = Math.max(GRID_X0, Math.min(GRID_X1, GRID_X0 + col * colStep + stagger + jx));
      const y = GRID_Y0 + row * rowStep + jy;

      const kind = rollGridKind(rng, difficulty);
      pegs.push(createPeg(id++, x, y, kind, PEG_RADIUS[kind]));
    }
  }

  // ── Ore bars (long horizontal bars spanning lanes) ───────────────────────
  const oreY = [160, 270, 380];
  const oreX = [120, 230, 160];
  for (let i = 0; i < 3; i++) {
    // Use 'ore' kind; the renderer draws it as a wide bar via PEG_ABAR.
    pegs.push(createPeg(id++, oreX[i], oreY[i], 'ore', PEG_RADIUS.ore));
  }

  // ── Bloom hazards (guard the tempting central lanes) ─────────────────────
  const bloomPos: [number, number][] = [
    [120, 200],
    [250, 160],
    [190, 320],
  ];
  for (const [bx, by] of bloomPos) {
    pegs.push(createPeg(id++, bx, by, 'bloom', PEG_RADIUS.bloom));
  }

  // ── Core Crystal + inert-rock funnel ─────────────────────────────────────
  const crystalY = 520;
  pegs.push(createPeg(id++, cx, crystalY, 'crystal', PEG_RADIUS.crystal));
  // Rock wedges funnel the ball toward the crystal.
  const rocks: [number, number][] = [
    [cx - 60, crystalY - 20],
    [cx + 60, crystalY - 18],
    [cx - 28, crystalY + 20],
    [cx + 28, crystalY + 20],
  ];
  for (const [rx, ry] of rocks) {
    pegs.push(createPeg(id++, rx, ry, 'rock', PEG_RADIUS.rock));
  }

  // Initialise HP correctly for each kind.
  for (const peg of pegs) {
    peg.hits = PEG_HP[peg.kind];
    peg.maxHits = PEG_HP[peg.kind];
  }

  return pegs;
}

function rollGridKind(
  rng: ReturnType<typeof createRng>,
  difficulty: number,
): 'mineral' | 'hard' | 'rock' {
  // Increase hard-rock density slightly at higher difficulty.
  const hardChance = 0.22 + difficulty * 0.03;
  const rockChance = 0.1;
  const r = rng.next();
  if (r < rockChance) return 'rock';
  if (r < rockChance + hardChance) return 'hard';
  return 'mineral';
}
