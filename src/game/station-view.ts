import { getModule } from './data';
import type { ModuleInstance } from './data';
import {
  canBuyModule,
  canRepairHull,
  canSellBiominerals,
  canUpgradeModule,
  repairCost,
  upgradeCost,
} from './sim/economy';
import type { Resources, RunState } from './sim/run-state';
import { STARTING_HULL_HP } from './sim/run-state';
import { generateShopOffers } from './sim/shop-inventory';

export interface ShopOfferView {
  moduleId: string;
  moduleName: string;
  price: number;
  canBuy: boolean;
  /** Already owned (installed or in cargo) — greyed out, no buy button. */
  owned: boolean;
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

export function buildMerchantView(run: RunState): MerchantView {
  const offers = generateShopOffers(run.seed, run.position.sector, run.position.nodeId!);
  const owned = ownedModuleIds(run);
  return {
    kind: 'merchant',
    offers: offers.map((o) => ({
      moduleId: o.moduleId,
      moduleName: getModule(o.moduleId).name,
      price: o.price,
      canBuy: !owned.has(o.moduleId) && canBuyModule(run, o.moduleId),
      owned: owned.has(o.moduleId),
    })),
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
