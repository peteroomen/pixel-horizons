import type { CardDef } from './types';

/**
 * Every card in the game, sourced from GDD §4.2 (Clone Bay matrices) and §5.8
 * (module catalog). Missile Pod / Autocannon cards were added to §5.8 alongside
 * this slice. All numbers tunable — balance lives here, never in logic.
 */
export const CARD_DEFS: readonly CardDef[] = [
  // Weapons
  {
    id: 'card-laser-burst',
    name: 'Laser Burst',
    apCost: 1,
    effects: [{ kind: 'damage', amount: 4 }],
  },
  {
    id: 'card-focused-beam',
    name: 'Focused Beam',
    apCost: 1,
    effects: [{ kind: 'damage', amount: 6 }],
  },
  {
    id: 'card-overcharge',
    name: 'Overcharge',
    apCost: 0,
    effects: [{ kind: 'amplify-next-attack', multiplier: 2 }],
  },
  {
    id: 'card-flak-volley',
    name: 'Flak Volley',
    apCost: 2,
    effects: [{ kind: 'damage', amount: 6, piercing: true }],
  },
  {
    id: 'card-tracer-lock',
    name: 'Tracer Lock',
    apCost: 1,
    effects: [{ kind: 'debuff-target-vulnerable', amount: 2 }],
  },
  {
    id: 'card-heavy-flak',
    name: 'Heavy Flak',
    apCost: 2,
    effects: [{ kind: 'damage', amount: 10, piercing: true }],
  },
  {
    id: 'card-kinetic-shred',
    name: 'Kinetic Shred',
    apCost: 1,
    effects: [{ kind: 'strip-armor' }],
  },
  {
    id: 'card-railgun-shot',
    name: 'Railgun Shot',
    apCost: 3,
    effects: [{ kind: 'damage', amount: 20, piercing: true }],
  },
  {
    id: 'card-charge-capacitor',
    name: 'Charge Capacitor',
    apCost: 1,
    effects: [{ kind: 'buff-next-attack', bonus: 5 }],
  },
  {
    id: 'card-slag-shot',
    name: 'Slag Shot',
    apCost: 1,
    effects: [{ kind: 'damage', amount: 3 }],
  },
  {
    id: 'card-slag-shot-mk2',
    name: 'Slag Shot',
    apCost: 1,
    effects: [{ kind: 'damage', amount: 4 }],
  },
  {
    id: 'card-missile-salvo',
    name: 'Missile Salvo',
    apCost: 2,
    effects: [{ kind: 'damage', amount: 8 }],
  },
  {
    id: 'card-lock-on',
    name: 'Lock-On',
    apCost: 1,
    effects: [{ kind: 'buff-next-attack', bonus: 3 }],
  },
  {
    id: 'card-cannon-burst',
    name: 'Cannon Burst',
    apCost: 1,
    effects: [
      { kind: 'damage', amount: 3 },
      { kind: 'damage', amount: 3 },
    ],
  },

  // Utility
  {
    id: 'card-ghost-shift',
    name: 'Ghost Shift',
    apCost: 1,
    effects: [{ kind: 'dodge-chance', chance: 0.5 }],
  },
  {
    id: 'card-desync-hull',
    name: 'Desync Hull',
    apCost: 0,
    effects: [{ kind: 'retain-cards', count: 1 }],
  },
  {
    id: 'card-phase-walk',
    name: 'Phase Walk',
    apCost: 1,
    effects: [{ kind: 'untargetable', turns: 1 }],
  },
  {
    id: 'card-reinforce',
    name: 'Reinforce',
    apCost: 1,
    effects: [{ kind: 'restore-shield-layer', count: 1 }],
  },
  {
    id: 'card-emergency-barrier',
    name: 'Emergency Barrier',
    apCost: 0,
    effects: [{ kind: 'temp-shield-layer', count: 1 }],
    exhaust: true,
  },
  {
    id: 'card-deep-scan',
    name: 'Deep Scan',
    apCost: 1,
    effects: [{ kind: 'reveal-intent' }],
  },

  // Engines
  {
    id: 'card-burn',
    name: 'Burn',
    apCost: 1,
    effects: [{ kind: 'travel', amount: 2 }],
  },
  {
    id: 'card-afterburner',
    name: 'Afterburner',
    apCost: 2,
    effects: [{ kind: 'travel', amount: 5 }],
  },
  {
    id: 'card-hard-burn',
    name: 'Hard Burn',
    apCost: 1,
    effects: [{ kind: 'travel', amount: 3 }],
  },
  {
    id: 'card-emergency-boost',
    name: 'Emergency Boost',
    apCost: 0,
    effects: [{ kind: 'travel', amount: 2 }],
    exhaust: true,
  },
  {
    id: 'card-cargo-thrust',
    name: 'Cargo Thrust',
    apCost: 2,
    effects: [
      { kind: 'travel', amount: 3 },
      { kind: 'temp-shield-layer', count: 1 },
    ],
  },

  // Clone Bay matrices
  {
    id: 'card-telemetry-sync',
    name: 'Telemetry Sync',
    apCost: 1,
    effects: [{ kind: 'draw', count: 1 }],
  },
  {
    id: 'card-resource-ping',
    name: 'Resource Ping',
    apCost: 0,
    effects: [{ kind: 'gain-scrap', amount: 1 }],
    exhaust: true,
  },
  {
    id: 'card-combat-sim',
    name: 'Combat Sim',
    apCost: 1,
    effects: [{ kind: 'buff-next-attack', bonus: 3 }],
  },
  {
    id: 'card-repair-clone',
    name: 'Repair Clone',
    apCost: 2,
    effects: [{ kind: 'repair-all-modules' }],
  },
  {
    id: 'card-boarding-clone',
    name: 'Boarding Clone',
    apCost: 2,
    effects: [{ kind: 'damage', amount: 5, piercing: true }],
  },
];
