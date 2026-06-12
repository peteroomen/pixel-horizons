import { BACKPACK_CAPACITY, POD_WINDOW_MS } from '@/game/data/surface';
import type { Resources } from '@/game/sim/run-state';
import { createClone, updateClone } from './clone';
import type { CloneState, InputState } from './clone';
import { addYield, tileYield } from './mining';
import { createPod, depositBackpack, podOverlapsClone, tickPod } from './pod';
import type { PodState } from './pod';
import { parseLevel } from './tilemap';
import type { Tilemap } from './tilemap';

/**
 * How a surface run ended (GDD §6.2/§6.4): 'aboard' — clone was on the pod at
 * launch, everything banked; 'stranded' — pod left without the clone, backpack
 * lost, deposited resources safe, consciousness snaps to orbit.
 */
export type SurfaceOutcome = 'ongoing' | 'aboard' | 'stranded';

export interface SurfaceState {
  map: Tilemap;
  clone: CloneState;
  pod: PodState | null;
  outcome: SurfaceOutcome;
  /** Snapshot of the backpack lost at a stranded launch; null otherwise. */
  lostBackpack: Resources | null;
}

export interface CreateSurfaceOptions {
  /** Override the pod window (dev knob / tests). Defaults to POD_WINDOW_MS. */
  podWindowMs?: number;
}

/** Build a SurfaceState from ASCII level rows. */
export function createSurface(rows: string[], options?: CreateSurfaceOptions): SurfaceState {
  const map = parseLevel(rows);
  const clone = createClone(map);
  const pod = createPod(map, options?.podWindowMs ?? POD_WINDOW_MS);
  return { map, clone, pod, outcome: 'ongoing', lostBackpack: null };
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
      addYield(state.clone.backpack, delta, BACKPACK_CAPACITY);
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
      state.outcome = 'stranded';
      state.lostBackpack = { ...state.clone.backpack };
      state.clone.backpack = { scrap: 0, biominerals: 0, coreCrystals: 0, blueprints: 0 };
    }
  }
}
