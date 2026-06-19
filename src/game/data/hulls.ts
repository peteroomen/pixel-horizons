import type { HullDef } from './types';

/**
 * Hull catalog from GDD §4.1. Starting modules include the Standard Print Matrix
 * (all hulls start with it, in the implicit clone-bay slot).
 */
export const HULL_DEFS: readonly HullDef[] = [
  {
    id: 'hull-scout',
    name: 'Scout',
    slots: { weapon: 1, utility: 2, engine: 2 },
    startingModules: [
      'mod-light-laser',
      'mod-thruster',
      'mod-thruster',
      'mod-shield-generator',
      'mod-standard-print-matrix',
    ],
    innateAbility: {
      id: 'innate-slipstream',
      name: 'Slipstream',
      description: 'Once per turn, discard a card to draw a card.',
      uses: 'per-turn',
      effect: { kind: 'discard-to-draw' },
    },
    playstyle: 'Fast traversal, evasion-heavy, lean deck.',
  },
  {
    id: 'hull-gunship',
    name: 'Gunship',
    slots: { weapon: 3, utility: 1, engine: 1 },
    startingModules: [
      'mod-flak-array',
      'mod-missile-pod',
      'mod-shield-generator',
      'mod-standard-print-matrix',
    ],
    innateAbility: {
      id: 'innate-point-defense',
      name: 'Point-Defense',
      description: 'Once per turn, 1 AP: deal 2 damage.',
      uses: 'per-turn',
      effect: { kind: 'damage', apCost: 1, amount: 2 },
    },
    playstyle:
      'Weapon-heavy deck, strong combat, slow (no starting engine module — can never shorten lanes).',
  },
  {
    id: 'hull-freighter',
    name: 'Freighter',
    slots: { weapon: 1, utility: 1, engine: 2 },
    startingModules: [
      'mod-mining-laser',
      'mod-hauler-engine',
      'mod-shield-generator',
      'mod-standard-print-matrix',
    ],
    innateAbility: {
      id: 'innate-salvage-rig',
      name: 'Salvage Rig',
      description: '+2 Scrap after every won encounter.',
      uses: 'passive',
      effect: { kind: 'scrap-on-victory', amount: 2 },
    },
    playstyle: 'Resource-focused, engine-heavy hauler.',
  },
  {
    id: 'hull-tactical',
    name: 'Tactical',
    slots: { weapon: 2, utility: 2, engine: 1 },
    startingModules: [
      'mod-light-laser',
      'mod-shield-generator',
      'mod-cargo-scanner',
      'mod-thruster',
      'mod-standard-print-matrix',
    ],
    innateAbility: {
      id: 'innate-auxiliary-router',
      name: 'Auxiliary Router',
      description: 'Once per combat, gain 1 AP.',
      uses: 'per-combat',
      effect: { kind: 'gain-ap', amount: 1 },
    },
    playstyle: 'Flexible, mid-range everything.',
  },
];
