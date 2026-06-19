/**
 * Resurrect 64 palette lock + per-planet colour ramps (ADR 002 §2, ADR 010).
 *
 * The whole game is colour-mapped to Resurrect 64 (Lospec, by Kerrie Lake) — palette
 * consistency, more than drawing skill, is what makes mixed-source pixel art read as one
 * game. This module is the single source of that palette and of the ramps a runtime-generated
 * planet is built from.
 *
 * Ramps are 6 steps, **index 0 = lightest .. 5 = darkest**, matching the surface tileset's
 * material ramps (`surface-sprites.ts` ROCKY/VOLCANIC/ICE) so a planet's generated ramp can
 * later (5.3, slice 2) be handed straight to the tile factories to recolour the surface to
 * match the planet seen from orbit — the ADR 002 §3 "biomes match the planet" trick.
 *
 * Pure data + math: no PixiJS, no DOM. The planet shader (renderer/planet.ts) consumes these
 * ramps as uniforms; nothing here touches the GPU, so it is fully unit-testable.
 */

import type { PlanetDescriptor } from '@/game/sim/planet';

/** The 64 Resurrect 64 colours, in palette order. The world's entire colour vocabulary. */
export const RESURRECT_64 = [
  '#2e222f',
  '#3e3546',
  '#625565',
  '#966c6c',
  '#ab947a',
  '#694f62',
  '#7f708a',
  '#9babb2',
  '#c7dcd0',
  '#ffffff',
  '#6e2727',
  '#b33831',
  '#ea4f36',
  '#f57d4a',
  '#ae2334',
  '#e83b3b',
  '#fb6b1d',
  '#f79617',
  '#f9c22b',
  '#7a3045',
  '#9e4539',
  '#cd683d',
  '#e6904e',
  '#fbb954',
  '#4c3e24',
  '#676633',
  '#a2a947',
  '#d5e04b',
  '#fbff86',
  '#165a4c',
  '#239063',
  '#1ebc73',
  '#91db69',
  '#cddf6c',
  '#313638',
  '#374e4a',
  '#547e64',
  '#92a984',
  '#b2ba90',
  '#0b5e65',
  '#0b8a8f',
  '#0eaf9b',
  '#30e1b9',
  '#8ff8e2',
  '#323353',
  '#484a77',
  '#4d65b4',
  '#4d9be6',
  '#8fd3ff',
  '#45293f',
  '#6b3e75',
  '#905ea9',
  '#a884f3',
  '#eaaded',
  '#753c54',
  '#a24b6f',
  '#cf657f',
  '#ed8099',
  '#831c5d',
  '#c32454',
  '#f04f78',
  '#f68181',
  '#fca790',
  '#fdcbb0',
] as const;

/** A material ramp: 6 hex steps, lightest (0) → darkest (5). */
export type Ramp = readonly [string, string, string, string, string, string];

/** The ocean + land ramps a single planet is rendered from. */
export interface PlanetRamps {
  ocean: Ramp;
  land: Ramp;
}

// Curated terran ramps, every step a real Resurrect 64 colour (so the lock is exact, no
// snapping needed). Ordered lightest → darkest.
const OCEAN_RAMPS: readonly Ramp[] = [
  ['#8fd3ff', '#4d9be6', '#4d65b4', '#484a77', '#323353', '#2e222f'], // deep blue
  ['#8ff8e2', '#30e1b9', '#0eaf9b', '#0b8a8f', '#0b5e65', '#323353'], // teal
];

const LAND_RAMPS: readonly Ramp[] = [
  ['#cddf6c', '#91db69', '#1ebc73', '#239063', '#165a4c', '#0b5e65'], // verdant green
  ['#b2ba90', '#92a984', '#547e64', '#374e4a', '#313638', '#2e222f'], // grey-green tundra
  ['#fbb954', '#e6904e', '#cd683d', '#9e4539', '#7a3045', '#45293f'], // rust desert (= ROCKY)
];

const hexToRgb = (hex: string): [number, number, number] => {
  const s = hex.replace('#', '');
  return [
    Number.parseInt(s.slice(0, 2), 16),
    Number.parseInt(s.slice(2, 4), 16),
    Number.parseInt(s.slice(4, 6), 16),
  ];
};

/**
 * Snap an arbitrary RGB to its nearest Resurrect 64 colour (squared-euclidean in RGB). Keeps
 * any externally-sourced or computed colour inside the palette lock — the safety net for
 * future generators that don't pick straight from the palette.
 */
