import { describe, expect, it } from 'vitest';

import type { Status } from './status';
import { applyStatus, consumeAttackBuffs, sumMagnitude, tickStatuses } from './status';

describe('status mechanics', () => {
  it('applyStatus adds magnitudes for additive statuses', () => {
    const list: Status[] = [];
    applyStatus(list, 'status-charged', 3);
    applyStatus(list, 'status-charged', 5);
    expect(list).toEqual([{ id: 'status-charged', magnitude: 8 }]);
  });

  it('applyStatus multiplies magnitudes for Overcharged', () => {
    const list: Status[] = [];
    applyStatus(list, 'status-overcharged', 2);
    applyStatus(list, 'status-overcharged', 2);
    expect(list).toEqual([{ id: 'status-overcharged', magnitude: 4 }]);
  });

  it('sumMagnitude totals one id and ignores others', () => {
    const list: Status[] = [
      { id: 'status-marked', magnitude: 2 },
      { id: 'status-charged', magnitude: 3 },
      { id: 'status-marked', magnitude: 1 },
    ];
    expect(sumMagnitude(list, 'status-marked')).toBe(3);
  });

  it('consumeAttackBuffs returns combined bonus/multiplier and removes the consumed', () => {
    const list: Status[] = [];
    applyStatus(list, 'status-charged', 3);
    applyStatus(list, 'status-overcharged', 2);
    applyStatus(list, 'status-marked', 9); // persist — must survive
    const { bonus, multiplier } = consumeAttackBuffs(list);
    expect(bonus).toBe(3);
    expect(multiplier).toBe(2);
    expect(list).toEqual([{ id: 'status-marked', magnitude: 9 }]);
  });

  it('consumeAttackBuffs is a no-op (×1, +0) with nothing to spend', () => {
    const list: Status[] = [{ id: 'status-marked', magnitude: 2 }];
    expect(consumeAttackBuffs(list)).toEqual({ bonus: 0, multiplier: 1 });
    expect(list).toHaveLength(1);
  });

  it('tickStatuses counts down tick-enemy-phase statuses and drops them at 0', () => {
    const list: Status[] = [{ id: 'status-cloak', magnitude: 2 }];
    tickStatuses(list);
    expect(list).toEqual([{ id: 'status-cloak', magnitude: 1 }]);
    tickStatuses(list);
    expect(list).toEqual([]);
  });

  it('tickStatuses leaves persist and consume-on-attack statuses untouched', () => {
    const list: Status[] = [
      { id: 'status-marked', magnitude: 2 },
      { id: 'status-charged', magnitude: 3 },
    ];
    tickStatuses(list);
    expect(list).toEqual([
      { id: 'status-marked', magnitude: 2 },
      { id: 'status-charged', magnitude: 3 },
    ]);
  });
});
