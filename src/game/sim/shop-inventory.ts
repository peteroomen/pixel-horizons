import { SHOP_MODULE_POOL, SHOP_OFFER_COUNT } from '@/game/data/economy';
import { modulePrice } from './economy';
import { deriveRng } from './rng';

export interface ShopOffer {
  moduleId: string;
  price: number;
}

/**
 * Deterministic merchant inventory — a pure function of (seed, sector, nodeId)
 * on a derived stream, never serialized. Identical after resume because the
 * seed never changes (ADR 005 keystone pattern).
 */
export function generateShopOffers(seed: string, sector: number, nodeId: string): ShopOffer[] {
  const rng = deriveRng(seed, `shop-${sector}-${nodeId}`);
  const offers: ShopOffer[] = [];
  const used = new Set<number>();

  for (let i = 0; i < SHOP_OFFER_COUNT && used.size < SHOP_MODULE_POOL.length; i++) {
    let idx = rng.int(0, SHOP_MODULE_POOL.length);
    while (used.has(idx)) {
      idx = (idx + 1) % SHOP_MODULE_POOL.length;
    }
    used.add(idx);
    const moduleId = SHOP_MODULE_POOL[idx];
    offers.push({ moduleId, price: modulePrice(moduleId) });
  }

  return offers;
}
