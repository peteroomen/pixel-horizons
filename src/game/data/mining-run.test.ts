import { describe, expect, it } from 'vitest';

import { BLOOM_DRAIN_THRESHOLD, BLOOM_DRAIN_PER_SHOT, calcBloomDrain } from './mining-run';

describe('calcBloomDrain', () => {
  it('increments counter but does not drain before the threshold', () => {
    let shots = 0;
    const scrap = 10;
    for (let i = 0; i < BLOOM_DRAIN_THRESHOLD; i++) {
      const r = calcBloomDrain(true, shots, scrap);
      shots = r.bloomShotsActive;
      expect(r.scrapDrained).toBe(0);
    }
    expect(shots).toBe(BLOOM_DRAIN_THRESHOLD);
    expect(scrap).toBe(10); // untouched
  });

  it('drains scrap once threshold is crossed', () => {
    // Advance past threshold.
    const shots = BLOOM_DRAIN_THRESHOLD;
    const r = calcBloomDrain(true, shots, 5);
    expect(r.scrapDrained).toBe(BLOOM_DRAIN_PER_SHOT);
    expect(r.bloomShotsActive).toBe(BLOOM_DRAIN_THRESHOLD + 1);
  });

  it('clamps drain to available scrap (does not go negative)', () => {
    const r = calcBloomDrain(true, BLOOM_DRAIN_THRESHOLD + 1, 0);
    expect(r.scrapDrained).toBe(0);
  });

  it('resets counter to 0 when no bloom pegs are alive', () => {
    const r = calcBloomDrain(false, BLOOM_DRAIN_THRESHOLD + 5, 10);
    expect(r.bloomShotsActive).toBe(0);
    expect(r.scrapDrained).toBe(0);
  });

  it('drain equals BLOOM_DRAIN_PER_SHOT when scrap is sufficient', () => {
    const r = calcBloomDrain(true, BLOOM_DRAIN_THRESHOLD + 3, 99);
    expect(r.scrapDrained).toBe(BLOOM_DRAIN_PER_SHOT);
  });
});
