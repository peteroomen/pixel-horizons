import type { EnemyDef } from './types';

/**
 * Bloom enemy catalog (GDD §5.7). Slice 2.1 shipped the Lamprey as raw hull pressure;
 * with malfunctions live (2.3) its Rend now shreds a random module — the signature the
 * raider was waiting for. The Parasite hunts the highest-value operational module.
 * The Carapace's regenerating armor demands burst-in-one-turn or piercing; the
 * Sporecaster clogs the deck with Spore Clusters. All numbers tunable — balance lives
 * here, never in logic.
 */
export const ENEMY_DEFS: readonly EnemyDef[] = [
  {
    id: 'enemy-lamprey',
    name: 'Lamprey',
    archetype: 'Raider',
    maxHp: 22,
    pattern: 'cycle',
    intents: [
      { kind: 'attack', name: 'Feeding Frenzy', amount: 4, hits: 2 },
      { kind: 'attack', name: 'Lash', amount: 7 },
      { kind: 'attack-module', name: 'Rend', amount: 9, piercing: true, targeting: 'random' },
    ],
  },
  {
    id: 'enemy-parasite',
    name: 'Parasite',
    archetype: 'Hunter',
    maxHp: 18,
    pattern: 'cycle',
    intents: [
      { kind: 'attack-module', name: 'Burrow', amount: 3, targeting: 'highest-value' },
      { kind: 'attack', name: 'Tail Whip', amount: 5 },
      { kind: 'attack-module', name: 'Gnaw', amount: 4, targeting: 'highest-value' },
    ],
  },
  {
    id: 'enemy-carapace',
    name: 'Carapace',
    archetype: 'Bulwark',
    maxHp: 30,
    pattern: 'cycle',
    armor: { amount: 5, regen: 2 },
    intents: [
      { kind: 'attack', name: 'Shell Ram', amount: 6 },
      { kind: 'attack', name: 'Spine Rake', amount: 3, hits: 2 },
      { kind: 'attack-module', name: 'Crushing Grip', amount: 5, targeting: 'random' },
    ],
  },
  {
    id: 'enemy-sporecaster',
    name: 'Sporecaster',
    archetype: 'Scrambler',
    maxHp: 20,
    pattern: 'cycle',
    intents: [
      { kind: 'inject', name: 'Spore Burst', cardId: 'card-spore-cluster', count: 2 },
      { kind: 'attack', name: 'Tendril Slap', amount: 5 },
      { kind: 'inject', name: 'Spore Seep', cardId: 'card-spore-cluster', count: 1 },
      { kind: 'attack', name: 'Mycelial Lash', amount: 4, hits: 2 },
    ],
  },
  {
    id: 'enemy-anchormaw',
    name: 'Anchormaw',
    archetype: 'Blockade',
    maxHp: 26,
    pattern: 'cycle',
    anchor: { tollScrap: 5 },
    intents: [
      { kind: 'attack', name: 'Constrict', amount: 5 },
      { kind: 'attack', name: 'Maw Slam', amount: 4, hits: 2 },
      { kind: 'attack', name: 'Drag Under', amount: 7 },
    ],
  },
];
