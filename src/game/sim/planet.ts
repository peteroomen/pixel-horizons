import { ALL_PLANET_TYPES, type PlanetType } from '../data/planets';
import { deriveRng } from './rng';

/**
 * A planet's identity (ADR 010). Derived deterministically from the run seed + node id — never
 * stored on RunState, so it can't drift and needs no version bump, and the same node always
 * shows the same planet from map, orbit, and surface. `seed` drives the renderer's shader
 * (`uSeed`) and its palette-ramp selection; `type` picks the generator family.
 */
export interface PlanetDescriptor {
  seed: number;
  type: PlanetType;
}

/** The planet at a given `'planet'` map node, as a pure function of the run seed + node id. */
export function planetForNode(runSeed: string, nodeId: string): PlanetDescriptor {
  const rng = deriveRng(runSeed, `planet-${nodeId}`);
  const type = ALL_PLANET_TYPES[rng.int(0, ALL_PLANET_TYPES.length)];
  const seed = rng.int(0, 1_000_000);
  return { seed, type };
}
