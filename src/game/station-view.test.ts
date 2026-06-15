import { describe, expect, it } from 'vitest';

import { createRunState } from './sim/run-state';
import { slotUsage } from './sim/economy';
import { buildMerchantView } from './station-view';

function shopRun() {
  const run = createRunState('test-station-view');
  run.position = { ...run.position, sector: 1, nodeId: 'n2-0' };
  return run;
}

describe('buildMerchantView', () => {
  it('exposes the slot picture matching slotUsage', () => {
    const run = shopRun();
    const view = buildMerchantView(run);
    expect(view.slots).toEqual(slotUsage(run.hullId, run.modules));
  });

  it('every offer carries its slot and a card preview', () => {
    const view = buildMerchantView(shopRun());
    for (const offer of view.offers) {
      expect(['weapon', 'utility', 'engine', 'clone-bay']).toContain(offer.slot);
      expect(offer.cards.length).toBeGreaterThan(0);
      expect(offer.cards[0]).toHaveProperty('name');
      expect(offer.cards[0]).toHaveProperty('apCost');
    }
  });

  it('blocks an unaffordable offer with the full scrap picture', () => {
    const run = shopRun();
    run.resources = { scrap: 0, biominerals: 0, coreCrystals: 0, blueprints: 0 };
    const view = buildMerchantView(run);
    // With no scrap, any offer that still has slot room is blocked on scrap, not slot.
    const scrapBlocked = view.offers.find((o) => o.blockReason?.kind === 'need-scrap');
    expect(scrapBlocked).toBeDefined();
    const block = scrapBlocked!.blockReason!;
    expect(block.kind).toBe('need-scrap');
    if (block.kind === 'need-scrap') {
      expect(block.price).toBe(scrapBlocked!.price);
      expect(block.have).toBe(0);
    }
  });
});
