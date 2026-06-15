import { describeModuleCards } from './combat-view';
import type { ModuleCardView } from './combat-view';
import { getModule } from './data';
import type { ModuleInstance, ModuleSlot } from './data';
import {
  canBuyModule,
  canRepairHull,
  canSellBiominerals,
  canUpgradeModule,
  hasSlotRoom,
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
 * Why an affordable-looking offer can't be bought — the full picture, not just a label
 * (playtest fix #3): a slot block names the slot and its used/limit; a scrap block names
 * the price and what you have. Slot wins over Scrap — fix the cap first.
 */
export type OfferBlock =
  | { kind: 'need-slot'; slot: ModuleSlot; used: number; limit: number }
  | { kind: 'need-scrap'; price: number; have: number };

export interface ShopOfferView {
  moduleId: string;
  moduleName: string;
  price: number;
  /** Slot this module would occupy — shown so the offer's cost in slots is legible. */
  slot: ModuleSlot;
  canBuy: boolean;
  /** Already owned (installed or in cargo) — greyed out, no buy button. */
  owned: boolean;
  /** `null` when buyable or owned; otherwise the reason a blocked buy is blocked. */
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

function ownedModuleIds(run: RunState): Set<string> {
  const ids = new Set<string>();
  for (const m of run.modules) ids.add(m.id);
  for (const m of run.cargo) ids.add(m.id);
  return ids;
}

/** Why a not-buyable offer is blocked. Slot wins over Scrap — fix the cap first. */
function blockReason(
  run: RunState,
  slots: readonly SlotUsage[],
  moduleId: string,
  owned: boolean,
  canBuy: boolean,
): OfferBlock | null {
  if (owned || canBuy) return null;
  if (!hasSlotRoom(run.hullId, run.modules, moduleId)) {
    const slot = getModule(moduleId).slot;
    const usage = slots.find((s) => s.slot === slot);
    return { kind: 'need-slot', slot, used: usage?.used ?? 0, limit: usage?.limit ?? 0 };
  }
  const price = modulePrice(moduleId);
  if (run.resources.scrap < price) {
    return { kind: 'need-scrap', price, have: run.resources.scrap };
  }
  return null;
}

export function buildMerchantView(run: RunState): MerchantView {
  const offers = generateShopOffers(run.seed, run.position.sector, run.position.nodeId!);
  const owned = ownedModuleIds(run);
  const slots = slotUsage(run.hullId, run.modules);
  return {
    kind: 'merchant',
    offers: offers.map((o) => {
      const isOwned = owned.has(o.moduleId);
      const canBuy = !isOwned && canBuyModule(run, o.moduleId);
      const def = getModule(o.moduleId);
      return {
        moduleId: o.moduleId,
        moduleName: def.name,
        price: o.price,
        slot: def.slot,
        canBuy,
        owned: isOwned,
        blockReason: blockReason(run, slots, o.moduleId, isOwned, canBuy),
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
