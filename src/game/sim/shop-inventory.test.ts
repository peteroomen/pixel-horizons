import { describe, expect, it } from 'vitest';

import { SHOP_OFFER_COUNT } from '@/game/data/economy';
import { generateShopOffers } from './shop-inventory';

describe('generateShopOffers', () => {
  it('returns SHOP_OFFER_COUNT distinct module offers', () => {
    const offers = generateShopOffers('test-seed', 1, 'n2-0');
    expect(offers).toHaveLength(SHOP_OFFER_COUNT);
    const ids = offers.map((o) => o.moduleId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('same (seed, sector, nodeId) = identical offers (determinism)', () => {
    const a = generateShopOffers('det-seed', 1, 'n2-1');
    const b = generateShopOffers('det-seed', 1, 'n2-1');
    expect(a).toEqual(b);
  });

  it('different nodes on the same seed produce different inventories', () => {
    const a = generateShopOffers('test-seed', 1, 'n2-0');
    const b = generateShopOffers('test-seed', 1, 'n3-1');
    expect(a).not.toEqual(b);
  });

  it('every offer has a positive price', () => {
    const offers = generateShopOffers('price-check', 1, 'n1-0');
    expect(offers.every((o) => o.price > 0)).toBe(true);
  });
});
