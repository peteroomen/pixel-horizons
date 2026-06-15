/**
 * Status (Power) catalog — GDD §5.10, ADR 008. Persistent, stacking, *visible*
 * buffs/debuffs. Pure data: the combat sim (`sim/status.ts`) interprets these; nothing
 * here executes. A status instance is `{ id, magnitude }` (plain JSON, ADR 003).
 *
 * `decay` — how the status leaves play:
 *   - `consume-on-attack` — spent by the next damage effect (Charged bonus, Overcharged ×).
 *   - `persist`           — lasts the whole fight (Marked / Vulnerable).
 *   - `tick-enemy-phase`  — magnitude counts down once per enemy phase, gone at 0.
 * `stack`   — `add` (magnitudes sum) or `multiply` (magnitudes multiply, for Overcharged).
 * `display` — how the chip renders its magnitude.
 * `cardText` — `{n}`-templated text a card shows for an `apply-status` effect.
 */

import type { StatusId } from './types';

export type StatusDecay = 'consume-on-attack' | 'persist' | 'tick-enemy-phase';
export type StatusStack = 'add' | 'multiply';
export type StatusDisplay = 'plus' | 'times' | 'percent' | 'turns' | 'none';

export interface StatusDef {
  id: StatusId;
  name: string;
  /** Tooltip body — what the status does, in plain language. */
  description: string;
  /** Which plate it belongs on: a ship buff or an enemy/organ debuff. */
  side: 'ship' | 'enemy';
  decay: StatusDecay;
  stack: StatusStack;
  display: StatusDisplay;
  /** Card-effect text template; `{n}` is replaced with the applied magnitude. */
  cardText: string;
}

export const STATUS_DEFS: readonly StatusDef[] = [
  {
    id: 'status-charged',
    name: 'Charged',
    description: 'Your next attack deals extra damage, then this fades.',
    side: 'ship',
    decay: 'consume-on-attack',
    stack: 'add',
    display: 'plus',
    cardText: 'Next attack +{n}',
  },
  {
    id: 'status-overcharged',
    name: 'Overcharged',
    description: 'Your next attack is multiplied, then this fades.',
    side: 'ship',
    decay: 'consume-on-attack',
    stack: 'multiply',
    display: 'times',
    cardText: 'Next attack ×{n}',
  },
  {
    id: 'status-marked',
    name: 'Marked',
    description: 'This target takes extra damage from every hit, for the rest of the fight.',
    side: 'enemy',
    decay: 'persist',
    stack: 'add',
    display: 'plus',
    cardText: 'Mark target: +{n} damage taken',
  },
  // Display-only (derived from CombatModifiers, never stored as instances — ADR 008).
  {
    id: 'status-dodge',
    name: 'Evasion',
    description: 'Incoming hits have a chance to miss this turn.',
    side: 'ship',
    decay: 'tick-enemy-phase',
    stack: 'add',
    display: 'percent',
    cardText: '{n}% dodge this turn',
  },
  {
    id: 'status-cloak',
    name: 'Cloak',
    description: 'Enemy attacks miss you while this is active.',
    side: 'ship',
    decay: 'tick-enemy-phase',
    stack: 'add',
    display: 'turns',
    cardText: 'Untargetable {n}',
  },
  {
    id: 'status-scanned',
    name: 'Deep Scan',
    description: "The enemy's next move and its exact numbers are revealed.",
    side: 'ship',
    decay: 'tick-enemy-phase',
    stack: 'add',
    display: 'none',
    cardText: 'Reveal enemy intent',
  },
];
