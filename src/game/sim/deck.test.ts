import { describe, expect, it } from 'vitest';

import { getHull, getModule } from '../data';
import { generateDeck } from './deck';

function tally(cards: readonly string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const card of cards) {
    counts[card] = (counts[card] ?? 0) + 1;
  }
  return counts;
}

function startingDeck(hullId: string): string[] {
  return generateDeck(getHull(hullId).startingModules);
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
      const modules = getHull(hullId).startingModules;
      const expectedSize = modules.reduce(
        (sum, id) => sum + getModule(id).tiers.mk1.cards.length,
        0,
      );
      expect(startingDeck(hullId).length, hullId).toBe(expectedSize);
    }
  });

  it('appends cards in module-list order and is deterministic', () => {
    const modules = ['mod-thruster', 'mod-light-laser'];
    const deck = generateDeck(modules);
    expect(deck).toEqual([
      'card-burn',
      'card-burn',
      'card-afterburner',
      'card-laser-burst',
      'card-laser-burst',
    ]);
    expect(generateDeck(modules)).toEqual(deck);
  });

  it('duplicate modules contribute duplicate card sets', () => {
    expect(generateDeck(['mod-thruster', 'mod-thruster']).length).toBe(
      generateDeck(['mod-thruster']).length * 2,
    );
  });

  it('returns an empty deck for no modules', () => {
    expect(generateDeck([])).toEqual([]);
  });

  it('throws on unknown module ids, naming the offender', () => {
    expect(() => generateDeck(['mod-thruster', 'mod-nonexistent'])).toThrow('mod-nonexistent');
  });

  it('mutating the returned deck does not corrupt the catalog', () => {
    const deck = generateDeck(['mod-thruster']);
    deck.pop();
    expect(generateDeck(['mod-thruster']).length).toBe(3);
  });
});
