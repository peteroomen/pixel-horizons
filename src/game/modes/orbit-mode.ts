import type { Application } from 'pixi.js';

import { type OrbitRenderer, createOrbitRenderer } from '@/renderer/orbit-renderer';
import type { PlanetDescriptor } from '../sim/planet';

/**
 * Orbit mode: the generated planet (rotating) + the player's ship at a planet node, before the
 * clone drops to the surface (6.1). No sim loop or input — it only owns the orbit renderer and
 * tears it down symmetrically, mirroring the combat/surface modes so main.ts orchestrates
 * uniformly. `hullId` + `shipModules` (installed module names) composite the player's actual
 * ship — the same hull+components combat shows, not the default hull.
 */
export interface OrbitMode {
  destroy(): void;
}

export function startOrbitMode(
  app: Application,
  descriptor: PlanetDescriptor,
  hullId: string,
  shipModules: readonly string[],
): OrbitMode {
  const renderer: OrbitRenderer = createOrbitRenderer(app, descriptor, hullId, shipModules);
  return {
    destroy(): void {
      renderer.destroy();
    },
  };
}
