import type { ModuleDef } from './types';

/**
 * Module catalog from GDD §5.8 plus Clone Bay matrices from §4.2 (matrices are
 * modules with slot 'clone-bay' — same install/malfunction lifecycle). Mk II is
 * absent wherever the GDD says TBD; Shield Generator's Mk II is omitted entirely
 * because its cards are TBD and a tier must contribute 1–4 cards (§5.3).
 */
export const MODULE_DEFS: readonly ModuleDef[] = [
  // Weapons
  {
    id: 'mod-light-laser',
    name: 'Light Laser',
    slot: 'weapon',
    tiers: {
      mk1: { cards: ['card-laser-burst', 'card-laser-burst'] },
      mk2: {
        cards: ['card-focused-beam', 'card-focused-beam', 'card-overcharge'],
        planetItem: { name: 'Laser Cutter', description: 'Mine hard rock.' },
      },
    },
  },
  {
    id: 'mod-flak-array',
    name: 'Flak Array',
    slot: 'weapon',
    tiers: {
      mk1: { cards: ['card-flak-volley', 'card-flak-volley', 'card-tracer-lock'] },
      mk2: {
        cards: ['card-heavy-flak', 'card-heavy-flak', 'card-kinetic-shred'],
        planetItem: {
          name: 'Reactive Plating',
          description: 'Passive: +3 temp shield at combat start.',
        },
      },
    },
  },
  {
    id: 'mod-kinetic-railgun',
    name: 'Kinetic Railgun',
    slot: 'weapon',
    tiers: {
      mk1: {
        cards: ['card-railgun-shot', 'card-charge-capacitor'],
        planetItem: {
          name: 'Orbital Strike Beacon',
          description: '45s cooldown, vaporizes terrain/enemies.',
        },
      },
    },
  },
  {
    id: 'mod-mining-laser',
    name: 'Mining Laser',
    slot: 'weapon',
    tiers: {
      mk1: {
        cards: ['card-slag-shot'],
        planetItem: {
          name: 'Enhanced Mining',
          description: '2× mining yield.',
          effects: [{ kind: 'mining-yield', multiplier: 2 }],
        },
      },
      mk2: {
        cards: ['card-slag-shot-mk2', 'card-slag-shot-mk2'],
        planetItem: {
          name: 'Enhanced Mining + Deposit Scanner',
          description: '2× mining yield; highlights deposits.',
          effects: [{ kind: 'mining-yield', multiplier: 2 }, { kind: 'deposit-scanner' }],
        },
      },
    },
  },
  {
    id: 'mod-missile-pod',
    name: 'Missile Pod',
    slot: 'weapon',
    tiers: {
      mk1: { cards: ['card-missile-salvo', 'card-lock-on'] },
    },
  },
  {
    id: 'mod-autocannon',
    name: 'Autocannon',
    slot: 'weapon',
    tiers: {
      mk1: { cards: ['card-cannon-burst', 'card-cannon-burst'] },
    },
  },

  // Utility
  {
    id: 'mod-phase-shifter',
    name: 'Phase Shifter',
    slot: 'utility',
    tiers: {
      mk1: {
        cards: ['card-ghost-shift', 'card-ghost-shift', 'card-desync-hull'],
        planetItem: {
          name: 'Phase Dash',
          description: 'Blink through walls.',
          effects: [{ kind: 'phase-dash', distancePx: 48, cooldownMs: 1500 }],
        },
      },
      mk2: {
        cards: ['card-ghost-shift', 'card-ghost-shift', 'card-desync-hull', 'card-phase-walk'],
        planetItem: {
          name: 'Phase Dash + Phase Vision',
          description: 'Blink through walls; see through walls briefly.',
          effects: [{ kind: 'phase-dash', distancePx: 64, cooldownMs: 1200 }],
        },
      },
    },
  },
  {
    id: 'mod-shield-generator',
    name: 'Shield Generator',
    slot: 'utility',
    tiers: {
      mk1: {
        cards: ['card-reinforce', 'card-reinforce', 'card-emergency-barrier'],
        passive: { kind: 'shield-layers', layers: 2, rechargeTurns: 2 },
        planetItem: {
          name: 'Shield Bubble',
          description: 'Absorbs 1 hit, 30s cooldown.',
          effects: [{ kind: 'shield-bubble', cooldownMs: 30_000 }],
        },
      },
    },
  },
  {
    id: 'mod-cargo-scanner',
    name: 'Cargo Scanner',
    slot: 'utility',
    tiers: {
      mk1: {
        cards: ['card-deep-scan'],
        planetItem: {
          name: 'Resource Scanner',
          description: 'Highlights hidden deposits.',
          effects: [{ kind: 'deposit-scanner' }],
        },
      },
    },
  },

  // Engines
  {
    id: 'mod-thruster',
    name: 'Thruster',
    slot: 'engine',
    tiers: {
      mk1: {
        cards: ['card-burn', 'card-burn', 'card-afterburner'],
        planetItem: {
          name: 'Double Jump',
          description: 'Jump again mid-air.',
          effects: [{ kind: 'double-jump' }],
        },
      },
      mk2: {
        cards: ['card-hard-burn', 'card-hard-burn', 'card-emergency-boost'],
        planetItem: {
          name: 'Enhanced Double Jump',
          description: 'Jump again mid-air; higher jump.',
          effects: [{ kind: 'double-jump' }, { kind: 'high-jump', jumpVelocityMultiplier: 1.15 }],
        },
      },
    },
  },
  {
    id: 'mod-hauler-engine',
    name: 'Hauler Engine',
    slot: 'engine',
    tiers: {
      mk1: {
        cards: ['card-burn', 'card-cargo-thrust'],
        planetItem: {
          name: 'High Jump',
          description: 'Taller single jump, no double jump; reinforced cargo rack.',
          effects: [
            { kind: 'high-jump', jumpVelocityMultiplier: 1.25 },
            { kind: 'backpack-capacity', bonus: 10 },
          ],
        },
      },
    },
  },

  // Clone Bay matrices
  {
    id: 'mod-standard-print-matrix',
    name: 'Standard Print Matrix',
    slot: 'clone-bay',
    tiers: {
      mk1: {
        cards: ['card-telemetry-sync'],
        planetItem: { name: 'Baseline Clone', description: 'Baseline clone (3 HP).' },
      },
    },
  },
  {
    id: 'mod-scavenger-matrix',
    name: 'Scavenger Matrix',
    slot: 'clone-bay',
    tiers: {
      mk1: {
        cards: ['card-resource-ping'],
        planetItem: {
          name: 'Scavenger Clone',
          description: '+15% mining yield, 2 HP.',
          effects: [{ kind: 'yield-bonus', percent: 15 }],
        },
      },
    },
  },
  {
    id: 'mod-enforcer-matrix',
    name: 'Enforcer Matrix',
    slot: 'clone-bay',
    tiers: {
      mk1: {
        cards: ['card-combat-sim'],
        planetItem: {
          name: 'Enforcer Clone',
          description: '+1 melee damage, -10% speed.',
          effects: [{ kind: 'move-speed', multiplier: 0.9 }],
        },
      },
    },
  },
  {
    id: 'mod-repair-matrix',
    name: 'Repair Matrix',
    slot: 'clone-bay',
    tiers: {
      mk1: {
        cards: ['card-repair-clone'],
        planetItem: {
          name: 'Repair Clone',
          description: 'Carries field-patch kit (slow self-heal).',
        },
      },
    },
  },
  {
    id: 'mod-assault-matrix',
    name: 'Assault Matrix',
    slot: 'clone-bay',
    tiers: {
      mk1: {
        cards: ['card-boarding-clone'],
        planetItem: {
          name: 'Assault Clone',
          description: '+ranged attack, 2 HP.',
        },
      },
    },
  },
];
