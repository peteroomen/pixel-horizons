import { describeModuleCards } from './combat-view';
import type { ModuleCardView } from './combat-view';
import { getModule } from './data';
import type { ModuleSlot } from './data';
import { BALL_GLYPH } from './data/core-breaker';
import type { BallGlyph } from './data/core-breaker';
import type { BallType } from './surface/core-breaker';
import { projectMiningRoster } from './surface/ball-projection';
import {
  canInstallModule,
  canUninstallModule,
  canUpgradeReactor,
  craftCost,
  slotUsage,
} from './sim/economy';
import type { SlotUsage } from './sim/economy';
import type { Resources, RunState } from './sim/run-state';

export type { BallGlyph };

export interface ShipModuleView {
  id: string;
  name: string;
  slot: ModuleSlot;
  tier: 1 | 2;
  canUninstall: boolean;
  /** Cards this module contributes to the deck (GDD §5.3) — for the inspect preview. */
  cards: ModuleCardView[];
  /** Surface face (§6.4): the ball this module fires in Core Breaker. null for clone-bay passives. */
  ballFace: { type: BallType; glyph: BallGlyph } | null;
}

export interface CargoModuleView {
  id: string;
  name: string;
  slot: ModuleSlot;
  tier: 1 | 2;
  canInstall: boolean;
  cards: ModuleCardView[];
  /** Surface face (§6.4): what ball this module would fire if installed. null for clone-bay passives. */
  ballFace: { type: BallType; glyph: BallGlyph } | null;
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

function modulesBallFaces(
  modules: RunState['modules'],
): Map<number, { type: BallType; glyph: BallGlyph }> {
  const roster = projectMiningRoster(modules);
  return new Map(
    roster.balls.map((b) => [b.moduleIndex, { type: b.type, glyph: BALL_GLYPH[b.type] }]),
  );
}

export function buildShipView(run: RunState): ShipView {
  const installedFaces = modulesBallFaces(run.modules);
  const cargoFaces = modulesBallFaces(run.cargo);
  return {
    modules: run.modules.map((mod, index) => ({
      id: mod.id,
      name: getModule(mod.id).name,
      slot: getModule(mod.id).slot,
      tier: mod.tier,
      canUninstall: canUninstallModule(run, index),
      cards: describeModuleCards(mod.id, mod.tier),
      ballFace: installedFaces.get(index) ?? null,
    })),
    cargo: run.cargo.map((mod, index) => ({
      id: mod.id,
      name: getModule(mod.id).name,
      slot: getModule(mod.id).slot,
      tier: mod.tier,
      canInstall: canInstallModule(run, index),
      cards: describeModuleCards(mod.id, mod.tier),
      ballFace: cargoFaces.get(index) ?? null,
    })),
    slots: slotUsage(run.hullId, run.modules),
    reactorLevel: run.reactorLevel,
    canUpgradeReactor: canUpgradeReactor(run),
    resources: { ...run.resources },
    hullHp: run.hullHp,
    craftCost: craftCost(),
  };
}
