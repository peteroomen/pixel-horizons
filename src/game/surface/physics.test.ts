import { describe, expect, it } from 'vitest';

import { TILE_SIZE } from '@/game/data/surface';
import { moveBody } from './physics';
import type { Body } from './physics';
import { TILE_BREAKABLE, TILE_SOLID, parseLevel, tileAt } from './tilemap';

/**
 * Tall arena: 5×6 tiles. Rows 1-4 are open play-space.
 *   Row 0: ##### (solid ceiling, y=0..15)
 *   Row 1: #P..# (spawn; open at 2-3; walls at 0,4)
 *   Row 2: #...# (open)
 *   Row 3: #...# (open)
 *   Row 4: #...# (open)
 *   Row 5: ##### (solid floor, y=80..95)
 * Body w=12,h=20. Floor landing y = 5*16 - 20 = 60.
 * Body starts at y=16..59 to be fully inside without overlap.
 */
const ARENA_ROWS = ['#####', '#P..#', '#...#', '#...#', '#...#', '#####'];

/** Arena with a breakable rock at tile (2,1). */
const ROCK_ROWS = ['#####', '#P*##', '#...#', '#...#', '#####'];

/** Open 10-tile-tall shaft to test genuinely free-fall movement. */
const SHAFT_ROWS = ['####', '#P.#', '#..#', '#..#', '#..#', '#..#', '#..#', '#..#', '#..#', '####'];

function makeBody(x: number, y: number, vx = 0, vy = 0): Body {
  return { x, y, w: 12, h: 20, vx, vy };
}

/** TILE_SIZE = 16. Body height = 20. Floor tile top = row 5 * 16 = 80.
 * Body lands at y = 80 - 20 = 60. */
const FLOOR_LAND_Y = 5 * TILE_SIZE - 20; // = 60

describe('moveBody', () => {
  it('lands exactly on the tile top with vy zeroed', () => {
    const map = parseLevel(ARENA_ROWS);
    // Body well above the floor (y=20, bottom=40, floor at y=80 — no initial overlap).
    // With vy=2000 it moves ~33px in one frame → ends at y≈53, still above floor.
    // Run multiple steps to drive it to the floor.
    const body = makeBody(TILE_SIZE, 20, 0, 2000);
    let result = { onGround: false, hitWall: false, hitCeiling: false };
    for (let i = 0; i < 10; i++) {
      result = moveBody(body, map, 1000 / 60);
      if (result.onGround) break;
    }
    expect(result.onGround).toBe(true);
    expect(body.y).toBe(FLOOR_LAND_Y);
    expect(body.vy).toBe(0);
  });

  it('stops at left wall boundary', () => {
    const map = parseLevel(ARENA_ROWS);
    // Body at col 1 (x=16), y=30 (clear of ceiling and floor), moving left
    const body = makeBody(TILE_SIZE, 30, -500, 0);
    moveBody(body, map, 1000 / 60);
    // After resolution, body should be pushed out of the wall tile
    expect(body.vx).toBe(0);
    expect(body.x).toBeGreaterThanOrEqual(TILE_SIZE); // pushed out of wall
  });

  it('stops at right wall boundary', () => {
    const map = parseLevel(ARENA_ROWS);
    // Body at col 3 (x=48, body right=60), y=30, moving right to hit col 4 wall
    const body = makeBody(3 * TILE_SIZE, 30, 500, 0);
    const result = moveBody(body, map, 1000 / 60);
    expect(result.hitWall).toBe(true);
    expect(body.vx).toBe(0);
  });

  it('hits ceiling and zeroes vy', () => {
    const map = parseLevel(ARENA_ROWS);
    // Body at y=20 (clear of ceiling bottom at y=16), moving up hard
    const body = makeBody(TILE_SIZE, 20, 0, -600);
    const result = moveBody(body, map, 1000 / 60);
    expect(result.hitCeiling).toBe(true);
    expect(body.vy).toBe(0);
  });

  it('breakable tiles are solid for movement', () => {
    const map = parseLevel(ROCK_ROWS);
    // Body at col 1 (x=16), y=20, moving right toward rock at col 2
    const body = makeBody(TILE_SIZE, 20, 400, 0);
    const result = moveBody(body, map, 1000 / 60);
    expect(result.hitWall).toBe(true);
    expect(body.vx).toBe(0);
    // Rock tile must still be there (physics doesn't break tiles)
    expect(tileAt(map, 2, 1)).toBe(TILE_BREAKABLE);
  });

  it('out-of-bounds is treated as solid (blocks movement into walls)', () => {
    const map = parseLevel(ARENA_ROWS);
    // Body at col 1 x=16, y=30, moving left — stops at left wall (col 0)
    const body = makeBody(TILE_SIZE + 1, 30, -150, 0);
    // Run multiple steps to ensure the body reaches the wall
    for (let i = 0; i < 20; i++) {
      moveBody(body, map, 1000 / 60);
    }
    // Body should be stopped at the left wall boundary (col 0 is solid at x=0..15)
    expect(body.vx).toBe(0);
    expect(body.x).toBeGreaterThanOrEqual(TILE_SIZE); // pushed out of wall tile
  });

  it('does not report onGround while airborne in mid-shaft', () => {
    const map = parseLevel(SHAFT_ROWS);
    // Body at y=30 (well into the open shaft), small downward velocity, won't reach floor
    // floor of shaft is at row 9 = y=144; body bottom = 30+20=50 after small move
    const body = makeBody(TILE_SIZE, 30, 0, 5);
    const result = moveBody(body, map, 1000 / 60);
    expect(result.onGround).toBe(false);
    expect(result.hitWall).toBe(false);
    expect(result.hitCeiling).toBe(false);
  });

  it('resting contact: sub-pixel gravity steps never sink through the floor', () => {
    const map = parseLevel(ARENA_ROWS);
    const body = makeBody(TILE_SIZE, FLOOR_LAND_Y, 0, 0);
    // Re-apply a small gravity impulse every frame like updateClone does: one
    // 60fps step at GRAVITY=1500 is vy=25 → a 0.42px penetration, smaller than
    // the 1px the old `floor((edge - 1) / TILE)` scan could see.
    for (let i = 0; i < 600; i++) {
      body.vy = 25;
      const result = moveBody(body, map, 1000 / 60);
      expect(result.onGround).toBe(true);
      expect(body.y).toBe(FLOOR_LAND_Y);
    }
  });

  it('resting contact against a wall: sub-pixel pushes never pass through', () => {
    const map = parseLevel(ARENA_ROWS);
    // Pressed flush against the right wall (col 4 at x=64), nudged 25 px/s right
    const body = makeBody(4 * TILE_SIZE - 12, 30, 0, 0);
    for (let i = 0; i < 600; i++) {
      body.vx = 25;
      moveBody(body, map, 1000 / 60);
      expect(body.x).toBe(4 * TILE_SIZE - 12);
    }
  });

  it('free-fall: no tile collision returns all false flags', () => {
    const map = parseLevel(SHAFT_ROWS);
    // Body deep in the open shaft, no velocity, will not touch any tile
    const body = makeBody(TILE_SIZE, 4 * TILE_SIZE, 0, 0);
    const result = moveBody(body, map, 1000 / 60);
    expect(result.onGround).toBe(false);
    expect(result.hitWall).toBe(false);
    expect(result.hitCeiling).toBe(false);
  });
});

describe('moveBody — tile type checks', () => {
  it('solid tile type constant is 1', () => {
    expect(TILE_SOLID).toBe(1);
  });
  it('breakable tile type constant is 2', () => {
    expect(TILE_BREAKABLE).toBe(2);
  });
});
