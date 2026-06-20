import { describe, expect, it } from 'vitest';

import { generateCombatDeck } from '@/game/sim/deck';
import type { ModuleInstance } from '@/game/data';
import { BASE_SHOTS_PER_DROP } from '@/game/data/core-breaker';

import { projectSurfaceBag } from './ball-projection';

const mk = (id: string, tier: 1 | 2 = 1): ModuleInstance => ({ id, tier });

describe('projectSurfaceBag — the bag', () => {
  it('projects each weapon/utility module to its documented ball, in module order', () => {
    const bag = projectSurfaceBag(
      [
        mk('mod-mining-laser'),
        mk('mod-missile-pod'),
        mk('mod-phase-shifter'),
        mk('mod-cargo-scanner'),
      ],
      0,
    );
    expect(bag.balls.map((b) => b.type)).toEqual(['pierce', 'bouncy', 'phase', 'homing']);
    expect(bag.balls.map((b) => b.moduleIndex)).toEqual([0, 1, 2, 3]);
  });

  it('module count = copies of that ball in the bag', () => {
    const bag = projectSurfaceBag([mk('mod-mining-laser'), mk('mod-mining-laser')], 0);
    expect(bag.balls).toHaveLength(2);
    expect(bag.balls.every((b) => b.type === 'pierce')).toBe(true);
  });

  it('an unmapped weapon/utility module falls back to a bouncy ball', () => {
    const bag = projectSurfaceBag([mk('mod-autocannon')], 0);
    expect(bag.balls[0].type).toBe('bouncy');
  });

  it('engine, shield, and clone-bay modules are not balls', () => {
    const bag = projectSurfaceBag(
      [mk('mod-thruster'), mk('mod-shield-generator'), mk('mod-standard-print-matrix')],
      0,
    );
    expect(bag.balls).toHaveLength(0);
  });
});

describe('projectSurfaceBag — shots', () => {
  it('reactor level adds to the base shot budget', () => {
    expect(projectSurfaceBag([], 0).shotsPerDrop).toBe(BASE_SHOTS_PER_DROP);
    expect(projectSurfaceBag([], 3).shotsPerDrop).toBe(BASE_SHOTS_PER_DROP + 3);
  });

  it('each engine grants a bonus shot', () => {
    const bag = projectSurfaceBag([mk('mod-thruster'), mk('mod-hauler-engine')], 1);
    expect(bag.shotsPerDrop).toBe(BASE_SHOTS_PER_DROP + 1 + 2);
  });

  it('the Repair Matrix grants a bonus shot', () => {
    const bag = projectSurfaceBag([mk('mod-repair-matrix')], 0);
    expect(bag.shotsPerDrop).toBe(BASE_SHOTS_PER_DROP + 1);
  });
});

describe('projectSurfaceBag — passives (§6.9)', () => {
  it('maps each Clone Bay matrix to its surface passive', () => {
    expect(projectSurfaceBag([mk('mod-scavenger-matrix')], 0).passives).toEqual([
      { kind: 'yield-percent', percent: 15 },
    ]);
    expect(projectSurfaceBag([mk('mod-enforcer-matrix')], 0).passives).toEqual([
      { kind: 'extra-peg-hit' },
    ]);
    expect(projectSurfaceBag([mk('mod-assault-matrix')], 0).passives).toEqual([
      { kind: 'aim-assist' },
    ]);
    // Standard Print is baseline — no passive.
    expect(projectSurfaceBag([mk('mod-standard-print-matrix')], 0).passives).toEqual([]);
  });

  it('the Shield contributes a survive-bloom passive', () => {
    expect(projectSurfaceBag([mk('mod-shield-generator')], 0).passives).toEqual([
      { kind: 'survive-bloom' },
    ]);
  });
});

describe('Mk tier buffs both faces', () => {
  it('a Mk II module yields a richer ball AND different cards than Mk I', () => {
    const mk1Bag = projectSurfaceBag([mk('mod-mining-laser', 1)], 0);
    const mk2Bag = projectSurfaceBag([mk('mod-mining-laser', 2)], 0);
    // Ball face: tier + yield change.
    expect(mk2Bag.balls[0].tier).toBe(2);
    expect(mk2Bag.balls[0].yieldMultiplier).toBeGreaterThan(mk1Bag.balls[0].yieldMultiplier);
    // Card face: deck.ts already produces different cards at Mk II.
    const mk1Cards = generateCombatDeck([mk('mod-mining-laser', 1)]).map((c) => c.cardId);
    const mk2Cards = generateCombatDeck([mk('mod-mining-laser', 2)]).map((c) => c.cardId);
    expect(mk2Cards).not.toEqual(mk1Cards);
  });
});
