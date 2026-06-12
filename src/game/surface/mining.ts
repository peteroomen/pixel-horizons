import { BIOMINERAL_DEPOSIT_YIELD, SCRAP_CACHE_YIELD } from '@/game/data/surface';
import type { Resources } from '@/game/sim/run-state';
import { TILE_DEPOSIT_BIOMINERAL, TILE_SCRAP_CACHE } from './tilemap';

/** Partial resource bundle produced by breaking one tile. */
export type ResourceDelta = Partial<Resources>;

/**
 * Resource keys in declared order — partial fills at the capacity boundary
 * follow this order so multi-resource yields stay deterministic.
 */
const RESOURCE_KEYS = ['scrap', 'biominerals', 'coreCrystals', 'blueprints'] as const;

/** Yield for a broken tile type, or null if the tile yields nothing (plain rock). */
export function tileYield(tile: number): ResourceDelta | null {
  if (tile === TILE_DEPOSIT_BIOMINERAL) {
    return { biominerals: BIOMINERAL_DEPOSIT_YIELD };
  }
  if (tile === TILE_SCRAP_CACHE) {
    return { scrap: SCRAP_CACHE_YIELD };
  }
  return null;
}

/** Total units carried (sum of all four resource counts). */
export function backpackUsed(backpack: Resources): number {
  return backpack.scrap + backpack.biominerals + backpack.coreCrystals + backpack.blueprints;
}

/**
 * Add a yield to the backpack, clamped to capacity. Mutates backpack; overflow
 * is lost (the tile still broke). Returns true if at least one unit was added.
 */
export function addYield(backpack: Resources, delta: ResourceDelta, capacity: number): boolean {
  let space = capacity - backpackUsed(backpack);
  let added = false;
  for (const key of RESOURCE_KEYS) {
    const amount = delta[key];
    if (amount === undefined || amount <= 0 || space <= 0) continue;
    const take = Math.min(amount, space);
    backpack[key] += take;
    space -= take;
    added = true;
  }
  return added;
}
