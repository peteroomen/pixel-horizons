import { describe, expect, it } from 'vitest';

import { defaultConfig } from './core-breaker';
import { generateField } from './field-gen';

describe('field-gen determinism', () => {
  it('same seed + difficulty ⇒ identical field', () => {
    expect(generateField('seed-42')).toEqual(generateField('seed-42'));
  });

  it('different seeds ⇒ different fields', () => {
    const a = generateField('seed-1');
    const b = generateField('seed-2');
    expect(a).not.toEqual(b);
  });
});

describe('field-gen invariants', () => {
  it('pegs have unique ids and sit inside the playfield bounds', () => {
    const cfg = defaultConfig();
    const field = generateField('seed-2024', cfg);
    const ids = new Set(field.map((p) => p.id));
    expect(ids.size).toBe(field.length);
    for (const peg of field) {
      expect(peg.x).toBeGreaterThanOrEqual(peg.r);
      expect(peg.x).toBeLessThanOrEqual(cfg.width - peg.r);
      expect(peg.y).toBeLessThan(cfg.floorY);
    }
  });

  it('produces a sane peg count across seeds', () => {
    const counts = ['1', '2', '3', '4', '5'].map((s) => generateField(s).length);
    for (const n of counts) {
      expect(n).toBeGreaterThanOrEqual(20);
      expect(n).toBeLessThanOrEqual(90);
    }
  });

  it('every field contains a crystal and bloom hazards', () => {
    for (const s of ['a', 'b', 'c']) {
      const field = generateField(s);
      expect(field.some((p) => p.kind === 'crystal')).toBe(true);
      expect(field.some((p) => p.kind === 'bloom')).toBe(true);
    }
  });
});

describe('field-gen weighting', () => {
  it('higher difficulty yields proportionally more hard pegs', () => {
    const seeds = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
    const countHard = (difficulty: number) =>
      seeds.reduce(
        (n, s) =>
          n +
          generateField(s, defaultConfig(), { difficulty }).filter((p) => p.kind === 'hard').length,
        0,
      );
    expect(countHard(4)).toBeGreaterThan(countHard(0));
  });

  it('bloom hazards guard an ore or crystal reward below them', () => {
    const field = generateField('bloom-guard-test', defaultConfig());
    const blooms = field.filter((p) => p.kind === 'bloom');
    const rewards = field.filter((p) => p.kind === 'ore' || p.kind === 'crystal');
    expect(blooms.length).toBeGreaterThan(0);
    for (const bloom of blooms) {
      // Some reward sits below (higher Y in screen space) each bloom — it guards the approach.
      expect(rewards.some((rw) => rw.y > bloom.y)).toBe(true);
    }
  });
});
