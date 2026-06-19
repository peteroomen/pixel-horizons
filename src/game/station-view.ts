import { describeModuleCards } from './combat-view';
import type { ModuleCardView } from './combat-view';
import { getModule } from './data';
import type { ModuleInstance, ModuleSlot } from './data';
import {
  canBuyModule,
  canRepairHull,
  canSellBiominerals,
  canUpgradeModule,
  modulePrice,
  repairCost,
  slotUsage,
  upgradeCost,
} from './sim/economy';
import type { SlotUsage } from './sim/economy';
import type { Resources, RunState } from './sim/run-state';
import { STARTING_HULL_HP } from './sim/run-state';
import { generateShopOffers } from './sim/shop-inventory';

/**
 * Why an offer can't be bought. Buying is no longer slot-gated (playtest fix): a full
 * slot is shown via the slot picture but never blocks, so the only block is the scrap
 * shortfall — the price and what you have.
 */
export type OfferBlock = { kind: 'need-scrap'; price: number; have: number };

export interface ShopOfferView {
  moduleId: string;
  moduleName: string;
  price: number;
  /** Slot this module would occupy — shown so the offer's cost in slots is legible. */
  slot: ModuleSlot;
  canBuy: boolean;
  /**
   * This offer's stock is gone — the player already bought it from this shop this run.
   * Greyed out with a SOLD OUT label; buying is disabled. (4.13: stock = 1 per offer.)
   */
  soldOut: boolean;
  /** `null` when buyable or sold out; otherwise the reason a blocked buy is blocked. */
  blockReason: OfferBlock | null;
  /** Cards this module would add to the deck (GDD §5.3) — inspect before buying. */
  cards: ModuleCardView[];
}

export interface UpgradeOfferView {
  moduleIndex: number;
  moduleId: string;
  moduleName: string;
  tier: 1 | 2;
  hasMk2: boolean;
  canUpgrade: boolean;
}

export interface MerchantView {
  kind: 'merchant';
  offers: ShopOfferView[];
  /** Per-slot occupancy so the shop shows the slot picture alongside its offers. */
  slots: SlotUsage[];
  canSellBiominerals: boolean;
  sellRate: number;
  resources: Resources;
}

export interface EngineerView {
  kind: 'engineer';
  canRepair: boolean;
  repairCost: { scrap: number; hp: number };
  hullHp: number;
  hullMaxHp: number;
  upgrades: UpgradeOfferView[];
  upgradeCost: { scrap: number; biominerals: number };
  resources: Resources;
}

export type StationView = MerchantView | EngineerView;

/** Why a not-buyable offer is blocked — only ever the scrap shortfall (slots don't gate). */
function blockReason(run: RunState, moduleId: string, canBuy: boolean): OfferBlock | null {
  if (canBuy) return null;
  const price = modulePrice(moduleId);
  if (run.resources.scrap < price) {
    return { kind: 'need-scrap', price, have: run.resources.scrap };
  }
  return null;
}

export function buildMerchantView(run: RunState): MerchantView {
  const { sector, nodeId } = run.position;
  // Pass purchased offers so sold-out items are excluded from the generated list (4.13).
  const offers = generateShopOffers(run.seed, sector, nodeId!, run.purchasedOffers);
  const slots = slotUsage(run.hullId, run.modules);
  return {
    kind: 'merchant',
    offers: offers.map((o) => {
      const canBuy = canBuyModule(run, o.moduleId);
      const def = getModule(o.moduleId);
      return {
        moduleId: o.moduleId,
        moduleName: def.name,
        price: o.price,
        slot: def.slot,
        canBuy,
        soldOut: false,
        blockReason: blockReason(run, o.moduleId, canBuy),
        cards: describeModuleCards(o.moduleId),
      };
    }),
    slots,
    canSellBiominerals: canSellBiominerals(run, 1),
    sellRate: 2,
    resources: { ...run.resources },
  };
}

export function buildEngineerView(run: RunState): EngineerView {
  return {
    kind: 'engineer',
    canRepair: canRepairHull(run),
    repairCost: repairCost(),
    hullHp: run.hullHp,
    hullMaxHp: STARTING_HULL_HP,
    upgrades: run.modules.map((mod: ModuleInstance, index: number) => {
      const def = getModule(mod.id);
      return {
        moduleIndex: index,
        moduleId: mod.id,
        moduleName: def.name,
        tier: mod.tier,
        hasMk2: def.tiers.mk2 !== undefined,
        canUpgrade: canUpgradeModule(run, index),
      };
    }),
    upgradeCost: upgradeCost(),
    resources: { ...run.resources },
  };
}
