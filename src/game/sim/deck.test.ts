import { describe, expect, it } from 'vitest';

import { getHull, getModule } from '../data';
import { generateCombatDeck, generateDeck, moduleIds } from './deck';

function tally(cards: readonly string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const card of cards) {
    counts[card] = (counts[card] ?? 0) + 1;
  }
  return counts;
}

function startingDeck(hullId: string): string[] {
  return generateDeck(moduleIds(getHull(hullId).startingModules));
}

describe('generateDeck', () => {
  it('Scout produces its documented starting deck (GDD §4.1 + §5.8)', () => {
    expect(tally(startingDeck('hull-scout'))).toEqual({
      'card-laser-burst': 2,
      'card-ghost-shift': 2,
      'card-desync-hull': 1,
      'card-burn': 4,
      'card-afterburner': 2,
      'card-telemetry-sync': 1,
    });
  });

  it('Gunship produces its documented starting deck', () => {
    expect(tally(startingDeck('hull-gunship'))).toEqual({
      'card-flak-volley': 2,
      'card-tracer-lock': 1,
      'card-missile-salvo': 1,
      'card-lock-on': 1,
      'card-cannon-burst': 2,
      'card-reinforce': 2,
      'card-emergency-barrier': 1,
      'card-telemetry-sync': 1,
    });
  });

  it('Freighter produces its documented starting deck', () => {
    expect(tally(startingDeck('hull-freighter'))).toEqual({
      'card-slag-shot': 1,
      'card-deep-scan': 1,
      'card-burn': 1,
      'card-cargo-thrust': 1,
      'card-telemetry-sync': 1,
    });
  });

  it('Tactical produces its documented starting deck', () => {
    expect(tally(startingDeck('hull-tactical'))).toEqual({
      'card-laser-burst': 2,
      'card-missile-salvo': 1,
      'card-lock-on': 1,
      'card-reinforce': 2,
      'card-emergency-barrier': 1,
      'card-deep-scan': 1,
      'card-burn': 2,
      'card-afterburner': 1,
      'card-telemetry-sync': 1,
    });
  });

  it('deck size equals the sum of module card contributions (GDD §5.3)', () => {
    for (const hullId of ['hull-scout', 'hull-gunship', 'hull-freighter', 'hull-tactical']) {
      const mods = moduleIds(getHull(hullId).startingModules);
      const expectedSize = mods.reduce((sum, m) => sum + getModule(m.id).tiers.mk1.cards.length, 0);
      expect(startingDeck(hullId).length, hullId).toBe(expectedSize);
    }
  });

  it('appends cards in module-list order and is deterministic', () => {
    const mods = moduleIds(['mod-thruster', 'mod-light-laser']);
    const deck = generateDeck(mods);
    expect(deck).toEqual([
      'card-burn',
      'card-burn',
      'card-afterburner',
      'card-laser-burst',
      'card-laser-burst',
    ]);
    expect(generateDeck(mods)).toEqual(deck);
  });

  it('duplicate modules contribute duplicate card sets', () => {
    expect(generateDeck(moduleIds(['mod-thruster', 'mod-thruster'])).length).toBe(
      generateDeck(moduleIds(['mod-thruster'])).length * 2,
    );
  });

  it('returns an empty deck for no modules', () => {
    expect(generateDeck([])).toEqual([]);
  });

  it('throws on unknown module ids, naming the offender', () => {
    expect(() => generateDeck(moduleIds(['mod-thruster', 'mod-nonexistent']))).toThrow(
      'mod-nonexistent',
    );
  });

  it('mutating the returned deck does not corrupt the catalog', () => {
    const deck = generateDeck(moduleIds(['mod-thruster']));
    deck.pop();
    expect(generateDeck(moduleIds(['mod-thruster'])).length).toBe(3);
  });
});

describe('generateCombatDeck', () => {
  it('tags every card with the index of its contributing module', () => {
    expect(generateCombatDeck(moduleIds(['mod-thruster', 'mod-light-laser']))).toEqual([
      { cardId: 'card-burn', moduleIndex: 0 },
      { cardId: 'card-burn', moduleIndex: 0 },
      { cardId: 'card-afterburner', moduleIndex: 0 },
      { cardId: 'card-laser-burst', moduleIndex: 1 },
      { cardId: 'card-laser-burst', moduleIndex: 1 },
    ]);
  });

  it('duplicate modules keep distinct indices — they are separate malfunction targets', () => {
    const deck = generateCombatDeck(moduleIds(['mod-thruster', 'mod-thruster']));
    expect(new Set(deck.map((card) => card.moduleIndex))).toEqual(new Set([0, 1]));
  });
});
