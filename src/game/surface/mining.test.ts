import { describe, expect, it } from 'vitest';

import {
  BIOMINERAL_DEPOSIT_YIELD,
  CORE_CRYSTAL_YIELD,
  HIDDEN_DEPOSIT_YIELD,
  SCRAP_CACHE_YIELD,
} from '@/game/data/surface';
import type { Resources } from '@/game/sim/run-state';
import { addYield, backpackUsed, scaleYield, tileYield } from './mining';
import {
  TILE_BREAKABLE,
  TILE_CORE_CRYSTAL,
  TILE_DEPOSIT_BIOMINERAL,
  TILE_DEPOSIT_HIDDEN,
  TILE_EMPTY,
  TILE_SCRAP_CACHE,
  TILE_SOLID,
} from './tilemap';

function emptyPack(): Resources {
  return { scrap: 0, biominerals: 0, coreCrystals: 0, blueprints: 0 };
}

describe('tileYield', () => {
  it('biomineral deposits yield biominerals', () => {
    expect(tileYield(TILE_DEPOSIT_BIOMINERAL)).toEqual({
      biominerals: BIOMINERAL_DEPOSIT_YIELD,
    });
  });

  it('scrap caches yield scrap', () => {
    expect(tileYield(TILE_SCRAP_CACHE)).toEqual({ scrap: SCRAP_CACHE_YIELD });
  });

  it('plain rock, solid, and empty yield nothing', () => {
    expect(tileYield(TILE_BREAKABLE)).toBeNull();
    expect(tileYield(TILE_SOLID)).toBeNull();
    expect(tileYield(TILE_EMPTY)).toBeNull();
  });
});

describe('backpackUsed', () => {
  it('sums all four resource counts', () => {
    expect(backpackUsed(emptyPack())).toBe(0);
    expect(backpackUsed({ scrap: 1, biominerals: 2, coreCrystals: 3, blueprints: 4 })).toBe(10);
  });
});

describe('addYield', () => {
  it('adds into an empty backpack and returns true', () => {
    const pack = emptyPack();
    expect(addYield(pack, { biominerals: 2 }, 20)).toBe(true);
    expect(pack.biominerals).toBe(2);
    expect(backpackUsed(pack)).toBe(2);
  });

  it('partially fills at the capacity boundary, losing overflow', () => {
    const pack = { ...emptyPack(), scrap: 19 };
    expect(addYield(pack, { biominerals: 2 }, 20)).toBe(true);
    expect(pack.biominerals).toBe(1);
    expect(backpackUsed(pack)).toBe(20);
  });

  it('adds nothing and returns false when the backpack is full', () => {
    const pack = { ...emptyPack(), scrap: 20 };
    expect(addYield(pack, { biominerals: 2 }, 20)).toBe(false);
    expect(backpackUsed(pack)).toBe(20);
  });

  it('fills multi-resource deltas in declared order at the boundary', () => {
    const pack = { ...emptyPack(), coreCrystals: 17 };
    // scrap fills first (declared order), biominerals get the remainder
    expect(addYield(pack, { scrap: 2, biominerals: 2 }, 20)).toBe(true);
    expect(pack.scrap).toBe(2);
    expect(pack.biominerals).toBe(1);
    expect(backpackUsed(pack)).toBe(20);
  });
});

describe('tileYield — 3.3 tile types', () => {
  it('hidden deposits yield rich biominerals', () => {
    expect(tileYield(TILE_DEPOSIT_HIDDEN)).toEqual({ biominerals: HIDDEN_DEPOSIT_YIELD });
  });

  it('core crystal tiles yield a core crystal', () => {
    expect(tileYield(TILE_CORE_CRYSTAL)).toEqual({ coreCrystals: CORE_CRYSTAL_YIELD });
  });
});

describe('scaleYield', () => {
  it('multiplier 1 returns the delta unchanged', () => {
    const delta = { biominerals: 2 };
    expect(scaleYield(delta, 1)).toBe(delta);
  });

  it('scales and rounds to nearest', () => {
    expect(scaleYield({ biominerals: 2 }, 2)).toEqual({ biominerals: 4 });
    expect(scaleYield({ biominerals: 2 }, 2.3)).toEqual({ biominerals: 5 });
    expect(scaleYield({ scrap: 3 }, 1.15)).toEqual({ scrap: 3 });
  });

  it('never scales a positive yield below 1', () => {
    expect(scaleYield({ coreCrystals: 1 }, 0.2)).toEqual({ coreCrystals: 1 });
  });
});
