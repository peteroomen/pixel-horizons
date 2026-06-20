import { describe, expect, it } from 'vitest';

import type { PlanetDescriptor } from '@/game/sim/planet';

import { defaultConfig } from './core-breaker';
import { generateField, isReachable } from './field-gen';

const desc = (seed: number): PlanetDescriptor => ({ seed, type: 'terran' });

describe('field-gen determinism', () => {
  it('same descriptor + difficulty ⇒ identical field', () => {
    expect(generateField(desc(12345))).toEqual(generateField(desc(12345)));
  });

  it('different seeds ⇒ different fields', () => {
    const a = generateField(desc(1));
    const b = generateField(desc(2));
    expect(a).not.toEqual(b);
  });
});

describe('field-gen invariants', () => {
  it('every emitted peg is reachable by at least one trajectory', () => {
    const cfg = defaultConfig();
    for (const seed of [1, 2, 3, 7, 42, 999]) {
      const field = generateField(desc(seed), cfg);
      expect(field.length).toBeGreaterThan(0);
      for (const peg of field) {
        expect(isReachable(peg, cfg)).toBe(true);
      }
    }
  });

  it('pegs have unique ids and sit inside the playfield bounds', () => {
    const cfg = defaultConfig();
    const field = generateField(desc(2024), cfg);
    const ids = new Set(field.map((p) => p.id));
    expect(ids.size).toBe(field.length);
    for (const peg of field) {
      expect(peg.x).toBeGreaterThanOrEqual(peg.r);
      expect(peg.x).toBeLessThanOrEqual(cfg.width - peg.r);
      expect(peg.y).toBeLessThan(cfg.floorY);
    }
  });

  it('produces a Sector-1-sized field (sane peg count)', () => {
    const counts = [1, 2, 3, 4, 5].map((s) => generateField(desc(s)).length);
    for (const n of counts) {
      expect(n).toBeGreaterThanOrEqual(20);
      expect(n).toBeLessThanOrEqual(80);
    }
  });
});

describe('field-gen weighting', () => {
  it('higher difficulty yields a denser field (summed over seeds)', () => {
    const seeds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const sum = (difficulty: number) =>
      seeds.reduce((n, s) => n + generateField(desc(s), defaultConfig(), { difficulty }).length, 0);
    expect(sum(4)).toBeGreaterThan(sum(0));
  });

  it('Bloom growths only appear as guards above an ore/crystal reward', () => {
    let sawBloom = false;
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
      const field = generateField(desc(seed), defaultConfig(), { difficulty: 2 });
      const blooms = field.filter((p) => p.kind === 'bloom');
      const rewards = field.filter((p) => p.kind === 'ore' || p.kind === 'crystal');
      for (const bloom of blooms) {
        sawBloom = true;
        // some reward sits below the bloom (it guards the approach)
        const guardsSomething = rewards.some((rw) => rw.y > bloom.y);
        expect(guardsSomething).toBe(true);
      }
    }
    expect(sawBloom).toBe(true);
  });
});
