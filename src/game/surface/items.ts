import { getModule } from '@/game/data';
import type { ModuleInstance, PlanetItemEffect } from '@/game/data';
import { BACKPACK_CAPACITY, POD_WINDOW_PER_ENGINE_MS } from '@/game/data/surface';

/**
 * Loadout projection (GDD §6.3): installed ship modules project items onto the
 * printed clone. Pure interpretation of catalog data — no module is special-cased
 * by id, only by its declared effects. Tier-aware: reads the module instance's
 * tier, falling back to mk1 if the requested tier is undefined.
 */

export interface DashConfig {
  distancePx: number;
  cooldownMs: number;
}

/**
 * The movement subset of the loadout consumed by clone.ts — economy fields
 * (yields, capacity) deliberately excluded so clone.ts stays economy-free.
 */
export interface CloneCapabilities {
  /** Extra mid-air jumps available after leaving the ground (1 per active Double Jump). */
  maxAirJumps: number;
  jumpVelocityMultiplier: number;
  moveSpeedMultiplier: number;
  dash: DashConfig | null;
}

export const BASELINE_CAPABILITIES: CloneCapabilities = {
  maxAirJumps: 0,
  jumpVelocityMultiplier: 1,
  moveSpeedMultiplier: 1,
  dash: null,
};

export interface ProjectedItem {
  moduleId: string;
  name: string;
  description: string;
  /** False when over the reactor item cap — projected but not equipped (GDD §4.3). */
  active: boolean;
  /**
   * Clone Bay matrices define the printed chassis, not equipment: always
   * active, never counted against the reactor item cap.
   */
  chassis: boolean;
}

export interface SurfaceLoadout {
  /** Every projected item in module install order, including inactive ones (for the HUD). */
  items: ProjectedItem[];
  capabilities: CloneCapabilities;
  /** Combined mining multiplier: mining-yield × (1 + yield-bonus%). */
  yieldMultiplier: number;
  backpackCapacity: number;
  /** Engine-quality pod-window extension — module presence, not item activation (GDD §6.2). */
  podWindowBonusMs: number;
  /** Resource Scanner active: hidden deposit tiles render revealed. */
  scanner: boolean;
  /** Projected but mechanically inert until clone damage exists (3.4). */
  shieldBubble: { cooldownMs: number } | null;
}

/** The bare clone — no modules installed. Used as the default loadout. */
export function baselineLoadout(): SurfaceLoadout {
  return projectLoadout([], 0);
}

export function projectLoadout(
  modules: readonly ModuleInstance[],
  reactorLevel: number,
): SurfaceLoadout {
  const items: ProjectedItem[] = [];
  const activeEffects: PlanetItemEffect[] = [];
  let engineCount = 0;
  let equippedCount = 0;

  for (const mod of modules) {
    const def = getModule(mod.id);
    if (def.slot === 'engine') {
      engineCount += 1;
    }
    const tier = def.tiers[mod.tier === 2 ? 'mk2' : 'mk1'] ?? def.tiers.mk1;
    const item = tier.planetItem;
    if (item === undefined) {
      continue;
    }
    const chassis = def.slot === 'clone-bay';
    const active = chassis || equippedCount < reactorLevel;
    if (!chassis && active) {
      equippedCount += 1;
    }
    items.push({
      moduleId: mod.id,
      name: item.name,
      description: item.description,
      active,
      chassis,
    });
    if (active) {
      activeEffects.push(...(item.effects ?? []));
    }
  }

  let maxAirJumps = 0;
  let jumpVelocityMultiplier = 1;
  let moveSpeedMultiplier = 1;
  let dash: DashConfig | null = null;
  let miningMultiplier = 1;
  let bonusPercent = 0;
  let backpackCapacity = BACKPACK_CAPACITY;
  let scanner = false;
  let shieldBubble: { cooldownMs: number } | null = null;

  for (const effect of activeEffects) {
    switch (effect.kind) {
      case 'double-jump':
        maxAirJumps += 1;
        break;
      case 'high-jump':
        jumpVelocityMultiplier = Math.max(jumpVelocityMultiplier, effect.jumpVelocityMultiplier);
        break;
      case 'move-speed':
        moveSpeedMultiplier *= effect.multiplier;
        break;
      case 'phase-dash':
        dash ??= { distancePx: effect.distancePx, cooldownMs: effect.cooldownMs };
        break;
      case 'mining-yield':
        miningMultiplier *= effect.multiplier;
        break;
      case 'yield-bonus':
        bonusPercent += effect.percent;
        break;
      case 'backpack-capacity':
        backpackCapacity += effect.bonus;
        break;
      case 'deposit-scanner':
        scanner = true;
        break;
      case 'shield-bubble':
        shieldBubble ??= { cooldownMs: effect.cooldownMs };
        break;
    }
  }

  return {
    items,
    capabilities: { maxAirJumps, jumpVelocityMultiplier, moveSpeedMultiplier, dash },
    yieldMultiplier: miningMultiplier * (1 + bonusPercent / 100),
    backpackCapacity,
    podWindowBonusMs: engineCount * POD_WINDOW_PER_ENGINE_MS,
    scanner,
    shieldBubble,
  };
}
