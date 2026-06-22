/**
 * The single Core Breaker bootstrap. Both entry paths — the standalone `/core-breaker` dev route
 * and the in-game mining phase (`enterMining` in main.ts) — call this so they run the exact same
 * experience; the only difference is how you get here and what happens on completion. Each caller
 * owns its own Pixi app / stage scaling and supplies the inputs (seed, difficulty, modules, planet,
 * viewport) and an optional `onComplete`.
 */

import type { Application } from 'pixi.js';

import { PLANET_TYPES } from '@/game/data/planets';
import type { ModuleInstance } from '@/game/data';
import type { PlanetDescriptor } from '@/game/sim/planet';
import type { Resources } from '@/game/sim/run-state';
import { portraitConfig } from '@/game/surface/core-breaker';
import { projectMiningRoster } from '@/game/surface/ball-projection';
import { generateField } from '@/game/surface/field-gen';

import { surfaceRampFor } from '../palette';
import {
  createCoreBreakerRenderer,
  type CoreBreakerHandle,
  type CoreBreakerHudState,
} from '../core-breaker-renderer';

export interface CoreBreakerSessionOptions {
  /** Seed string for the deterministic field. */
  fieldSeed: string;
  /** Field density / richness (0–4). */
  difficulty: number;
  /** Installed modules → the firing roster. */
  modules: ModuleInstance[];
  /** The planet the run drops to — drives the recolour ramp and biome label. */
  planet: PlanetDescriptor;
  /** Portrait viewport to fill (see `coreBreakerViewport`). */
  viewport: { width: number; height: number };
  /** Fired when the run ends with the banked haul (omit for the sandbox route). */
  onComplete?: (banked: Resources) => void;
  /** HUD state stream for the React HUD. */
  onHud?: (state: CoreBreakerHudState) => void;
}

/** Assemble field + roster + ramp and mount the Core Breaker renderer. */
export function startCoreBreaker(
  app: Application,
  opts: CoreBreakerSessionOptions,
): CoreBreakerHandle {
  const cfg = portraitConfig();
  const pegs = generateField(opts.fieldSeed, cfg, { difficulty: opts.difficulty });
  const roster = projectMiningRoster(opts.modules);
  const landRamp = surfaceRampFor(opts.planet);
  return createCoreBreakerRenderer(app, {
    pegs,
    roster: roster.balls,
    landRamp,
    cfg,
    viewport: opts.viewport,
    biome: PLANET_TYPES[opts.planet.type].name,
    onComplete: opts.onComplete,
    onHud: opts.onHud,
  });
}

export type { CoreBreakerHudState } from '../core-breaker-renderer';
