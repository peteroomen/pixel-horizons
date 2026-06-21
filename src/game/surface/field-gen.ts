/**
 * Mining Run v2 field generation (ADR-003 / GDD §6.7).
 *
 * Dense staggered 8×9 grid of mineral/hard/rock pegs, plus hardcoded ore bars, Bloom hazards
 * (threatening the central lanes toward the crystal), and a Core Crystal funnelled by inert-rock
 * wedges at the bottom. Deterministic from a string seed via the project's seeded RNG.
 *
 * No reachability filter — positions are designed in, not randomised to the point of unreachability.
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

// Grid parameters in 640×360 virtual pixels (matching defaultConfig).
const COLS = 8;
const ROWS = 9;
const GRID_X0 = 60;
const GRID_X1 = 580;
const GRID_Y0 = 65;
const GRID_Y1 = 275;
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
  const oreY = [105, 170, 230];
  const oreX = [cx - 130, cx + 90, cx - 30];
  for (let i = 0; i < 3; i++) {
    // Use 'ore' kind; the renderer draws it as a wide bar via PEG_ABAR.
    pegs.push(createPeg(id++, oreX[i], oreY[i], 'ore', PEG_RADIUS.ore));
  }

  // ── Bloom hazards (guard the tempting central lanes) ─────────────────────
  const bloomPos: [number, number][] = [
    [cx - 130, 134],
    [cx + 154, 119],
    [cx + 13, 193],
  ];
  for (const [bx, by] of bloomPos) {
    pegs.push(createPeg(id++, bx, by, 'bloom', PEG_RADIUS.bloom));
  }

  // ── Core Crystal + inert-rock funnel ─────────────────────────────────────
  const crystalY = 258;
  pegs.push(createPeg(id++, cx, crystalY, 'crystal', PEG_RADIUS.crystal));
  // Rock wedges funnel the ball toward the crystal.
  const rocks: [number, number][] = [
    [cx - 68, crystalY - 12],
    [cx + 68, crystalY - 10],
    [cx - 30, crystalY + 18],
    [cx + 30, crystalY + 18],
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
