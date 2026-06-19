import { describe, expect, it } from 'vitest';

import { createRunState } from './sim/run-state';
import { slotUsage } from './sim/economy';
import { shopOfferKey } from './sim/shop-inventory';
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
      expect(['weapon', 'utility', 'engine', 'shield', 'clone-bay']).toContain(offer.slot);
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

  it('purchased offers are excluded from the shop — 1 stock per offer (4.13)', () => {
    const run = shopRun();
    // See which offers exist before purchase.
    const before = buildMerchantView(run);
    expect(before.offers.length).toBeGreaterThan(0);
    const firstOffer = before.offers[0];

    // Simulate a purchase by recording the key on the run.
    run.purchasedOffers.push(
      shopOfferKey(run.position.sector, run.position.nodeId!, firstOffer.moduleId),
    );
    const after = buildMerchantView(run);

    // The purchased offer must no longer appear.
    expect(after.offers.find((o) => o.moduleId === firstOffer.moduleId)).toBeUndefined();
    // The other offers are unaffected.
    expect(after.offers.length).toBe(before.offers.length - 1);
  });

  it('all offers start with soldOut false (sold items are excluded, not flagged)', () => {
    const view = buildMerchantView(shopRun());
    expect(view.offers.every((o) => !o.soldOut)).toBe(true);
  });
});
