import { getHull, getModule } from '@/game/data';
import type { ModuleInstance, ModuleSlot } from '@/game/data';
import {
  CRAFT_BIOMINERAL_COST,
  CRAFT_BLUEPRINT_COST,
  CRAFT_SCRAP_COST,
  MODULE_BASE_PRICE,
  MODULE_DEFAULT_PRICE,
  REPAIR_HP_PER_CHUNK,
  REPAIR_SCRAP_COST,
  SELL_BIOMINERAL_SCRAP,
  UPGRADE_BIOMINERAL_COST,
  UPGRADE_SCRAP_COST,
} from '@/game/data/economy';
import type { RunState } from './run-state';
import { STARTING_HULL_HP } from './run-state';

export type TransactionRefusal =
  | 'cannot-afford'
  | 'slot-full'
  | 'already-max-tier'
  | 'no-mk2-defined'
  | 'hull-full-hp'
  | 'not-installed'
  | 'cargo-empty'
  | 'invalid-index';

export type TransactionResult = { ok: true } | { ok: false; reason: TransactionRefusal };

function fail(reason: TransactionRefusal): TransactionResult {
  return { ok: false, reason };
}

const OK: TransactionResult = { ok: true };

// ── Slot math ──

function installedSlotCount(modules: readonly ModuleInstance[], slot: ModuleSlot): number {
  return modules.filter((m) => getModule(m.id).slot === slot).length;
}

function hullSlotLimit(hullId: string, slot: ModuleSlot): number {
  if (slot === 'clone-bay') return 1;
  return getHull(hullId).slots[slot];
}

export function hasSlotRoom(
  hullId: string,
  modules: readonly ModuleInstance[],
  moduleId: string,
): boolean {
  const slot = getModule(moduleId).slot;
  return installedSlotCount(modules, slot) < hullSlotLimit(hullId, slot);
}

// ── Prices ──

export function modulePrice(moduleId: string): number {
  return MODULE_BASE_PRICE[moduleId] ?? MODULE_DEFAULT_PRICE;
}

export function repairCost(): { scrap: number; hp: number } {
  return { scrap: REPAIR_SCRAP_COST, hp: REPAIR_HP_PER_CHUNK };
}

export function upgradeCost(): { scrap: number; biominerals: number } {
  return { scrap: UPGRADE_SCRAP_COST, biominerals: UPGRADE_BIOMINERAL_COST };
}

export function craftCost(): { scrap: number; biominerals: number; blueprints: number } {
  return {
    scrap: CRAFT_SCRAP_COST,
    biominerals: CRAFT_BIOMINERAL_COST,
    blueprints: CRAFT_BLUEPRINT_COST,
  };
}

// ── Can-* checks (UI reads these to disable buttons) ──

export function canRepairHull(run: RunState): boolean {
  return run.hullHp < STARTING_HULL_HP && run.resources.scrap >= REPAIR_SCRAP_COST;
}

export function canBuyModule(run: RunState, moduleId: string): boolean {
  return (
    run.resources.scrap >= modulePrice(moduleId) && hasSlotRoom(run.hullId, run.modules, moduleId)
  );
}

export function canSellBiominerals(run: RunState, count: number): boolean {
  return count > 0 && run.resources.biominerals >= count;
}

export function canUpgradeModule(run: RunState, moduleIndex: number): boolean {
  const mod = run.modules[moduleIndex];
  if (mod === undefined || mod.tier >= 2) return false;
  const def = getModule(mod.id);
  if (def.tiers.mk2 === undefined) return false;
  return (
    run.resources.scrap >= UPGRADE_SCRAP_COST &&
    run.resources.biominerals >= UPGRADE_BIOMINERAL_COST
  );
}

export function canCraftModule(run: RunState, moduleId: string): boolean {
  return (
    run.resources.blueprints >= CRAFT_BLUEPRINT_COST &&
    run.resources.biominerals >= CRAFT_BIOMINERAL_COST &&
    run.resources.scrap >= CRAFT_SCRAP_COST &&
    hasSlotRoom(run.hullId, run.modules, moduleId)
  );
}