export function snapToPalette(rgb: readonly [number, number, number]): string {
  let best: string = RESURRECT_64[0];
  let bestDist = Infinity;
  for (const hex of RESURRECT_64) {
    const [r, g, b] = hexToRgb(hex);
    const d = (r - rgb[0]) ** 2 + (g - rgb[1]) ** 2 + (b - rgb[2]) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = hex;
    }
  }
  return best;
}

// Deterministic, self-contained hash → [0,1). Mirrors the art-side LCG in sprite-primitives
// (no game RNG stream consumed); planet identity already flows from the run seed upstream.
const hash01 = (seed: number): number => {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * The ocean + land ramps for a planet, chosen deterministically from its seed. Same seed →
 * same ramps; different seeds spread across the curated combinations. Every step is a
 * Resurrect 64 colour, so the result is palette-locked by construction.
 */
export function planetRamps(seed: number): PlanetRamps {
  const ocean = OCEAN_RAMPS[Math.floor(hash01(seed) * OCEAN_RAMPS.length) % OCEAN_RAMPS.length];
  const land = LAND_RAMPS[Math.floor(hash01(seed + 1) * LAND_RAMPS.length) % LAND_RAMPS.length];
  return { ocean, land };
}

/** Flatten a ramp to the normalised RGB triples a shader uniform wants (6 × vec3, 0..1). */
export function rampToFloats(ramp: Ramp): number[] {
  return ramp.flatMap((hex) => hexToRgb(hex).map((c) => c / 255));
}

/**
 * The terrain ramp a planet's surface is recoloured with (6.1 slice 2, ADR 010) — the same
 * ramp the planet was generated from, so the ground reads in the hue family the player saw
 * from orbit. Terran is the only type today; 5.3 branches here for Volcanic/Ice. The result is
 * palette-locked by construction (it is one of the curated `planetRamps` ramps).
 */
export function surfaceRampFor(descriptor: PlanetDescriptor): Ramp {
  switch (descriptor.type) {
    case 'terran':
    default:
      return planetRamps(descriptor.seed).land;
  }
}

// Sky ramps: light, desaturated atmospheric gradients (index 0 = brightest zenith,
// index 5 = deepest near-horizon glow). Deliberately lighter than the land ramps so
// platform silhouettes stay legible. One sky ramp per land-ramp hue family.
//
// Mapping: land ramp index → sky ramp family used for that planet seed.
// Keys match the first step of each LAND_RAMPS entry (deterministic lookup via seed).
const SKY_RAMPS: readonly Ramp[] = [
  // verdant green land → soft teal/cyan sky
  ['#8ff8e2', '#30e1b9', '#0eaf9b', '#0b8a8f', '#0b5e65', '#374e4a'],
  // grey-green tundra land → cool grey-blue sky
  ['#c7dcd0', '#9babb2', '#7f708a', '#484a77', '#323353', '#2e222f'],
  // rust desert land → warm peach sky (preserves the existing look)
  ['#fdcbb0', '#fca790', '#e6904e', '#cd683d', '#9e4539', '#7a3045'],
];

/**
 * The sky ramp for a planet's surface backdrop (6.1 slice 3) — a light, desaturated
 * atmospheric gradient palette-locked to Resurrect 64. Distinct from the terrain ramp
 * (which reads muddy as a sky). The hue family follows the land ramp so the sky and
 * ground belong to the same planet without being identical. Terran is the only type today;
 * 5.3 may extend this per type.
 */
export function skyRampFor(descriptor: PlanetDescriptor): Ramp {
  switch (descriptor.type) {
    case 'terran':
    default: {
      const landRamps: readonly Ramp[] = [
        ['#cddf6c', '#91db69', '#1ebc73', '#239063', '#165a4c', '#0b5e65'], // verdant green
        ['#b2ba90', '#92a984', '#547e64', '#374e4a', '#313638', '#2e222f'], // grey-green tundra
        ['#fbb954', '#e6904e', '#cd683d', '#9e4539', '#7a3045', '#45293f'], // rust desert
      ];
      // Same hash01 + modular pick as planetRamps — deterministic per seed.
      const landIdx = Math.floor(hash01(descriptor.seed + 1) * landRamps.length) % landRamps.length;
      return SKY_RAMPS[landIdx];
    }
  }
}
