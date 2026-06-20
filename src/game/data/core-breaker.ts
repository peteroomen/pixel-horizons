/**
 * Core Breaker tunables (data only — no logic; ADR 011 / GDD §6.3–6.9). The surface bag
 * projection (`surface/ball-projection.ts`) interprets these, the way `data/surface.ts` fed the
 * platformer loadout. Per-loadout balance is data, not code.
 */

import type { ModuleTierLevel } from './types';

/** Shots per drop with a level-0 reactor — reactor level adds on top (GDD §6.3). */
export const BASE_SHOTS_PER_DROP = 5;
/** Bonus shots granted per installed Engine module (§6.3 "Engine modules can grant bonus shots"). */
export const ENGINE_BONUS_SHOTS = 1;
/** The Repair Matrix's surface passive: +1 shot per drop (§6.9). */
export const REPAIR_MATRIX_BONUS_SHOTS = 1;
/** The Scavenger Matrix's surface passive: +15% yield from shattered pegs (§6.9). */
export const SCAVENGER_YIELD_PERCENT = 15;

/**
 * Tier buff to extraction yield — a Mk II module is a better ball as well as a better card
 * (§6.4 "Mk tier buffs both faces together"). Multiplies the drop from pegs this ball breaks.
 */
export const BALL_TIER_YIELD: Record<ModuleTierLevel, number> = { 1: 1, 2: 1.5 };
