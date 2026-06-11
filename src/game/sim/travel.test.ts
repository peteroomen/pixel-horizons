import { describe, expect, it } from 'vitest';

import { LANE_DISTANCE_MAX, LANE_DISTANCE_MIN } from '../data';
import { createRunState } from './run-state';
import { advanceLane, createLane } from './travel';
import type { LaneState } from './travel';

function lane(seed = 'travel-test'): LaneState {
  return createLane(createRunState(seed));
}

describe('createLane', () => {
  it('is deterministic: the same run state rolls the same lane', () => {
    expect(lane()).toEqual(lane());
  });

  it('commits the map-gen stream back so consecutive lanes differ', () => {
    const run = createRunState('stream');
    const before = run.rng['map-gen'];
    const first = createLane(run);
    expect(run.rng['map-gen']).not.toEqual(before);
    const second = createLane(run);
    expect(second).not.toEqual(first);
  });

  it('rolls distance inside the band and encounters strictly between mouth and destination', () => {
    for (let i = 0; i < 50; i++) {
      const result = lane(`bounds-${i}`);
      expect(result.distance).toBeGreaterThanOrEqual(LANE_DISTANCE_MIN);
      expect(result.distance).toBeLessThanOrEqual(LANE_DISTANCE_MAX);
      let previous = 0;
      for (const encounter of result.encounters) {
        expect(encounter.at).toBeGreaterThan(previous);
        expect(encounter.at).toBeLessThan(result.distance);
        previous = encounter.at;
      }
    }
  });

  it('starts at the lane mouth with a clean ship', () => {
    const result = lane();
    expect(result.progress).toBe(0);
    expect(result.nextEncounter).toBe(0);
    expect(result.malfunctioning).toEqual([]);
  });

  it('a forced single-enemy pool fills every encounter (the ?enemy= knob)', () => {
    const result = createLane(createRunState('forced'), ['enemy-anchormaw']);
    expect(result.encounters.map((e) => e.enemyId)).toEqual(['enemy-anchormaw', 'enemy-anchormaw']);
  });
});

describe('advanceLane', () => {
  it('travels to the first encounter', () => {
    const result = lane();
    const step = advanceLane(result);
    expect(step).toEqual({ kind: 'encounter', enemyId: result.encounters[0].enemyId });
    expect(result.progress).toBe(result.encounters[0].at);
    expect(result.nextEncounter).toBe(1);
  });

  it('skips encounters overshot during combat — faster traversal, fewer triggers', () => {
    const result = lane();
    // Combat travel carried the ship past the first trigger point.
    result.progress = result.encounters[0].at;
    const step = advanceLane(result);
    expect(step).toEqual({ kind: 'encounter', enemyId: result.encounters[1].enemyId });
    expect(result.progress).toBe(result.encounters[1].at);
  });

  it('arrives once every remaining encounter is behind the ship', () => {
    const result = lane();
    result.progress = result.encounters[result.encounters.length - 1].at;
    expect(advanceLane(result)).toEqual({ kind: 'arrived' });
    expect(result.progress).toBe(result.distance);
  });

  it('arrives when the encounter list is exhausted', () => {
    const result = lane();
    while (advanceLane(result).kind !== 'arrived') {
      // walk every encounter
    }
    expect(result.progress).toBe(result.distance);
    expect(result.nextEncounter).toBe(result.encounters.length);
  });
});
