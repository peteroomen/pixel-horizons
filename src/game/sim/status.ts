/**
 * Status (Power) mechanics — GDD §5.10, ADR 008. Pure, serializable, unit-tested.
 * A `Status` is plain JSON (`{ id, magnitude }`) so combat survives a mid-turn JSON
 * round-trip (ADR 003). The catalog (`data/statuses.ts`) decides how each one stacks
 * and decays; this module just applies those rules to a list.
 */

import { getStatus, type StatusId } from '../data';

export interface Status {
  id: StatusId;
  magnitude: number;
}

/**
 * Add a status to a collection (mutates `list`). Re-applying merges by the def's `stack`
 * rule: `multiply` (Overcharged) multiplies magnitudes, everything else sums.
 */
export function applyStatus(list: Status[], id: StatusId, magnitude: number): void {
  const def = getStatus(id);
  const existing = list.find((s) => s.id === id);
  if (existing === undefined) {
    list.push({ id, magnitude });
    return;
  }
  existing.magnitude =
    def.stack === 'multiply' ? existing.magnitude * magnitude : existing.magnitude + magnitude;
}

/** Total magnitude of one status id in a list (Marked stacks add up). */
export function sumMagnitude(list: Status[], id: StatusId): number {
  return list.reduce((n, s) => (s.id === id ? n + s.magnitude : n), 0);
}

/**
 * Spend every `consume-on-attack` status on the ship (mutates `list`), returning the
 * combined next-attack bonus (additive Charged) and multiplier (multiplicative
 * Overcharged). Called once per damage effect, so only the first hit of a multi-hit
 * card benefits (the comment that lived at the old `nextAttackBonus` site).
 */
export function consumeAttackBuffs(list: Status[]): { bonus: number; multiplier: number } {
  let bonus = 0;
  let multiplier = 1;
  for (const s of list) {
    if (getStatus(s.id).decay !== 'consume-on-attack') continue;
    if (getStatus(s.id).stack === 'multiply') multiplier *= s.magnitude;
    else bonus += s.magnitude;
  }
  for (let i = list.length - 1; i >= 0; i--) {
    if (getStatus(list[i].id).decay === 'consume-on-attack') list.splice(i, 1);
  }
  return { bonus, multiplier };
}

/** End-of-enemy-phase tick (mutates `list`): `tick-enemy-phase` statuses count down, gone at 0. */
export function tickStatuses(list: Status[]): void {
  for (let i = list.length - 1; i >= 0; i--) {
    if (getStatus(list[i].id).decay !== 'tick-enemy-phase') continue;
    list[i].magnitude -= 1;
    if (list[i].magnitude <= 0) list.splice(i, 1);
  }
}
