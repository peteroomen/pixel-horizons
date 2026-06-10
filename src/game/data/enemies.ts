import type { EnemyDef } from './types';

/**
 * Bloom enemy catalog (GDD §5.7). Slice 2.1 ships only the Lamprey — the scripted-fight
 * raider. Module shredding (its real signature) arrives with malfunctions in 2.3; until
 * then it is raw hull pressure. All numbers tunable — balance lives here, never in logic.
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
      { kind: 'attack', name: 'Rend', amount: 9, piercing: true },
    ],
  },
];
