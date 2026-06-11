import { createClone, updateClone } from './clone';
import type { CloneState, InputState } from './clone';
import { parseLevel } from './tilemap';
import type { Tilemap } from './tilemap';

export interface SurfaceState {
  map: Tilemap;
  clone: CloneState;
}

/** Build a SurfaceState from ASCII level rows. */
export function createSurface(rows: string[]): SurfaceState {
  const map = parseLevel(rows);
  const clone = createClone(map);
  return { map, clone };
}

/**
 * Advance the surface simulation one fixed timestep.
 * Called by main.ts's fixed-timestep accumulator loop.
 */
export function updateSurface(state: SurfaceState, input: InputState, dtMs: number): void {
  updateClone(state.clone, state.map, input, dtMs);
}
