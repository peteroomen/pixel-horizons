import { describe, expect, it } from 'vitest';

import { computeScale } from './pixel-scale';

describe('computeScale', () => {
  it('picks the largest integer zoom that fits', () => {
    expect(computeScale(1280, 720, 1).zoom).toBe(2);
    expect(computeScale(1920, 1080, 1).zoom).toBe(3);
  });

  it('computes integer zoom in device pixels on HiDPI displays', () => {
    expect(computeScale(640, 360, 2).zoom).toBe(2);
  });

  it('allows fractional downscale when the viewport is smaller than virtual resolution', () => {
    const { zoom } = computeScale(320, 360, 1);
    expect(zoom).toBeLessThan(1);
    expect(zoom).toBeCloseTo(0.5);
  });
});
