/**
 * Core Breaker tunables (data only — no logic; ADR 011 / GDD §6.3–6.9). The mining roster
 * projection (`surface/ball-projection.ts`) interprets these. Per-loadout balance is data, not code.
 */

import type { BallType } from '@/game/surface/core-breaker';
import type { ModuleTierLevel } from './types';

/**
 * Tier buff to extraction yield — a Mk II module is a better ball as well as a better card
 * (§6.4 "Mk tier buffs both faces together"). Multiplies the drop from pegs this ball breaks.
 */
export const BALL_TIER_YIELD: Record<ModuleTierLevel, number> = { 1: 1, 2: 1.5 };

/**
 * Ball trajectory glyph (§6.4 UI law): each ball type maps to one of three arc shapes so the
 * surface face of a module is readable at a glance without text.
 *   straight = pierce / bores through formations (drill)
 *   arc      = bouncy / ricochets (standard, heavy, split)
 *   curve    = homing / phases (ghost)
 */
export type BallGlyph = 'straight' | 'arc' | 'curve';

export const BALL_GLYPH: Record<BallType, BallGlyph> = {
  drill: 'straight',
  standard: 'arc',
  heavy: 'arc',
  split: 'arc',
  ghost: 'curve',
};
