import type { Resources } from '@/game/sim/run-state';
import type { Body } from './physics';
import { backpackUsed } from './mining';

/**
 * A resource bundle resting on the floor (GDD §6.5/§6.7) — an enemy drop that
 * overflowed a full backpack, recoverable by walking near it (magnetism).
 */
export interface WorldItem {
  resources: Resources;
  x: number;
  y: number;
}

const RESOURCE_KEYS = ['scrap', 'biominerals', 'coreCrystals', 'blueprints'] as const;

function total(r: Resources): number {
  return r.scrap + r.biominerals + r.coreCrystals + r.blueprints;
}

/**
 * Move as much of `source` into `backpack` as capacity allows (declared-key
 * order at the boundary). Mutates both. Returns true once source is empty.
 */
export function transferToBackpack(
  source: Resources,
  backpack: Resources,
  capacity: number,
): boolean {
  let space = capacity - backpackUsed(backpack);
  for (const key of RESOURCE_KEYS) {
    if (space <= 0) break;
    const amount = source[key];
    if (amount <= 0) continue;
    const take = Math.min(amount, space);
    backpack[key] += take;
    source[key] -= take;
    space -= take;
  }
  return total(source) === 0;
}

function distance(body: Body, x: number, y: number): number {
  const dx = body.x + body.w / 2 - (x + 0.5);
  const dy = body.y + body.h / 2 - (y + 0.5);
  return Math.hypot(dx, dy);
}

/**
 * Pull nearby world items into the backpack (GDD §6.5 magnetism). Fully drained
 * items are removed; partially-collected ones keep their remainder on the floor.
 * Mutates the items array and backpack in place.
 */
export function collectWorldItems(
  items: WorldItem[],
  backpack: Resources,
  capacity: number,
  cloneBody: Body,
  radius: number,
): void {
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    if (distance(cloneBody, item.x, item.y) > radius) continue;
    const emptied = transferToBackpack(item.resources, backpack, capacity);
    if (emptied) items.splice(i, 1);
  }
}
