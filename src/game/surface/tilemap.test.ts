import { describe, expect, it } from 'vitest';

import { TILE_SIZE } from '@/game/data/surface';
import {
  TILE_BREAKABLE,
  TILE_DEPOSIT_BIOMINERAL,
  TILE_EMPTY,
  TILE_SCRAP_CACHE,
  TILE_SOLID,
  breakTile,
  isSolid,
  parseLevel,
  tileAt,
} from './tilemap';

const SIMPLE: string[] = ['###', '#P.', '#.#'];

describe('parseLevel', () => {
  it('parses solid, empty, and spawn tiles', () => {
    const map = parseLevel(SIMPLE);
    expect(map.width).toBe(3);
    expect(map.height).toBe(3);
    expect(tileAt(map, 0, 0)).toBe(TILE_SOLID);
    expect(tileAt(map, 2, 1)).toBe(TILE_EMPTY);
    expect(tileAt(map, 1, 1)).toBe(TILE_EMPTY); // spawn tile is empty after parsing
  });

  it('records spawn position at top-left corner of the P tile', () => {
    const map = parseLevel(SIMPLE);
    expect(map.spawnX).toBe(1 * TILE_SIZE);
    expect(map.spawnY).toBe(1 * TILE_SIZE);
  });

  it('parses breakable tiles', () => {
    const map = parseLevel(['###', '#P*', '###']);
    expect(tileAt(map, 2, 1)).toBe(TILE_BREAKABLE);
  });

  it('parses deposit and cache tiles', () => {
    const map = parseLevel(['####', '#Pbs', '####']);
    expect(tileAt(map, 2, 1)).toBe(TILE_DEPOSIT_BIOMINERAL);
    expect(tileAt(map, 3, 1)).toBe(TILE_SCRAP_CACHE);
  });

  it('records pod marker position and parses its tile as empty', () => {
    const map = parseLevel(['####', '#PD.', '####']);
    expect(map.podX).toBe(2 * TILE_SIZE);
    expect(map.podY).toBe(1 * TILE_SIZE);
    expect(tileAt(map, 2, 1)).toBe(TILE_EMPTY);
  });

  it('pod position is null when the level has no pod marker', () => {
    const map = parseLevel(SIMPLE);
    expect(map.podX).toBeNull();
    expect(map.podY).toBeNull();
  });

  it('throws on multiple pod markers', () => {
    expect(() => parseLevel(['####', '#PDD', '####'])).toThrow('pod');
  });

  it('throws on ragged rows', () => {
    expect(() => parseLevel(['###', '#P', '#.#'])).toThrow('ragged');
  });

  it('throws on zero spawn tiles', () => {
    expect(() => parseLevel(['###', '#..', '###'])).toThrow('spawn');
  });

  it('throws on multiple spawn tiles', () => {
    expect(() => parseLevel(['###', '#PP', '###'])).toThrow('spawn');
  });

  it('throws on unknown character', () => {
    expect(() => parseLevel(['###', '#P?', '###'])).toThrow("unknown character '?'");
  });

  it('starts with version 0', () => {
    const map = parseLevel(SIMPLE);
    expect(map.version).toBe(0);
  });
});

describe('tileAt', () => {
  it('returns TILE_SOLID for out-of-bounds (keeps clone in level)', () => {
    const map = parseLevel(SIMPLE);
    expect(tileAt(map, -1, 0)).toBe(TILE_SOLID);
    expect(tileAt(map, 100, 0)).toBe(TILE_SOLID);
    expect(tileAt(map, 0, -1)).toBe(TILE_SOLID);
    expect(tileAt(map, 0, 100)).toBe(TILE_SOLID);
  });
});

describe('isSolid', () => {
  it('returns true for solid and all breakable kinds, false for empty', () => {
    expect(isSolid(TILE_SOLID)).toBe(true);
    expect(isSolid(TILE_BREAKABLE)).toBe(true);
    expect(isSolid(TILE_DEPOSIT_BIOMINERAL)).toBe(true);
    expect(isSolid(TILE_SCRAP_CACHE)).toBe(true);
    expect(isSolid(TILE_EMPTY)).toBe(false);
  });
});

describe('breakTile', () => {
  it('converts a breakable tile to empty, increments version, and returns its type', () => {
    const map = parseLevel(['###', '#P*', '###']);
    const v0 = map.version;
    expect(breakTile(map, 2, 1)).toBe(TILE_BREAKABLE);
    expect(tileAt(map, 2, 1)).toBe(TILE_EMPTY);
    expect(map.version).toBe(v0 + 1);
  });

  it('breaks deposit and cache tiles and returns their types', () => {
    const map = parseLevel(['####', '#Pbs', '####']);
    expect(breakTile(map, 2, 1)).toBe(TILE_DEPOSIT_BIOMINERAL);
    expect(breakTile(map, 3, 1)).toBe(TILE_SCRAP_CACHE);
    expect(tileAt(map, 2, 1)).toBe(TILE_EMPTY);
    expect(tileAt(map, 3, 1)).toBe(TILE_EMPTY);
    expect(map.version).toBe(2);
  });

  it('is a no-op returning null on solid tiles', () => {
    const map = parseLevel(SIMPLE);
    const v0 = map.version;
    expect(breakTile(map, 0, 0)).toBeNull();
    expect(tileAt(map, 0, 0)).toBe(TILE_SOLID);
    expect(map.version).toBe(v0);
  });

  it('is a no-op returning null on empty tiles', () => {
    const map = parseLevel(SIMPLE);
    const v0 = map.version;
    expect(breakTile(map, 2, 1)).toBeNull();
    expect(map.version).toBe(v0);
  });

  it('is a no-op returning null out of bounds', () => {
    const map = parseLevel(SIMPLE);
    const v0 = map.version;
    expect(breakTile(map, -1, 0)).toBeNull();
    expect(map.version).toBe(v0);
  });

  it('increments version once per break', () => {
    const map = parseLevel(['###', '#P*', '#**']);
    breakTile(map, 2, 1);
    breakTile(map, 1, 2);
    breakTile(map, 2, 2);
    expect(map.version).toBe(3);
  });
});

describe('ROCKY_TEST_LEVEL', () => {
  it('parses with a pod and at least one of each minable tile kind', async () => {
    const { ROCKY_TEST_LEVEL } = await import('@/game/data/levels');
    const map = parseLevel(ROCKY_TEST_LEVEL);
    expect(map.podX).not.toBeNull();
    expect(map.podY).not.toBeNull();
    expect(map.tiles).toContain(TILE_DEPOSIT_BIOMINERAL);
    expect(map.tiles).toContain(TILE_SCRAP_CACHE);
    expect(map.tiles).toContain(TILE_BREAKABLE);
  });
});
