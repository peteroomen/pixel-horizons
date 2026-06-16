import { POD_WARNING_MS, REPRINT_SCRAP_COST } from '@/game/data/surface';
import type { Resources } from '@/game/sim/run-state';
import { backpackUsed } from './surface/mining';
import { canLaunchPod } from './surface/surface';
import type { SurfaceOutcome, SurfaceState } from './surface/surface';

export interface SurfaceItemView {
  name: string;
  /** False = projected but over the reactor item cap (GDD §4.3). */
  active: boolean;
  /** Clone Bay chassis — always active, shown apart from equipment. */
  chassis: boolean;
}

/**
 * The React-facing surface snapshot (sibling of CombatView). Built by main.ts
 * after sim steps and emitted through onSurfaceUpdate only when it differs
 * from the last emission — once per discrete change, never per frame. Every
 * Resources field is a copy, never a reference into mutable sim state.
 */
export interface SurfaceView {
  /** ceil(remainingMs / 1000) — shows the full window immediately, 0 only at launch. Null = level has no pod. */
  podSecondsLeft: number | null;
  podWindowSeconds: number | null;
  /** True inside the POD_WARNING_MS urgency window (HUD turns red). */
  podWarning: boolean;
  backpack: Resources;
  backpackUsed: number;
  backpackCapacity: number;
  deposited: Resources;
  /** Clone is standing on the pod — the LAUNCH button is offered (GDD §6.2). */
  canLaunch: boolean;
  outcome: SurfaceOutcome;
  /** Backpack contents lost at a stranded launch — for the result overlay. Null otherwise. */
  lostBackpack: Resources | null;
  /** Projected items in install order — static for the duration of a drop. */
  items: SurfaceItemView[];
  /**
   * Whole seconds until the dash is ready (0 = ready now), or null when no
   * dash is projected. Second-rounded so the change-only emission contract
   * holds — never a per-frame React update.
   */
  dashCooldownSeconds: number | null;
  /** Clone hit points (GDD §6.3) — drives the HUD pips. */
  cloneHp: number;
  cloneMaxHp: number;
  /** Clone is dead and the Cloning Bay overlay should show (GDD §6.10). */
  cloneDead: boolean;
  /** Re-prints used this visit — first re-print is free, then it costs Scrap. */
  reprintsUsed: number;
  /** Scrap cost of the pending re-print (0 = free first re-print). */
  reprintScrapCost: number;
  /** Whether the player can currently afford the re-print — set by main.ts from run Scrap. */
  canReprint: boolean;
  /** Shield Bubble status: true = ready, false = recharging, null = no shield. */
  shieldReady: boolean | null;
  /** A recoverable corpse is on the surface (GDD §6.10). */
  corpsePresent: boolean;
}

const ZERO_RESOURCES: Resources = { scrap: 0, biominerals: 0, coreCrystals: 0, blueprints: 0 };

export function buildSurfaceView(state: SurfaceState): SurfaceView {
  const { pod, clone, loadout } = state;
  return {
    podSecondsLeft: pod === null ? null : Math.ceil(pod.remainingMs / 1000),
    podWindowSeconds: pod === null ? null : Math.ceil(pod.windowMs / 1000),
    podWarning: pod !== null && !pod.launched && pod.remainingMs <= POD_WARNING_MS,
    backpack: { ...clone.backpack },
    backpackUsed: backpackUsed(clone.backpack),
    backpackCapacity: loadout.backpackCapacity,
    deposited: pod === null ? { ...ZERO_RESOURCES } : { ...pod.deposited },
    canLaunch: canLaunchPod(state),
    outcome: state.outcome,
    lostBackpack: state.lostBackpack === null ? null : { ...state.lostBackpack },
    items: loadout.items.map((item) => ({
      name: item.name,
      active: item.active,
      chassis: item.chassis,
    })),
    dashCooldownSeconds:
      loadout.capabilities.dash === null ? null : Math.ceil(clone.dashCooldownMs / 1000),
    cloneHp: clone.hp,
    cloneMaxHp: clone.maxHp,
    cloneDead: clone.dead,
    reprintsUsed: state.reprintsUsed,
    // Free first re-print per visit, then a flat Scrap cost (GDD §6.4/§6.10).
    reprintScrapCost: state.reprintsUsed === 0 ? 0 : REPRINT_SCRAP_COST,
    // main.ts overrides this against the run's banked Scrap; default assumes free.
    canReprint: clone.dead && state.reprintsUsed === 0,
    shieldReady: clone.shield === null ? null : clone.shield.ready,
    corpsePresent: state.corpse !== null,
  };
}

function resourcesEqual(a: Resources, b: Resources): boolean {
  return (
    a.scrap === b.scrap &&
    a.biominerals === b.biominerals &&
    a.coreCrystals === b.coreCrystals &&
    a.blueprints === b.blueprints
  );
}

function itemsEqual(a: SurfaceItemView[], b: SurfaceItemView[]): boolean {
  return (
    a.length === b.length &&
    a.every(
      (item, i) =>
        item.name === b[i].name && item.active === b[i].active && item.chassis === b[i].chassis,
    )
  );
}

/** Field-wise equality — main.ts emits onSurfaceUpdate only when this is false. */
export function surfaceViewEquals(a: SurfaceView, b: SurfaceView): boolean {
  return (
    a.dashCooldownSeconds === b.dashCooldownSeconds &&
    itemsEqual(a.items, b.items) &&
    a.podSecondsLeft === b.podSecondsLeft &&
    a.podWindowSeconds === b.podWindowSeconds &&
    a.podWarning === b.podWarning &&
    a.backpackUsed === b.backpackUsed &&
    a.backpackCapacity === b.backpackCapacity &&
    a.canLaunch === b.canLaunch &&
    a.outcome === b.outcome &&
    a.cloneHp === b.cloneHp &&
    a.cloneMaxHp === b.cloneMaxHp &&
    a.cloneDead === b.cloneDead &&
    a.reprintsUsed === b.reprintsUsed &&
    a.reprintScrapCost === b.reprintScrapCost &&
    a.canReprint === b.canReprint &&
    a.shieldReady === b.shieldReady &&
    a.corpsePresent === b.corpsePresent &&
    resourcesEqual(a.backpack, b.backpack) &&
    resourcesEqual(a.deposited, b.deposited) &&
    (a.lostBackpack === null) === (b.lostBackpack === null) &&
    (a.lostBackpack === null ||
      b.lostBackpack === null ||
      resourcesEqual(a.lostBackpack, b.lostBackpack))
  );
}
