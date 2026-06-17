import type { Application } from 'pixi.js';

import { type OrbitRenderer, createOrbitRenderer } from '@/renderer/orbit-renderer';
import type { PlanetDescriptor } from '../sim/planet';

/**
 * Orbit mode: a static screen of the generated planet at a planet node, before the clone
 * drops to the surface (6.1). No sim loop or input — it only owns the orbit renderer and
 * tears it down symmetrically, mirroring the combat/surface modes so main.ts orchestrates
 * uniformly.
 */
export interface OrbitMode {
  destroy(): void;
}

export function startOrbitMode(app: Application, descriptor: PlanetDescriptor): OrbitMode {
  const renderer: OrbitRenderer = createOrbitRenderer(app, descriptor);
  return {
    destroy(): void {
      renderer.destroy();
    },
  };
}
