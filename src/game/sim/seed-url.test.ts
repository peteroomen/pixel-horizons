import { describe, expect, it } from 'vitest';

import { newSeed } from './rng';
import { parseSeedParam, seedToSearchParam } from './seed-url';

describe('parseSeedParam', () => {
  it('extracts a valid seed, with or without the leading question mark', () => {
    expect(parseSeedParam('?seed=crimson-lamprey')).toBe('crimson-lamprey');
    expect(parseSeedParam('seed=crimson-lamprey')).toBe('crimson-lamprey');
  });

  it('returns null when the param is absent or empty', () => {
    expect(parseSeedParam('')).toBeNull();
    expect(parseSeedParam('?other=1')).toBeNull();
    expect(parseSeedParam('?seed=')).toBeNull();
    expect(parseSeedParam('?seed=%20%20')).toBeNull();
  });

  it('normalizes case and surrounding whitespace', () => {
    expect(parseSeedParam('?seed=Crimson-LAMPREY')).toBe('crimson-lamprey');
    expect(parseSeedParam('?seed=%20abc123%20')).toBe('abc123');
  });

  it('rejects seeds with invalid characters or excessive length', () => {
    expect(parseSeedParam('?seed=has%20space%20inside')).toBeNull();
    expect(parseSeedParam('?seed=semi;colon')).toBeNull();
    expect(parseSeedParam(`?seed=${'a'.repeat(65)}`)).toBeNull();
  });

  it('ignores unrelated params', () => {
    expect(parseSeedParam('?foo=bar&seed=abc&baz=1')).toBe('abc');
  });
});

describe('seedToSearchParam', () => {
  it('round-trips through parseSeedParam', () => {
    expect(parseSeedParam(seedToSearchParam('crimson-lamprey'))).toBe('crimson-lamprey');
  });

  it('round-trips generated seeds', () => {
    const seed = newSeed();
    expect(parseSeedParam(seedToSearchParam(seed))).toBe(seed);
  });
});
