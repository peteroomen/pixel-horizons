/**
 * Core Breaker tunables (data only — no logic; ADR 011 / GDD §6.3–6.9). The mining roster
 * projection (`surface/ball-projection.ts`) interprets these. Per-loadout balance is data, not code.
 */

import type { ModuleTierLevel } from './types';

/**
 * Tier buff to extraction yield — a Mk II module is a better ball as well as a better card
 * (§6.4 "Mk tier buffs both faces together"). Multiplies the drop from pegs this ball breaks.
 */
export const BALL_TIER_YIELD: Record<ModuleTierLevel, number> = { 1: 1, 2: 1.5 };
