import { describe, expect, it } from 'vitest';

import { generateCombatDeck } from '@/game/sim/deck';
import type { ModuleInstance } from '@/game/data';

import { projectMiningRoster } from './ball-projection';

const mk = (id: string, tier: 1 | 2 = 1): ModuleInstance => ({ id, tier });

describe('projectMiningRoster — ball types', () => {
  it('projects modules to their documented ball types in order', () => {
    const roster = projectMiningRoster([
      mk('mod-mining-laser'), // weapon slot → standard
      mk('mod-missile-pod'), // HEAVY_MODULES → heavy
      mk('mod-phase-shifter'), // SPLIT_MODULES → split
      mk('mod-cargo-scanner'), // SPLIT_MODULES → split
    ]);
    expect(roster.balls.map((b) => b.type)).toEqual(['standard', 'heavy', 'split', 'split']);
    expect(roster.balls.map((b) => b.moduleIndex)).toEqual([0, 1, 2, 3]);
  });

  it('module count = copies of that ball in the roster', () => {
    const roster = projectMiningRoster([mk('mod-mining-laser'), mk('mod-mining-laser')]);
    expect(roster.balls).toHaveLength(2);
    expect(roster.balls.every((b) => b.type === 'standard')).toBe(true);
  });

  it('engine slot → drill ball', () => {
    const roster = projectMiningRoster([mk('mod-thruster')]);
    expect(roster.balls[0].type).toBe('drill');
  });

  it('shield slot → ghost ball', () => {
    const roster = projectMiningRoster([mk('mod-shield-generator')]);
    expect(roster.balls[0].type).toBe('ghost');
  });

  it('clone-bay modules produce passives, not balls', () => {
    const roster = projectMiningRoster([mk('mod-standard-print-matrix')]);
    expect(roster.balls).toHaveLength(0);
  });

  it('HEAVY_MODULES → heavy ball (autocannon)', () => {
    const roster = projectMiningRoster([mk('mod-autocannon')]);
    expect(roster.balls[0].type).toBe('heavy');
  });
});

describe('projectMiningRoster — passives', () => {
  it('maps each Clone Bay matrix to its surface passive', () => {
    expect(projectMiningRoster([mk('mod-scavenger-matrix')]).passives).toEqual([
      { kind: 'yield-percent', percent: 15 },
    ]);
    expect(projectMiningRoster([mk('mod-enforcer-matrix')]).passives).toEqual([
      { kind: 'extra-peg-hit' },
    ]);
    expect(projectMiningRoster([mk('mod-assault-matrix')]).passives).toEqual([
      { kind: 'aim-assist' },
    ]);
    // Standard Print is baseline — no passive.
    expect(projectMiningRoster([mk('mod-standard-print-matrix')]).passives).toEqual([]);
  });

  it('repair-matrix contributes no passive (null entry)', () => {
    expect(projectMiningRoster([mk('mod-repair-matrix')]).passives).toEqual([]);
  });
});

describe('Mk tier buffs both faces', () => {
  it('a Mk II module yields a richer ball AND different cards than Mk I', () => {
    const mk1 = projectMiningRoster([mk('mod-mining-laser', 1)]);
    const mk2 = projectMiningRoster([mk('mod-mining-laser', 2)]);
    // Ball face: tier + yield change.
    expect(mk2.balls[0].tier).toBe(2);
    expect(mk2.balls[0].yieldMultiplier).toBeGreaterThan(mk1.balls[0].yieldMultiplier);
    // Card face: deck.ts produces different cards at Mk II.
    const mk1Cards = generateCombatDeck([mk('mod-mining-laser', 1)]).map((c) => c.cardId);
    const mk2Cards = generateCombatDeck([mk('mod-mining-laser', 2)]).map((c) => c.cardId);
    expect(mk2Cards).not.toEqual(mk1Cards);
  });
});
