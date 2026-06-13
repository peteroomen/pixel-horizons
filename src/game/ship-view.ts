import { getModule } from './data';
import type { ModuleSlot } from './data';
import { canInstallModule, canUninstallModule, canUpgradeReactor, craftCost } from './sim/economy';
import type { Resources, RunState } from './sim/run-state';

export interface ShipModuleView {
  id: string;
  name: string;
  slot: ModuleSlot;
  tier: 1 | 2;
  canUninstall: boolean;
}

export interface CargoModuleView {
  id: string;
  name: string;
  slot: ModuleSlot;
  tier: 1 | 2;
  canInstall: boolean;
}

export interface ShipView {
  modules: ShipModuleView[];
  cargo: CargoModuleView[];
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
    })),
    cargo: run.cargo.map((mod, index) => ({
      id: mod.id,
      name: getModule(mod.id).name,
      slot: getModule(mod.id).slot,
      tier: mod.tier,
      canInstall: canInstallModule(run, index),
    })),
    reactorLevel: run.reactorLevel,
    canUpgradeReactor: canUpgradeReactor(run),
    resources: { ...run.resources },
    hullHp: run.hullHp,
    craftCost: craftCost(),
  };
}
