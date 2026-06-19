import { describe, expect, it } from 'vitest';

import {
  RESURRECT_64,
  planetRamps,
  rampToFloats,
  skyRampFor,
  snapToPalette,
  surfaceRampFor,
} from './palette';

describe('Resurrect 64 palette', () => {
  it('has 64 unique colours, all 6-digit hex', () => {
    expect(RESURRECT_64).toHaveLength(64);
    expect(new Set(RESURRECT_64).size).toBe(64);
    for (const hex of RESURRECT_64) expect(hex).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('snapToPalette', () => {
  it('returns an exact palette colour when given one', () => {
    expect(snapToPalette([0x4d, 0x9b, 0xe6])).toBe('#4d9be6');
  });

  it('snaps a near colour to the closest palette entry', () => {
    // a hair off #4d9be6 → still snaps to it, not a different blue
    expect(snapToPalette([0x50, 0x99, 0xe2])).toBe('#4d9be6');
  });

  it('always returns a member of the palette', () => {
    expect(RESURRECT_64).toContain(snapToPalette([123, 200, 17]));
  });
});

describe('planetRamps', () => {
  it('is deterministic — same seed gives identical ramps', () => {
    expect(planetRamps(42)).toEqual(planetRamps(42));
  });

  it('produces 6-step ramps, every step a palette colour', () => {
    const { ocean, land } = planetRamps(7);
    expect(ocean).toHaveLength(6);
    expect(land).toHaveLength(6);
    for (const hex of [...ocean, ...land]) expect(RESURRECT_64).toContain(hex);
  });

  it('spreads across more than one combination over many seeds', () => {
    const combos = new Set(Array.from({ length: 40 }, (_, i) => JSON.stringify(planetRamps(i))));
    expect(combos.size).toBeGreaterThan(1);
  });
});

describe('surfaceRampFor', () => {
  it('terran uses the planet land ramp (orbit and surface agree)', () => {
    expect(surfaceRampFor({ seed: 42, type: 'terran' })).toEqual(planetRamps(42).land);
  });

  it('is deterministic — same descriptor gives the same terrain ramp', () => {
    const d = { seed: 7, type: 'terran' } as const;
    expect(surfaceRampFor(d)).toEqual(surfaceRampFor(d));
  });

  it('returns a 6-step ramp, every step palette-locked', () => {
    const ramp = surfaceRampFor({ seed: 13, type: 'terran' });
    expect(ramp).toHaveLength(6);
    for (const hex of ramp) expect(RESURRECT_64).toContain(hex);
  });

  it('spans light → dark (a readable contrast spread, not a flat ramp)', () => {
    const lum = (hex: string): number => {
      const n = Number.parseInt(hex.slice(1), 16);
      return ((n >> 16) & 0xff) + ((n >> 8) & 0xff) + (n & 0xff);
    };
    for (let seed = 0; seed < 20; seed++) {
      const ramp = surfaceRampFor({ seed, type: 'terran' });
      // index 0 is the lightest, index 5 the darkest — a meaningful spread
      expect(lum(ramp[0])).toBeGreaterThan(lum(ramp[5]) + 120);
    }
  });
});

describe('skyRampFor', () => {
  const lum = (hex: string): number => {
    const n = Number.parseInt(hex.slice(1), 16);
    return ((n >> 16) & 0xff) + ((n >> 8) & 0xff) + (n & 0xff);
  };

  it('is deterministic — same descriptor gives the same sky ramp', () => {
    const d = { seed: 7, type: 'terran' } as const;
    expect(skyRampFor(d)).toEqual(skyRampFor(d));
  });

  it('returns a 6-step ramp, every step palette-locked', () => {
    const ramp = skyRampFor({ seed: 13, type: 'terran' });
    expect(ramp).toHaveLength(6);
    for (const hex of ramp) expect(RESURRECT_64).toContain(hex);
  });

  it('sky index 0 is lighter (higher luminance) than land ramp index 0', () => {
    // The sky brightest step must be brighter than the terrain brightest step so that
    // platform silhouettes stay legible.
    for (let seed = 0; seed < 20; seed++) {
      const skyRamp = skyRampFor({ seed, type: 'terran' });
      const landRamp = surfaceRampFor({ seed, type: 'terran' });
      expect(lum(skyRamp[0])).toBeGreaterThanOrEqual(lum(landRamp[0]));
    }
  });

  it('produces distinct sky ramp families across different planet seeds', () => {
    const families = new Set(
      Array.from({ length: 40 }, (_, i) => JSON.stringify(skyRampFor({ seed: i, type: 'terran' }))),
    );
    expect(families.size).toBeGreaterThan(1);
  });
});

describe('rampToFloats', () => {
  it('flattens 6 hexes to 18 normalised channels in [0,1]', () => {
    const floats = rampToFloats(planetRamps(3).ocean);
    expect(floats).toHaveLength(18);
    for (const c of floats) expect(c).toBeGreaterThanOrEqual(0);
    for (const c of floats) expect(c).toBeLessThanOrEqual(1);
  });

  it('maps #ffffff → 1,1,1 and #000000-ish darkest correctly', () => {
    // RESURRECT_64[9] is #ffffff
    expect(
      rampToFloats(['#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff']),
    ).toEqual(Array(18).fill(1));
  });
});
