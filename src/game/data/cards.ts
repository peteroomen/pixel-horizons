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
    effects: [{ kind: 'apply-status', status: 'status-overcharged', magnitude: 2, to: 'self' }],
    // Weapon signature (GDD §5.9): a one-shot spike that doesn't dilute the deck.
    exhaust: true,
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
    // Targeted skill (GDD §5.10): Marks the focused organ/core, then Exhausts — a setup
    // you spend, not a free blanket modifier on every hit.
    effects: [{ kind: 'apply-status', status: 'status-marked', magnitude: 2, to: 'target' }],
    exhaust: true,
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
    // Weapon signature (GDD §5.9): a one-shot nuke, gone after one play this combat.
    exhaust: true,
  },
  {
    id: 'card-charge-capacitor',
    name: 'Charge Capacitor',
    apCost: 1,
    effects: [{ kind: 'apply-status', status: 'status-charged', magnitude: 5, to: 'self' }],
    // Exhaust (GDD §5.10): a spike you spend, not a free per-turn stack.
    exhaust: true,
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
    effects: [{ kind: 'apply-status', status: 'status-charged', magnitude: 3, to: 'self' }],
    // Exhaust (GDD §5.10): a spike you spend, not a free per-turn stack.
    exhaust: true,
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
  {
    id: 'card-salvage-round',
    name: 'Salvage Round',
    apCost: 1,
    // Discard keyword (GDD §5.9): a burst that eats hand economy for a spike.
    effects: [{ kind: 'damage', amount: 9 }],
    discardCost: 1,
  },
  {
    id: 'card-scatter-shell',
    name: 'Scatter Shell',
    apCost: 2,
    // Cleave keyword (GDD §5.9 / §5.4): hits the core and every living organ at once.
    effects: [{ kind: 'damage', amount: 6, piercing: true, target: 'all' }],
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
    effects: [{ kind: 'draw', count: 1 }],
    retain: true,
  },
  {
    id: 'card-phase-walk',
    name: 'Phase Walk',
    apCost: 1,
    effects: [{ kind: 'untargetable', turns: 1 }],
    // Utility signature (GDD §5.9): bank the dodge, spend it when the hit is telegraphed.
    retain: true,
  },
  {
    id: 'card-reinforce',
    name: 'Reinforce',
    apCost: 1,
    effects: [{ kind: 'restore-shield-layer', count: 1 }],
    // Shield signature (GDD §5.9): hold the heal in hand until the layer is actually down.
    retain: true,
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
    // Cargo Scanner pulls its weight in combat: read the intent and refill the hand.
    effects: [{ kind: 'reveal-intent' }, { kind: 'draw', count: 1 }],
  },

  // Engines
  {
    id: 'card-burn',
    name: 'Burn',
    apCost: 1,
    // Engine signature (GDD §5.9): dual-mode — travel *and* hand flow, live at the boss.
    effects: [
      { kind: 'travel', amount: 2 },
      { kind: 'draw', count: 1 },
    ],
    jettison: { benefit: 'ap', amount: 1 },
  },
  {
    id: 'card-afterburner',
    name: 'Afterburner',
    apCost: 2,
    effects: [
      { kind: 'travel', amount: 5 },
      { kind: 'draw', count: 1 },
    ],
    // Jettison (GDD §5.9 / §5.4): never a dead draw at the boss — trade it for energy.
    jettison: { benefit: 'ap', amount: 1 },
  },
  {
    id: 'card-hard-burn',
    name: 'Hard Burn',
    apCost: 1,
    effects: [
      { kind: 'travel', amount: 3 },
      { kind: 'draw', count: 1 },
    ],
    jettison: { benefit: 'ap', amount: 1 },
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
    // Already combat-useful (temp shield); Jettison is the floor when travel is moot.
    jettison: { benefit: 'ap', amount: 1 },
  },

  // Infestations (GDD §5.6) — injected by enemies mid-fight, never in a module's
  // card list; they exist only inside one CombatState and vanish with it.
  {
    id: 'card-spore-cluster',
    name: 'Spore Cluster',
    apCost: 0,
    effects: [],
    unplayable: true,
    onDraw: [{ kind: 'lose-shield-layer', count: 1 }],
    // Clog with an out (GDD §5.6): you eat the on-draw shield loss, but can Jettison the
    // cluster to clear it. `exhaust` makes the jettison permanent so it can't reshuffle back.
    exhaust: true,
    jettison: { benefit: 'ap', amount: 0 },
  },

  // Clone Bay matrices
  {
    id: 'card-telemetry-sync',
    name: 'Telemetry Sync',
    apCost: 1,
    // Draws 2 (net +1 card for the AP) so it earns its cost — Desync Hull is the
    // free 0-AP Retain cantrip; this baseline matrix card is the paid card-advantage one.
    effects: [{ kind: 'draw', count: 2 }],
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
    effects: [{ kind: 'apply-status', status: 'status-charged', magnitude: 3, to: 'self' }],
    // Exhaust (GDD §5.10): a spike you spend, not a free per-turn stack.
    exhaust: true,
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
