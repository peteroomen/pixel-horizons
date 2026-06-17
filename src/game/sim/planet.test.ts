import { describe, expect, it } from 'vitest';

import { ALL_PLANET_TYPES } from '../data/planets';
import { planetForNode } from './planet';

describe('planetForNode', () => {
  it('is deterministic — same run seed + node id gives the same planet', () => {
    expect(planetForNode('abc123', 'n2-1')).toEqual(planetForNode('abc123', 'n2-1'));
  });

  it('gives different nodes different planets (different seeds)', () => {
    const a = planetForNode('abc123', 'n2-1');
    const b = planetForNode('abc123', 'n3-0');
    expect(a.seed).not.toBe(b.seed);
  });

  it('gives the same node under different run seeds different planets', () => {
    const a = planetForNode('seed-one', 'n2-1');
    const b = planetForNode('seed-two', 'n2-1');
    expect(a.seed).not.toBe(b.seed);
  });

  it('always produces a valid type and an in-range numeric seed', () => {
    const { type, seed } = planetForNode('xyz', 'n1-0');
    expect(ALL_PLANET_TYPES).toContain(type);
    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(seed).toBeLessThan(1_000_000);
  });
});
