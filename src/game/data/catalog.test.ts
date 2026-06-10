import { describe, expect, it } from 'vitest';

import { CARD_DEFS, HULL_DEFS, MODULE_DEFS, getCard, getHull, getModule } from './index';
import type { ModuleTier } from './types';

function moduleTiers(): { moduleId: string; tierName: string; tier: ModuleTier }[] {
  return MODULE_DEFS.flatMap((m) =>
    Object.entries(m.tiers)
      .filter(([, tier]) => tier !== undefined)
      .map(([tierName, tier]) => ({ moduleId: m.id, tierName, tier })),
  );
}

describe('catalog ids', () => {
  it('are unique across all definitions', () => {
    const ids = [
      ...CARD_DEFS.map((c) => c.id),
      ...MODULE_DEFS.map((m) => m.id),
      ...HULL_DEFS.map((h) => h.id),
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('follow the canonical prefix scheme', () => {
    for (const card of CARD_DEFS) {
      expect(card.id).toMatch(/^card-[a-z0-9-]+$/);
    }
    for (const mod of MODULE_DEFS) {
      expect(mod.id).toMatch(/^mod-[a-z0-9-]+$/);
    }
    for (const hull of HULL_DEFS) {
      expect(hull.id).toMatch(/^hull-[a-z0-9-]+$/);
    }
  });

  it('lookups throw on unknown ids', () => {
    expect(() => getCard('card-nope')).toThrow('card-nope');
    expect(() => getModule('mod-nope')).toThrow('mod-nope');
    expect(() => getHull('hull-nope')).toThrow('hull-nope');
  });
});

describe('module catalog', () => {
  it('every referenced card exists', () => {
    for (const { tier } of moduleTiers()) {
      for (const cardId of tier.cards) {
        expect(() => getCard(cardId)).not.toThrow();
      }
    }
  });

  it('every tier contributes 1-4 cards (GDD §5.3)', () => {
    for (const { moduleId, tierName, tier } of moduleTiers()) {
      expect(tier.cards.length, `${moduleId} ${tierName}`).toBeGreaterThanOrEqual(1);
      expect(tier.cards.length, `${moduleId} ${tierName}`).toBeLessThanOrEqual(4);
    }
  });

  it('every card is referenced by at least one module', () => {
    const referenced = new Set(moduleTiers().flatMap(({ tier }) => tier.cards));
    for (const card of CARD_DEFS) {
      expect(referenced.has(card.id), `orphan card ${card.id}`).toBe(true);
    }
  });

  it('every clone bay matrix contributes exactly 1 card (GDD §4.2)', () => {
    const matrices = MODULE_DEFS.filter((m) => m.slot === 'clone-bay');
    expect(matrices.length).toBe(5);
    for (const matrix of matrices) {
      expect(matrix.tiers.mk1.cards.length, matrix.id).toBe(1);
    }
  });
});

describe('hull catalog', () => {
  it('covers the four GDD §4.1 hulls', () => {
    expect(HULL_DEFS.map((h) => h.id).sort()).toEqual([
      'hull-freighter',
      'hull-gunship',
      'hull-scout',
      'hull-tactical',
    ]);
  });

  it('starting modules exist and fit the slot profile', () => {
    for (const hull of HULL_DEFS) {
      const counts = { weapon: 0, utility: 0, engine: 0, 'clone-bay': 0 };
      for (const moduleId of hull.startingModules) {
        counts[getModule(moduleId).slot] += 1;
      }
      expect(counts.weapon, hull.id).toBeLessThanOrEqual(hull.slots.weapon);
      expect(counts.utility, hull.id).toBeLessThanOrEqual(hull.slots.utility);
      expect(counts.engine, hull.id).toBeLessThanOrEqual(hull.slots.engine);
      expect(counts['clone-bay'], hull.id).toBe(1);
    }
  });

  it('every hull starts with the Standard Print Matrix (GDD §4.1)', () => {
    for (const hull of HULL_DEFS) {
      expect(hull.startingModules, hull.id).toContain('mod-standard-print-matrix');
    }
  });
});
