import { describe, expect, it } from 'vitest';

import { FIXED_DT_MS, POD_HEIGHT, POD_WIDTH, TILE_SIZE } from '@/game/data/surface';
import { createClone } from './clone';
import { createPod, depositBackpack, podOverlapsClone, tickPod } from './pod';
import type { PodState } from './pod';
import { parseLevel } from './tilemap';

const POD_LEVEL = ['#######', '#PD...#', '#.....#', '#.....#', '#######'];

function makePod(windowMs = 1000): PodState {
  const pod = createPod(parseLevel(POD_LEVEL), windowMs);
  if (pod === null) throw new Error('test level must have a pod');
  return pod;
}

describe('createPod', () => {
  it('anchors the AABB at the D marker with a full window and zeroed deposits', () => {
    const pod = makePod(5000);
    expect(pod.x).toBe(2 * TILE_SIZE);
    expect(pod.y).toBe(1 * TILE_SIZE);
    expect(pod.w).toBe(POD_WIDTH);
    expect(pod.h).toBe(POD_HEIGHT);
    expect(pod.remainingMs).toBe(5000);
    expect(pod.windowMs).toBe(5000);
    expect(pod.deposited).toEqual({ scrap: 0, biominerals: 0, coreCrystals: 0, blueprints: 0 });
    expect(pod.launched).toBe(false);
  });

  it('returns null for a level without a pod marker', () => {
    expect(createPod(parseLevel(['###', '#P.', '###']), 5000)).toBeNull();
  });
});

describe('tickPod', () => {
  it('fires exactly once, on the step that reaches zero', () => {
    const pod = makePod(100);
    const fired: boolean[] = [];
    for (let i = 0; i < 9; i++) {
      fired.push(tickPod(pod, FIXED_DT_MS));
    }
    // 100 / 16.67 → fires on the 6th step
    expect(fired).toEqual([false, false, false, false, false, true, false, false, false]);
    expect(pod.remainingMs).toBe(0);
    expect(pod.launched).toBe(true);
  });

  it('counts down by sim time', () => {
    const pod = makePod(1000);
    tickPod(pod, 300);
    expect(pod.remainingMs).toBe(700);
  });

  it('launches on an exact-zero boundary', () => {
    const pod = makePod(100);
    expect(tickPod(pod, 100)).toBe(true);
    expect(pod.remainingMs).toBe(0);
  });
});

describe('podOverlapsClone', () => {
  it('detects strict overlap and rejects flush-edge contact', () => {
    const map = parseLevel(POD_LEVEL);
    const pod = makePod();
    const clone = createClone(map);

    // Clone body inside the pod AABB
    clone.body.x = pod.x + 4;
    clone.body.y = pod.y + 4;
    expect(podOverlapsClone(pod, clone.body)).toBe(true);

    // Flush contact: clone right edge exactly on pod left edge — no overlap
    clone.body.x = pod.x - clone.body.w;
    expect(podOverlapsClone(pod, clone.body)).toBe(false);

    // One px of penetration — overlap
    clone.body.x = pod.x - clone.body.w + 1;
    expect(podOverlapsClone(pod, clone.body)).toBe(true);
  });
});

describe('depositBackpack', () => {
  it('moves everything, zeroes the backpack, and accumulates across deposits', () => {
    const map = parseLevel(POD_LEVEL);
    const pod = makePod();
    const clone = createClone(map);

    clone.backpack.scrap = 3;
    clone.backpack.biominerals = 4;
    expect(depositBackpack(clone, pod)).toBe(true);
    expect(clone.backpack).toEqual({ scrap: 0, biominerals: 0, coreCrystals: 0, blueprints: 0 });
    expect(pod.deposited.scrap).toBe(3);
    expect(pod.deposited.biominerals).toBe(4);

    // Empty backpack deposits nothing
    expect(depositBackpack(clone, pod)).toBe(false);

    // Second haul accumulates
    clone.backpack.biominerals = 2;
    expect(depositBackpack(clone, pod)).toBe(true);
    expect(pod.deposited.biominerals).toBe(6);
  });
});
