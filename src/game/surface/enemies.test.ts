import { describe, expect, it } from 'vitest';

import { FIXED_DT_MS } from '@/game/data/surface';
import { createClone, updateClone } from './clone';
import type { CloneState, InputState } from './clone';
import { createEnemies, updateEnemies } from './enemies';
import type { EnemyState } from './enemies';
import { BASELINE_CAPABILITIES } from './items';
import { parseLevel } from './tilemap';
import type { Tilemap } from './tilemap';

const FLOOR = ['################', '#P.............#', '#..............#', '################'];
const IDLE: InputState = { left: false, right: false, jump: false, attack: false, dash: false };

function settledClone(map: Tilemap, shieldMs: number | null = null): CloneState {
  const clone = createClone(map, BASELINE_CAPABILITIES, shieldMs);
  for (let i = 0; i < 30; i++) updateClone(clone, map, IDLE, FIXED_DT_MS);
  return clone;
}

/** A clone frozen mid-swing facing right at the given position. */
function attackingCloneAt(map: Tilemap, x: number, y: number): CloneState {
  const clone = createClone(map, BASELINE_CAPABILITIES);
  clone.body.x = x;
  clone.body.y = y;
  clone.facing = 1;
  clone.attackElapsedMs = 80; // inside the 40–140ms active window
  return clone;
}

function enemy(
  type: EnemyState['type'],
  x: number,
  y: number,
  over: Partial<EnemyState> = {},
): EnemyState {
  const base = createEnemies(parseLevel(['#####', `#P${typeToken(type)}.#`, '#####']))[0];
  return { ...base, body: { ...base.body, x, y }, ...over };
}

function typeToken(type: EnemyState['type']): string {
  return type === 'hopper' ? 'H' : type === 'grubber' ? 'G' : 'C';
}

describe('createEnemies', () => {
  it('builds enemies from spawn tokens with the right HP and type', () => {
    const map = parseLevel(['########', '#P.HGC.#', '########']);
    const enemies = createEnemies(map);
    expect(enemies.map((e) => e.type).sort()).toEqual(['dropper', 'grubber', 'hopper']);
    expect(enemies.find((e) => e.type === 'grubber')!.hp).toBe(2);
    expect(enemies.find((e) => e.type === 'dropper')!.clinging).toBe(true);
  });
});

describe('melee', () => {
  it('kills a 1-HP hopper in one swing and drops Scrap', () => {
    const map = parseLevel(FLOOR);
    const clone = attackingCloneAt(map, 100, 32);
    const e = enemy('hopper', 114, 32); // inside the right-facing hitbox
    const drops = updateEnemies([e], clone, map, FIXED_DT_MS);
    expect(e.alive).toBe(false);
    expect(drops).toHaveLength(1);
    expect(drops[0].resources.scrap).toBe(1);
  });

  it('takes two swings to kill a 2-HP grubber (one hit per swing)', () => {
    const map = parseLevel(FLOOR);
    const clone = attackingCloneAt(map, 100, 32);
    const e = enemy('grubber', 114, 32);
    updateEnemies([e], clone, map, FIXED_DT_MS);
    expect(e.alive).toBe(true);
    expect(e.hp).toBe(1);
    // Same swing can't re-hit (hitCooldown) — drive several frames.
    for (let i = 0; i < 5; i++) updateEnemies([e], clone, map, FIXED_DT_MS);
    expect(e.alive).toBe(true);
  });
});

describe('contact damage', () => {
  it('a provoked grubber damages the clone on contact', () => {
    const map = parseLevel(FLOOR);
    const clone = settledClone(map);
    clone.body.x = 100;
    const e = enemy('grubber', 104, clone.body.y, { provoked: true });
    const hp0 = clone.hp;
    updateEnemies([e], clone, map, FIXED_DT_MS);
    expect(clone.hp).toBe(hp0 - 1);
  });

  it('an un-provoked grubber does not damage the clone', () => {
    const map = parseLevel(FLOOR);
    const clone = settledClone(map);
    clone.body.x = 100;
    const e = enemy('grubber', 104, clone.body.y, { provoked: false });
    const hp0 = clone.hp;
    for (let i = 0; i < 3; i++) updateEnemies([e], clone, map, FIXED_DT_MS);
    expect(clone.hp).toBe(hp0);
  });
});

describe('bloom hopper', () => {
  it('leaps when the clone is within aggro range', () => {
    const map = parseLevel(FLOOR);
    const clone = settledClone(map);
    clone.body.x = 400; // far out of aggro range while the hopper lands
    const e = enemy('hopper', 60, 32);
    for (let i = 0; i < 10; i++) updateEnemies([e], clone, map, FIXED_DT_MS);
    expect(e.grounded).toBe(true);
    // Bring the clone within range → next step leaps (upward, leaves ground).
    clone.body.x = 100;
    updateEnemies([e], clone, map, FIXED_DT_MS);
    expect(e.body.vy).toBeLessThan(0);
  });
});

describe('ceiling dropper', () => {
  it('releases from the ceiling when the clone passes beneath', () => {
    const map = parseLevel(FLOOR);
    const e = enemy('dropper', 100, 20, { clinging: true });
    const clone = createClone(map, BASELINE_CAPABILITIES);
    clone.body.x = 100; // aligned in x
    clone.body.y = 40; // below the dropper
    updateEnemies([e], clone, map, FIXED_DT_MS);
    expect(e.clinging).toBe(false);
  });

  it('is flung upward when a Shield Bubble absorbs its hit', () => {
    const map = parseLevel(FLOOR);
    const clone = settledClone(map, 4000);
    clone.body.x = 100;
    const e = enemy('dropper', 100, clone.body.y, { clinging: false });
    updateEnemies([e], clone, map, FIXED_DT_MS);
    expect(e.body.vy).toBeLessThan(0);
    expect(clone.shield?.ready).toBe(false);
  });
});
