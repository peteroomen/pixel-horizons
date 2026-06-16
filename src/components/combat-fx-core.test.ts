import { describe, expect, it } from 'vitest';

import { hpDrop, MAX_SHAKE, MIN_SHAKE, shakeAmplitude } from './combat-fx-core';

describe('hpDrop', () => {
  it('returns null on the first reading (no previous value)', () => {
    expect(hpDrop(null, 30)).toBeNull();
  });

  it('returns the positive drop when HP falls', () => {
    expect(hpDrop(30, 18)).toBe(12);
    expect(hpDrop(1, 0)).toBe(1);
  });

  it('returns null when HP is unchanged or rises (heal/shield restore)', () => {
    expect(hpDrop(30, 30)).toBeNull();
    expect(hpDrop(20, 26)).toBeNull();
  });
});

describe('shakeAmplitude', () => {
  it('is zero for no damage or a non-positive pool', () => {
    expect(shakeAmplitude(0, 100)).toBe(0);
    expect(shakeAmplitude(10, 0)).toBe(0);
  });

  it('floors a chip hit at the minimum and caps a kill at the maximum', () => {
    expect(shakeAmplitude(1, 100)).toBe(MIN_SHAKE);
    expect(shakeAmplitude(100, 100)).toBe(MAX_SHAKE);
    // Overkill (drop exceeds the pool) still clamps, never exceeds the cap.
    expect(shakeAmplitude(250, 100)).toBe(MAX_SHAKE);
  });

  it('scales between the bounds with the fraction of the pool removed', () => {
    const half = shakeAmplitude(50, 100);
    expect(half).toBeGreaterThanOrEqual(MIN_SHAKE);
    expect(half).toBeLessThanOrEqual(MAX_SHAKE);
    expect(half).toBe(Math.round(MIN_SHAKE + (MAX_SHAKE - MIN_SHAKE) * 0.5));
  });

  it('always returns an integer (crisp nearest-neighbour shake)', () => {
    for (const drop of [1, 3, 7, 13, 29, 50, 99]) {
      expect(Number.isInteger(shakeAmplitude(drop, 100))).toBe(true);
    }
  });
});
