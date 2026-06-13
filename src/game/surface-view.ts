import { POD_WARNING_MS } from '@/game/data/surface';
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
    resourcesEqual(a.backpack, b.backpack) &&
    resourcesEqual(a.deposited, b.deposited) &&
    (a.lostBackpack === null) === (b.lostBackpack === null) &&
    (a.lostBackpack === null ||
      b.lostBackpack === null ||
      resourcesEqual(a.lostBackpack, b.lostBackpack))
  );
}
