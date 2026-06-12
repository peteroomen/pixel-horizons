import { describe, expect, it } from 'vitest';

import { computeScale } from './pixel-scale';

describe('computeScale', () => {
  it('uses the exact contain ratio so the canvas fills the binding axis', () => {
    // 1280×720 is exactly 2× of 640×360 — integer falls out naturally
    expect(computeScale(1280, 720, 1).zoom).toBe(2);
    expect(computeScale(1920, 1080, 1).zoom).toBe(3);
    // 1440×810 @2x dpr: contain ratio is 4.5 — fractional, fills the whole viewport
    const scale = computeScale(1440, 810, 2);
    expect(scale.zoom).toBeCloseTo(4.5);
    expect(scale.cssWidth).toBe(1440);
    expect(scale.cssHeight).toBe(810);
  });

  it('computes zoom in device pixels on HiDPI displays', () => {
    expect(computeScale(640, 360, 2).zoom).toBe(2);
  });

  it('fills the full width on width-bound portrait viewports', () => {
    const scale = computeScale(375, 812, 2);
    expect(scale.zoom).toBeCloseTo(750 / 640);
    expect(scale.cssWidth).toBe(375);
  });

  it('allows fractional downscale when the viewport is smaller than virtual resolution', () => {
    const { zoom } = computeScale(320, 360, 1);
    expect(zoom).toBeLessThan(1);
    expect(zoom).toBeCloseTo(0.5);
  });
});
