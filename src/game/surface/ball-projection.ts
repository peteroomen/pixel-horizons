/**
 * Module → ball projection (CB.3, ADR 011 / GDD §6.4, §6.9) — the surface analogue of `deck.ts`.
 *
 * Installed modules project to the **bag** of balls fired in Core Breaker, exactly as they project
 * to the combat deck: module-list order, module count = copies of that ball. A module's Mk tier
 * buffs both faces (better card *and* better ball — §6.4). Reactor level sets shots-per-drop;
 * Engines grant bonus shots; the Clone Bay matrix and Shield contribute surface passives (§6.9).
 *
 * Pure sim: no React/Pixi/DOM. The role map is the surface projection's interpretation of module
 * identity (parallel to how `items.ts` interpreted `planetItem`); only Bloom/ore behaviour and the
 * tier buff are data (`data/core-breaker.ts`).
 */

import { getModule } from '@/game/data';
import type { ModuleId, ModuleInstance, ModuleTierLevel } from '@/game/data';
import {
  BALL_TIER_YIELD,
  BASE_SHOTS_PER_DROP,
  ENGINE_BONUS_SHOTS,
  REPAIR_MATRIX_BONUS_SHOTS,
  SCAVENGER_YIELD_PERCENT,
} from '@/game/data/core-breaker';

import type { BallType } from './core-breaker';

/** One ball in the firing bag — parallels `CombatCard` (moduleIndex ties it to its module). */
export interface BagBall {
  moduleIndex: number;
  moduleId: ModuleId;
  type: BallType;
  tier: ModuleTierLevel;
  /** Tier-scaled multiplier on drops from pegs this ball breaks (§6.4 shared upgrade axis). */
  yieldMultiplier: number;
}

/** A standing modifier on the drop — the surface analogue of a combat Power (§6.4 passive role). */
export type SurfacePassive =
  | { kind: 'yield-percent'; percent: number } // Scavenger Matrix
  | { kind: 'extra-peg-hit' } // Enforcer Matrix — balls count as +1 hit on multi-hit pegs
  | { kind: 'aim-assist' } // Assault Matrix / Engine — longer, truer aim guide
  | { kind: 'survive-bloom' }; // Shield — a ball survives one Bloom hazard

export interface SurfaceBag {
  /** The firing bag in module-list order. */
  balls: BagBall[];
  /** Bounded shot budget for the drop (reactor + engines + matrix). */
  shotsPerDrop: number;
  passives: SurfacePassive[];
}

/** Ball behaviour by module identity (§6.4). Unlisted weapon/utility modules fall back to bouncy. */
const MODULE_BALL: Partial<Record<ModuleId, BallType>> = {
  'mod-mining-laser': 'pierce', // §6.4 — piercing straight shot
  'mod-light-laser': 'pierce',
  'mod-kinetic-railgun': 'pierce', // heavy straight punch
  'mod-missile-pod': 'bouncy', // §6.4 — heavy, explodes on rest
  'mod-flak-array': 'bouncy', // scatter → caroms
  'mod-autocannon': 'bouncy',
  'mod-phase-shifter': 'phase', // §6.4 — phases through one Bloom
  'mod-cargo-scanner': 'homing', // §6.4 — scanner magnetises toward ore
};

/** Clone Bay matrix → its surface passive (§6.9). Standard Print is baseline (no passive). */
const MATRIX_PASSIVE: Partial<
  Record<ModuleId, SurfacePassive | { kind: 'shots'; amount: number }>
> = {
  'mod-scavenger-matrix': { kind: 'yield-percent', percent: SCAVENGER_YIELD_PERCENT },
  'mod-enforcer-matrix': { kind: 'extra-peg-hit' },
  'mod-repair-matrix': { kind: 'shots', amount: REPAIR_MATRIX_BONUS_SHOTS },
  'mod-assault-matrix': { kind: 'aim-assist' },
};

/**
 * Project the installed modules into the Core Breaker bag, shot budget, and passives.
 * `reactorLevel` is the surface analogue of AP-per-turn (GDD §6.3) — passed in, like
 * `projectLoadout`, since it isn't on RunState yet (the `?reactor=` knob drives it).
 */
export function projectSurfaceBag(
  modules: readonly ModuleInstance[],
  reactorLevel: number,
): SurfaceBag {
  const balls: BagBall[] = [];
  const passives: SurfacePassive[] = [];
  let shotsBonus = 0;

  modules.forEach((mod, moduleIndex) => {
    const def = getModule(mod.id);
    switch (def.slot) {
      case 'engine':
        shotsBonus += ENGINE_BONUS_SHOTS;
        break;
      case 'shield':
        passives.push({ kind: 'survive-bloom' });
        break;
      case 'clone-bay': {
        const passive = MATRIX_PASSIVE[mod.id];
        if (passive !== undefined) {
          if (passive.kind === 'shots') shotsBonus += passive.amount;
          else passives.push(passive);
        }
        break;
      }
      default: {
        // weapon / utility → a ball
        const type = MODULE_BALL[mod.id] ?? 'bouncy';
        balls.push({
          moduleIndex,
          moduleId: mod.id,
          type,
          tier: mod.tier,
          yieldMultiplier: BALL_TIER_YIELD[mod.tier],
        });
      }
    }
  });

  return {
    balls,
    shotsPerDrop: Math.max(0, BASE_SHOTS_PER_DROP + Math.max(0, reactorLevel) + shotsBonus),
    passives,
  };
}
