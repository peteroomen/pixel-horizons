import { describe, expect, it } from 'vitest';

import type { Resources } from '@/game/sim/run-state';
import type { Body } from './physics';
import { collectWorldItems, transferToBackpack } from './drops';

function res(scrap: number, bio = 0): Resources {
  return { scrap, biominerals: bio, coreCrystals: 0, blueprints: 0 };
}

describe('transferToBackpack', () => {
  it('moves the whole bundle when there is room', () => {
    const source = res(3);
    const pack = res(0);
    expect(transferToBackpack(source, pack, 20)).toBe(true);
    expect(pack.scrap).toBe(3);
    expect(source.scrap).toBe(0);
  });

  it('moves only what fits and leaves the remainder', () => {
    const source = res(5);
    const pack = res(8);
    expect(transferToBackpack(source, pack, 10)).toBe(false);
    expect(pack.scrap).toBe(10);
    expect(source.scrap).toBe(3);
  });
});

describe('collectWorldItems', () => {
  const body: Body = { x: 100, y: 100, w: 12, h: 20, vx: 0, vy: 0 };

  it('pulls in items within the magnet radius and removes drained ones', () => {
    const items = [{ resources: res(2), x: 104, y: 104 }];
    const pack = res(0);
    collectWorldItems(items, pack, 20, body, 40);
    expect(pack.scrap).toBe(2);
    expect(items).toHaveLength(0);
  });

  it('leaves far items untouched', () => {
    const items = [{ resources: res(2), x: 400, y: 100 }];
    const pack = res(0);
    collectWorldItems(items, pack, 20, body, 40);
    expect(pack.scrap).toBe(0);
    expect(items).toHaveLength(1);
  });

  it('keeps the remainder when the backpack fills mid-pickup', () => {
    const items = [{ resources: res(5), x: 104, y: 104 }];
    const pack = res(8);
    collectWorldItems(items, pack, 10, body, 40);
    expect(pack.scrap).toBe(10);
    expect(items).toHaveLength(1);
    expect(items[0].resources.scrap).toBe(3);
  });
});
