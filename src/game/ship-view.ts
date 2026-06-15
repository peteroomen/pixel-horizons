import { describeModuleCards } from './combat-view';
import type { ModuleCardView } from './combat-view';
import { getModule } from './data';
import type { ModuleSlot } from './data';
import {
  canInstallModule,
  canUninstallModule,
  canUpgradeReactor,
  craftCost,
  slotUsage,
} from './sim/economy';
import type { SlotUsage } from './sim/economy';
import type { Resources, RunState } from './sim/run-state';

export interface ShipModuleView {
  id: string;
  name: string;
  slot: ModuleSlot;
  tier: 1 | 2;
  canUninstall: boolean;
  /** Cards this module contributes to the deck (GDD §5.3) — for the inspect preview. */
  cards: ModuleCardView[];
}

export interface CargoModuleView {
  id: string;
  name: string;
  slot: ModuleSlot;
  tier: 1 | 2;
  canInstall: boolean;
  cards: ModuleCardView[];
}

export interface ShipView {
  modules: ShipModuleView[];
  cargo: CargoModuleView[];
  /** Per-slot occupancy so the workbench can show used / free without re-deriving. */
  slots: SlotUsage[];
  reactorLevel: number;
  canUpgradeReactor: boolean;
  resources: Resources;
  hullHp: number;
  craftCost: { scrap: number; biominerals: number; blueprints: number };
}

export function buildShipView(run: RunState): ShipView {
  return {
    modules: run.modules.map((mod, index) => ({
      id: mod.id,
      name: getModule(mod.id).name,
      slot: getModule(mod.id).slot,
      tier: mod.tier,
      canUninstall: canUninstallModule(run, index),
      cards: describeModuleCards(mod.id, mod.tier),
    })),
    cargo: run.cargo.map((mod, index) => ({
      id: mod.id,
      name: getModule(mod.id).name,
      slot: getModule(mod.id).slot,
      tier: mod.tier,
      canInstall: canInstallModule(run, index),
      cards: describeModuleCards(mod.id, mod.tier),
    })),
    slots: slotUsage(run.hullId, run.modules),
    reactorLevel: run.reactorLevel,
    canUpgradeReactor: canUpgradeReactor(run),
    resources: { ...run.resources },
    hullHp: run.hullHp,
    craftCost: craftCost(),
  };
}
