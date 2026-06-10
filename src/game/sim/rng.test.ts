import { describe, expect, it } from 'vitest';

import { createRng, deriveRng, newSeed, restoreRng } from './rng';

const draw = (rng: { next(): number }, count: number): number[] =>
  Array.from({ length: count }, () => rng.next());

describe('createRng', () => {
  it('produces identical sequences for the same seed', () => {
    expect(draw(createRng('test-seed'), 1000)).toEqual(draw(createRng('test-seed'), 1000));
  });

  it('produces different sequences for different seeds', () => {
    expect(draw(createRng('seed-a'), 50)).not.toEqual(draw(createRng('seed-b'), 50));
  });

  it('yields floats in [0, 1)', () => {
    const rng = createRng('range-check');
    for (const value of draw(rng, 1000)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe('state serialization', () => {
  it('restores mid-stream and continues identically', () => {
    const original = createRng('mid-stream');
    draw(original, 123);
    const snapshot = original.getState();

    const restored = restoreRng(snapshot);
    expect(draw(restored, 500)).toEqual(draw(original, 500));
  });

  it('snapshots state by value, not by reference', () => {
    const rng = createRng('snapshot');
    const before = rng.getState();
    draw(rng, 10);
    expect(rng.getState()).not.toEqual(before);
    expect(restoreRng(before).next()).toEqual(restoreRng(before).next());
  });

  it('round-trips through JSON', () => {
    const rng = createRng('json-trip');
    draw(rng, 7);
    const restored = restoreRng(JSON.parse(JSON.stringify(rng.getState())));
    expect(draw(restored, 100)).toEqual(draw(rng, 100));
  });
});

describe('deriveRng', () => {
  it('derives independent streams per label', () => {
    expect(draw(deriveRng('run-seed', 'map-gen'), 50)).not.toEqual(
      draw(deriveRng('run-seed', 'combat'), 50),
    );
    expect(draw(deriveRng('run-seed', 'map-gen'), 50)).not.toEqual(draw(createRng('run-seed'), 50));
  });

  it('is deterministic for the same seed and label', () => {
    expect(draw(deriveRng('run-seed', 'combat'), 100)).toEqual(
      draw(deriveRng('run-seed', 'combat'), 100),
    );
  });
});

describe('int', () => {
  it('stays within [min, max) and reaches both ends', () => {
    const rng = createRng('int-range');
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) {
      const value = rng.int(2, 6);
      expect(value).toBeGreaterThanOrEqual(2);
      expect(value).toBeLessThan(6);
      seen.add(value);
    }
    expect([...seen].sort()).toEqual([2, 3, 4, 5]);
  });

  it('throws on an empty or inverted range', () => {
    const rng = createRng('int-invalid');
    expect(() => rng.int(3, 3)).toThrow();
    expect(() => rng.int(5, 2)).toThrow();
  });
});

describe('pick', () => {
  it('returns an element of the array deterministically', () => {
    const items = ['a', 'b', 'c', 'd'];
    const picked = createRng('pick').pick(items);
    expect(items).toContain(picked);
    expect(createRng('pick').pick(items)).toBe(picked);
  });

  it('throws on an empty array', () => {
    expect(() => createRng('pick-empty').pick([])).toThrow();
  });
});

describe('shuffle', () => {
  it('returns a deterministic permutation without mutating the input', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const frozen = [...items];
    const shuffled = createRng('shuffle').shuffle(items);

    expect(items).toEqual(frozen);
    expect([...shuffled].sort((a, b) => a - b)).toEqual(frozen);
    expect(createRng('shuffle').shuffle(items)).toEqual(shuffled);
  });
});

describe('newSeed', () => {
  it('produces url-safe lowercase seeds that differ across calls', () => {
    const a = newSeed();
    const b = newSeed();
    expect(a).toMatch(/^[a-z0-9-]+$/);
    expect(a).not.toEqual(b);
  });
});
