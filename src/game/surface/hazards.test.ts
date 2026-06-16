import { describe, expect, it } from 'vitest';

import {
  CRUMBLE_BREAK_MS,
  CRUMBLE_REFORM_MS,
  FIXED_DT_MS,
  VENT_ACTIVE_MS,
} from '@/game/data/surface';
import type { Body } from './physics';
import {
  brambleContact,
  createCrumbleTiles,
  updateCrumbling,
  ventPush,
  ventsActive,
} from './hazards';
import { TILE_CRUMBLING, TILE_EMPTY, parseLevel } from './tilemap';

describe('brambleContact', () => {
  const map = parseLevel(['######', '#P^..#', '#....#', '######']);
  it('detects overlap with a Spike Bramble tile', () => {
    // Bramble at tile (2,1) → px x 32..48, y 16..32.
    const onit: Body = { x: 34, y: 18, w: 12, h: 12, vx: 0, vy: 0 };
    expect(brambleContact(map, onit)).toBe(true);
  });
  it('is false away from bramble', () => {
    const away: Body = { x: 18, y: 18, w: 12, h: 12, vx: 0, vy: 0 };
    expect(brambleContact(map, away)).toBe(false);
  });
});

describe('crumbling sandstone', () => {
  // Crumbling tile at (1,2): px x 16..32, top y 32.
  const rows = ['######', '#P...#', '#~~~~#', '######'];

  function standingBody(): Body {
    // Feet rest on the crumbling row (bottom edge at y=32).
    return { x: 16, y: 12, w: 12, h: 20, vx: 0, vy: 0 };
  }

  it('breaks after the break delay while stood on, then re-forms', () => {
    const map = parseLevel(rows);
    const crumbles = createCrumbleTiles(map);
    expect(crumbles.length).toBe(4);
    const body = standingBody();

    const breakSteps = Math.ceil(CRUMBLE_BREAK_MS / FIXED_DT_MS) + 1;
    for (let i = 0; i < breakSteps; i++) updateCrumbling(crumbles, map, body, true, FIXED_DT_MS);

    const target = crumbles.find((c) => c.tx === 1 && c.ty === 2)!;
    expect(target.state).toBe('gone');
    expect(map.tiles[2 * map.width + 1]).toBe(TILE_EMPTY);

    // Move off; after the reform delay it returns to solid.
    const off: Body = { x: 200, y: 12, w: 12, h: 20, vx: 0, vy: 0 };
    const reformSteps = Math.ceil(CRUMBLE_REFORM_MS / FIXED_DT_MS) + 1;
    for (let i = 0; i < reformSteps; i++) updateCrumbling(crumbles, map, off, false, FIXED_DT_MS);
    expect(target.state).toBe('solid');
    expect(map.tiles[2 * map.width + 1]).toBe(TILE_CRUMBLING);
  });

  it('does not break when only floated over (not grounded)', () => {
    const map = parseLevel(rows);
    const crumbles = createCrumbleTiles(map);
    const body = standingBody();
    for (let i = 0; i < 60; i++) updateCrumbling(crumbles, map, body, false, FIXED_DT_MS);
    expect(crumbles.every((c) => c.state === 'solid')).toBe(true);
  });
});

describe('sandstorm vent', () => {
  const map = parseLevel(['######', '#P...#', '#..V.#', '######']);
  // Vent at tile (3,2): px x 48..64, top y 32.
  const overVent: Body = { x: 50, y: 18, w: 12, h: 12, vx: 0, vy: 0 };

  it('pushes the clone while active and in the band', () => {
    expect(ventsActive(0)).toBe(true);
    expect(ventPush(map.vents, 0, overVent)).not.toBe(0);
  });

  it('is idle during the off phase', () => {
    expect(ventsActive(VENT_ACTIVE_MS)).toBe(false);
    expect(ventPush(map.vents, VENT_ACTIVE_MS, overVent)).toBe(0);
  });

  it('does not push far-away bodies', () => {
    const far: Body = { x: 18, y: 18, w: 12, h: 12, vx: 0, vy: 0 };
    expect(ventPush(map.vents, 0, far)).toBe(0);
  });
});