export function canInstallModule(run: RunState, cargoIndex: number): boolean {
  const mod = run.cargo[cargoIndex];
  if (mod === undefined) return false;
  return hasSlotRoom(run.hullId, run.modules, mod.id);
}

export function canUninstallModule(run: RunState, moduleIndex: number): boolean {
  const mod = run.modules[moduleIndex];
  if (mod === undefined) return false;
  // Clone-bay cannot be uninstalled
  return getModule(mod.id).slot !== 'clone-bay';
}

export function canUpgradeReactor(run: RunState): boolean {
  return run.resources.coreCrystals >= 1;
}

// ── Mutations (each validates via the matching can-* check) ──

export function repairHull(run: RunState): TransactionResult {
  if (run.hullHp >= STARTING_HULL_HP) return fail('hull-full-hp');
  if (run.resources.scrap < REPAIR_SCRAP_COST) return fail('cannot-afford');
  run.resources.scrap -= REPAIR_SCRAP_COST;
  run.hullHp = Math.min(run.hullHp + REPAIR_HP_PER_CHUNK, STARTING_HULL_HP);
  return OK;
}

export function buyModule(run: RunState, moduleId: string): TransactionResult {
  const price = modulePrice(moduleId);
  if (run.resources.scrap < price) return fail('cannot-afford');
  if (!hasSlotRoom(run.hullId, run.modules, moduleId)) return fail('slot-full');
  run.resources.scrap -= price;
  run.modules.push({ id: moduleId, tier: 1 });
  return OK;
}

export function sellBiominerals(run: RunState, count: number): TransactionResult {
  if (count <= 0 || run.resources.biominerals < count) return fail('cannot-afford');
  run.resources.biominerals -= count;
  run.resources.scrap += count * SELL_BIOMINERAL_SCRAP;
  return OK;
}

export function upgradeModule(run: RunState, moduleIndex: number): TransactionResult {
  const mod = run.modules[moduleIndex];
  if (mod === undefined) return fail('invalid-index');
  if (mod.tier >= 2) return fail('already-max-tier');
  const def = getModule(mod.id);
  if (def.tiers.mk2 === undefined) return fail('no-mk2-defined');
  if (
    run.resources.scrap < UPGRADE_SCRAP_COST ||
    run.resources.biominerals < UPGRADE_BIOMINERAL_COST
  ) {
    return fail('cannot-afford');
  }
  run.resources.scrap -= UPGRADE_SCRAP_COST;
  run.resources.biominerals -= UPGRADE_BIOMINERAL_COST;
  mod.tier = 2;
  return OK;
}

export function craftModule(run: RunState, moduleId: string): TransactionResult {
  if (
    run.resources.blueprints < CRAFT_BLUEPRINT_COST ||
    run.resources.biominerals < CRAFT_BIOMINERAL_COST ||
    run.resources.scrap < CRAFT_SCRAP_COST
  ) {
    return fail('cannot-afford');
  }
  if (!hasSlotRoom(run.hullId, run.modules, moduleId)) return fail('slot-full');
  run.resources.blueprints -= CRAFT_BLUEPRINT_COST;
  run.resources.biominerals -= CRAFT_BIOMINERAL_COST;
  run.resources.scrap -= CRAFT_SCRAP_COST;
  run.modules.push({ id: moduleId, tier: 1 });
  return OK;
}

export function installModule(run: RunState, cargoIndex: number): TransactionResult {
  const mod = run.cargo[cargoIndex];
  if (mod === undefined) return fail('invalid-index');
  if (!hasSlotRoom(run.hullId, run.modules, mod.id)) return fail('slot-full');
  run.cargo.splice(cargoIndex, 1);
  run.modules.push(mod);
  return OK;
}

export function uninstallModule(run: RunState, moduleIndex: number): TransactionResult {
  const mod = run.modules[moduleIndex];
  if (mod === undefined) return fail('invalid-index');
  if (getModule(mod.id).slot === 'clone-bay') return fail('not-installed');
  run.modules.splice(moduleIndex, 1);
  run.cargo.push(mod);
  return OK;
}

export function upgradeReactor(run: RunState): TransactionResult {
  if (run.resources.coreCrystals < 1) return fail('cannot-afford');
  run.resources.coreCrystals -= 1;
  run.reactorLevel += 1;
  return OK;
}
