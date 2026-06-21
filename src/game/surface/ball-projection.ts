/**
 * Module → mining roster projection (ADR-003 / GDD §6.4).
 *
 * Every installed module contributes one ball to the Mining Run roster (the surface analogue of the
 * combat deck). Module type determines ball behaviour; Mk tier buffs both faces (better card AND
 * better ball — §6.4). Clone Bay matrices contribute surface passives instead of balls.
 *
 * Roster order = module-list order. No shots-per-drop budget — the run ends when all roster balls
 * are spent (fell out or consumed) or the timer expires.
 *
 * Pure sim: no React/Pixi/DOM.
 */

import { getModule } from '@/game/data';
import type { ModuleId, ModuleInstance, ModuleTierLevel } from '@/game/data';
import { BALL_TIER_YIELD } from '@/game/data/core-breaker';

import type { BallType } from './core-breaker';

export interface RosterBall {
  moduleIndex: number;
  moduleId: ModuleId;
  type: BallType;
  tier: ModuleTierLevel;
  /** Tier-scaled multiplier on drops from pegs this ball breaks (§6.4 shared upgrade axis). */
  yieldMultiplier: number;
}

/** A standing modifier for the run — surface analogue of a combat Power (§6.4 passive role). */
export type SurfacePassive =
  | { kind: 'yield-percent'; percent: number }
  | { kind: 'extra-peg-hit' }
  | { kind: 'aim-assist' };

export interface MiningRoster {
  balls: RosterBall[];
  passives: SurfacePassive[];
}

// ── Module → ball type (ADR-003 §6.4 table) ──────────────────────────────────

/** Heavy weapons → heavy ball (2× damage). */
const HEAVY_MODULES = new Set<ModuleId>([
  'mod-kinetic-railgun',
  'mod-missile-pod',
  'mod-autocannon',
]);

/** Module role → ball type (unlisted weapon/utility → standard). */
const SLOT_BALL: Partial<Record<string, BallType>> = {
  // slot names from data/modules.ts
  engine: 'drill', // engine modules → drill (bores through formations)
  shield: 'ghost', // shield modules → ghost (passes through bloom, no deflect)
};

const MODULE_PASSIVES: Partial<Record<ModuleId, SurfacePassive | null>> = {
  'mod-scavenger-matrix': { kind: 'yield-percent', percent: 15 },
  'mod-enforcer-matrix': { kind: 'extra-peg-hit' },
  'mod-assault-matrix': { kind: 'aim-assist' },
  'mod-repair-matrix': null,
  'mod-standard-print-matrix': null,
};

// Utility-slot modules that project to split instead of standard.
const SPLIT_MODULES = new Set<ModuleId>(['mod-phase-shifter', 'mod-cargo-scanner']);

// ─────────────────────────────────────────────────────────────────────────────

export function projectMiningRoster(modules: readonly ModuleInstance[]): MiningRoster {
  const balls: RosterBall[] = [];
  const passives: SurfacePassive[] = [];

  modules.forEach((mod, moduleIndex) => {
    const def = getModule(mod.id);

    // Clone Bay matrices → passives, not balls.
    if (def.slot === 'clone-bay') {
      const p = MODULE_PASSIVES[mod.id];
      if (p !== null && p !== undefined) passives.push(p);
      return;
    }

    // Determine ball type.
    let type: BallType = SLOT_BALL[def.slot] ?? 'standard';
    if (HEAVY_MODULES.has(mod.id)) type = 'heavy';
    if (SPLIT_MODULES.has(mod.id)) type = 'split';

    balls.push({
      moduleIndex,
      moduleId: mod.id,
      type,
      tier: mod.tier,
      yieldMultiplier: BALL_TIER_YIELD[mod.tier],
    });
  });

  return { balls, passives };
}
