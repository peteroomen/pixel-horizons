import { describe, expect, it } from 'vitest';

import { TILE_SIZE } from '@/game/data/surface';
import {
  TILE_BREAKABLE,
  TILE_EMPTY,
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
  it('returns true for solid and breakable tiles, false for empty', () => {
    expect(isSolid(TILE_SOLID)).toBe(true);
    expect(isSolid(TILE_BREAKABLE)).toBe(true);
    expect(isSolid(TILE_EMPTY)).toBe(false);
  });
});

describe('breakTile', () => {
  it('converts a breakable tile to empty and increments version', () => {
    const map = parseLevel(['###', '#P*', '###']);
    const v0 = map.version;
    breakTile(map, 2, 1);
    expect(tileAt(map, 2, 1)).toBe(TILE_EMPTY);
    expect(map.version).toBe(v0 + 1);
  });

  it('is a no-op on solid tiles', () => {
    const map = parseLevel(SIMPLE);
    const v0 = map.version;
    breakTile(map, 0, 0);
    expect(tileAt(map, 0, 0)).toBe(TILE_SOLID);
    expect(map.version).toBe(v0);
  });

  it('is a no-op on empty tiles', () => {
    const map = parseLevel(SIMPLE);
    const v0 = map.version;
    breakTile(map, 2, 1);
    expect(map.version).toBe(v0);
  });

  it('is a no-op out of bounds', () => {
    const map = parseLevel(SIMPLE);
    const v0 = map.version;
    breakTile(map, -1, 0);
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
