import { SHOP_MODULE_POOL, SHOP_OFFER_COUNT } from '@/game/data/economy';
import { modulePrice } from './economy';
import { deriveRng } from './rng';

export interface ShopOffer {
  moduleId: string;
  price: number;
}

/** Stable key used to track a purchased offer across resume (4.13). */
export function shopOfferKey(sector: number, nodeId: string, moduleId: string): string {
  return `${sector}:${nodeId}:${moduleId}`;
}

/**
 * Deterministic merchant inventory — a pure function of (seed, sector, nodeId)
 * on a derived stream, never serialized. Identical after resume because the
 * seed never changes (ADR 005 keystone pattern).
 *
 * `purchasedOffers` is the run's set of already-bought offer keys (4.13): offers
 * that have been purchased are excluded — each component carries 1 stock.
 */
export function generateShopOffers(
  seed: string,
  sector: number,
  nodeId: string,
  purchasedOffers: readonly string[] = [],
): ShopOffer[] {
  const rng = deriveRng(seed, `shop-${sector}-${nodeId}`);
  const allOffers: ShopOffer[] = [];
  const used = new Set<number>();

  for (let i = 0; i < SHOP_OFFER_COUNT && used.size < SHOP_MODULE_POOL.length; i++) {
    let idx = rng.int(0, SHOP_MODULE_POOL.length);
    while (used.has(idx)) {
      idx = (idx + 1) % SHOP_MODULE_POOL.length;
    }
    used.add(idx);
    const moduleId = SHOP_MODULE_POOL[idx];
    allOffers.push({ moduleId, price: modulePrice(moduleId) });
  }

  // Filter out any offers the run has already purchased from this shop (stock = 1).
  const purchasedSet = new Set(purchasedOffers);
  return allOffers.filter((o) => !purchasedSet.has(shopOfferKey(sector, nodeId, o.moduleId)));
}
