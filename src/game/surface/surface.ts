import { POD_WINDOW_MS } from '@/game/data/surface';
import type { Resources } from '@/game/sim/run-state';
import { createClone, updateClone } from './clone';
import type { CloneState, InputState } from './clone';
import { baselineLoadout } from './items';
import type { SurfaceLoadout } from './items';
import { addYield, scaleYield, tileYield } from './mining';
import { createPod, depositBackpack, podOverlapsClone, tickPod } from './pod';
import type { PodState } from './pod';
import { parseLevel } from './tilemap';
import type { Tilemap } from './tilemap';

/**
 * How a surface run ended (GDD §6.2/§6.4): 'aboard' — clone was on the pod at
 * launch, everything banked; 'stranded' — pod left without the clone, backpack
 * lost, deposited resources safe, consciousness snaps to orbit; 'abandoned' —
 * the player recalled the clone early (escape valve for soft-locks), same
 * consequences as stranded.
 */
export type SurfaceOutcome = 'ongoing' | 'aboard' | 'stranded' | 'abandoned';

export interface SurfaceState {
  map: Tilemap;
  clone: CloneState;
  pod: PodState | null;
  /** Items projected from the ship's modules (GDD §6.3) — fixed for the drop. */
  loadout: SurfaceLoadout;
  outcome: SurfaceOutcome;
  /** Snapshot of the backpack lost at a stranded launch; null otherwise. */
  lostBackpack: Resources | null;
}

export interface CreateSurfaceOptions {
  /** Override the base pod window (dev knob / tests). Defaults to POD_WINDOW_MS. */
  podWindowMs?: number;
  /** Module-projected items. Defaults to the bare clone. */
  loadout?: SurfaceLoadout;
}

/** Build a SurfaceState from ASCII level rows. */
export function createSurface(rows: string[], options?: CreateSurfaceOptions): SurfaceState {
  const map = parseLevel(rows);
  const loadout = options?.loadout ?? baselineLoadout();
  const clone = createClone(map, loadout.capabilities);
  // Engine quality extends the launch window on top of the base (GDD §6.2)
  const pod = createPod(map, (options?.podWindowMs ?? POD_WINDOW_MS) + loadout.podWindowBonusMs);
  return { map, clone, pod, loadout, outcome: 'ongoing', lostBackpack: null };
}

/**
 * Advance the surface simulation one fixed timestep.
 * Called by main.ts's fixed-timestep accumulator loop.
 *
 * Order matters: deposit happens before the pod tick, so a clone standing on
 * the pod at expiry has already banked its backpack that same step — "aboard
 * with a full backpack" is impossible by construction.
 */
export function updateSurface(state: SurfaceState, input: InputState, dtMs: number): void {
  if (state.outcome !== 'ongoing') return;

  const { brokenTiles } = updateClone(state.clone, state.map, input, dtMs);

  for (const tile of brokenTiles) {
    const delta = tileYield(tile);
    if (delta !== null) {
      addYield(
        state.clone.backpack,
        scaleYield(delta, state.loadout.yieldMultiplier),
        state.loadout.backpackCapacity,
      );
    }
  }

  const { pod } = state;
  if (pod === null) return;

  const overlapping = podOverlapsClone(pod, state.clone.body);
  if (overlapping) {
    depositBackpack(state.clone, pod);
  }

  if (tickPod(pod, dtMs)) {
    if (overlapping) {
      state.outcome = 'aboard';
    } else {
      strandClone(state, 'stranded');
    }
  }
}

/** Backpack is lost, deposits stay safe, the sim freezes (GDD §6.2). */
function strandClone(state: SurfaceState, outcome: 'stranded' | 'abandoned'): void {
  state.outcome = outcome;
  state.lostBackpack = { ...state.clone.backpack };
  state.clone.backpack = { scrap: 0, biominerals: 0, coreCrystals: 0, blueprints: 0 };
  if (state.pod !== null) {
    state.pod.launched = true;
  }
}

/** Whether a manual early launch is currently possible (clone standing on the pod). */
export function canLaunchPod(state: SurfaceState): boolean {
  return (
    state.outcome === 'ongoing' &&
    state.pod !== null &&
    !state.pod.launched &&
    podOverlapsClone(state.pod, state.clone.body)
  );
}

/**
 * Manual early launch (GDD §6.2 — the timer forces you out, but mining out the
 * map shouldn't force you to wait it out). Only fires with the clone on the
 * pod: the backpack deposits first, so 'aboard' banks everything, same as an
 * on-pod expiry. No-op otherwise — callers gate UI on canLaunchPod.
 */
export function launchPod(state: SurfaceState): void {
  const { pod } = state;
  if (pod === null || !canLaunchPod(state)) return;
  depositBackpack(state.clone, pod);
  pod.launched = true;
  state.outcome = 'aboard';
}

/**
 * Recall the clone to orbit immediately — the always-available escape valve
 * for soft-locks (unclimbable pits). Same consequences as missing the launch
 * window: backpack lost, deposits safe.
 */
export function abandonSurface(state: SurfaceState): void {
  if (state.outcome !== 'ongoing') return;
  strandClone(state, 'abandoned');
}
