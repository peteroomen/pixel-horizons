import { describe, expect, it } from 'vitest';

import { FIXED_DT_MS, HITSTUN_MS, IFRAMES_MS, KNOCKBACK_VX, MOVE_SPEED } from '@/game/data/surface';
import { createClone, damageClone, respawnClone, updateClone } from './clone';
import type { InputState } from './clone';
import { BASELINE_CAPABILITIES } from './items';
import { parseLevel } from './tilemap';

const FLAT = ['##########', '#P.......#', '#........#', '##########'];
const IDLE: InputState = { left: false, right: false, jump: false, attack: false, dash: false };

function ground(): ReturnType<typeof createClone> {
  const map = parseLevel(FLAT);
  const clone = createClone(map, BASELINE_CAPABILITIES);
  // Let it settle on the floor.
  for (let i = 0; i < 30; i++) updateClone(clone, map, IDLE, FIXED_DT_MS);
  return clone;
}

describe('damageClone', () => {
  it('reduces HP, grants i-frames + hit-stun, and knocks back away from the source', () => {
    const clone = ground();
    const hp0 = clone.hp;
    // Source to the left → knockback to the right.
    const result = damageClone(clone, 1, clone.body.x - 50);
    expect(result).toBe('damaged');
    expect(clone.hp).toBe(hp0 - 1);
    expect(clone.iframesMs).toBe(IFRAMES_MS);
    expect(clone.hitstunMs).toBe(HITSTUN_MS);
    expect(clone.body.vx).toBe(KNOCKBACK_VX);
    expect(clone.body.vy).toBeLessThan(0);
  });

  it('ignores hits during i-frames', () => {
    const clone = ground();
    damageClone(clone, 1, 0);
    const hp1 = clone.hp;
    expect(damageClone(clone, 1, 0)).toBe('ignored');
    expect(clone.hp).toBe(hp1);
  });

  it('dies at 0 HP and starts the death fade', () => {
    const clone = ground();
    clone.hp = 1;
    const result = damageClone(clone, 1, 0);
    expect(result).toBe('died');
    expect(clone.dead).toBe(true);
    expect(clone.hp).toBe(0);
    expect(clone.deathFadeMs).toBeGreaterThan(0);
  });
});

describe('Shield Bubble', () => {
  it('absorbs the first hit without HP loss; a hit while down damages', () => {
    const map = parseLevel(FLAT);
    // Recharge longer than i-frames so there's a window where it's truly down.
    const clone = createClone(map, BASELINE_CAPABILITIES, 3000);
    for (let i = 0; i < 30; i++) updateClone(clone, map, IDLE, FIXED_DT_MS);
    const hp0 = clone.hp;

    expect(damageClone(clone, 1, 0)).toBe('shielded');
    expect(clone.hp).toBe(hp0);
    expect(clone.shield?.ready).toBe(false);

    // Tick past i-frames (1500ms) but not past the 3000ms recharge.
    for (let i = 0; i < 110; i++) updateClone(clone, map, IDLE, FIXED_DT_MS);
    expect(clone.iframesMs).toBe(0);
    expect(clone.shield?.ready).toBe(false);
    expect(damageClone(clone, 1, 0)).toBe('damaged');
    expect(clone.hp).toBe(hp0 - 1);
  });

  it('recharges to ready after the cooldown', () => {
    const map = parseLevel(FLAT);
    const clone = createClone(map, BASELINE_CAPABILITIES, 500);
    for (let i = 0; i < 30; i++) updateClone(clone, map, IDLE, FIXED_DT_MS);
    damageClone(clone, 1, 0);
    expect(clone.shield?.ready).toBe(false);
    for (let i = 0; i < 40; i++) updateClone(clone, map, IDLE, FIXED_DT_MS); // ~666ms
    expect(clone.shield?.ready).toBe(true);
  });
});

describe('hit-stun', () => {
  it('locks input but preserves knockback velocity', () => {
    const map = parseLevel(FLAT);
    const clone = createClone(map, BASELINE_CAPABILITIES);
    for (let i = 0; i < 30; i++) updateClone(clone, map, IDLE, FIXED_DT_MS);

    damageClone(clone, 1, clone.body.x - 100); // source left → knockback right (open space)
    expect(clone.body.vx).toBe(KNOCKBACK_VX);

    // Holding left during hit-stun does NOT overwrite the knockback vx.
    updateClone(clone, map, { ...IDLE, left: true }, FIXED_DT_MS);
    expect(clone.body.vx).toBeGreaterThan(0);

    // Once hit-stun expires, input drives movement again.
    for (let i = 0; i < 20; i++) updateClone(clone, map, { ...IDLE, left: true }, FIXED_DT_MS);
    expect(clone.body.vx).toBeLessThan(0);
  });
});

describe('regen (Repair Matrix)', () => {
  it('heals 1 HP per regenMsPerHp while grounded', () => {
    const map = parseLevel(FLAT);
    const clone = createClone(map, { ...BASELINE_CAPABILITIES, regenMsPerHp: 500 });
    for (let i = 0; i < 30; i++) updateClone(clone, map, IDLE, FIXED_DT_MS);
    clone.hp = 1;
    // ~600ms grounded → at least one regen tick.
    for (let i = 0; i < 40; i++) updateClone(clone, map, IDLE, FIXED_DT_MS);
    expect(clone.hp).toBe(2);
  });

  it('does not regen past max HP', () => {
    const map = parseLevel(FLAT);
    const clone = createClone(map, { ...BASELINE_CAPABILITIES, regenMsPerHp: 100 });
    for (let i = 0; i < 120; i++) updateClone(clone, map, IDLE, FIXED_DT_MS);
    expect(clone.hp).toBe(clone.maxHp);
  });
});

describe('respawnClone', () => {
  it('resets HP, death, and position', () => {
    const clone = ground();
    damageClone(clone, clone.hp, 0); // kill
    expect(clone.dead).toBe(true);
    respawnClone(clone, 100, 40);
    expect(clone.dead).toBe(false);
    expect(clone.hp).toBe(clone.maxHp);
    expect(clone.body.x).toBe(100);
    expect(clone.body.y).toBe(40);
    expect(clone.iframesMs).toBe(0);
  });
});

describe('external vent impulse', () => {
  it('pushes the clone horizontally on top of input', () => {
    const map = parseLevel(FLAT);
    const clone = createClone(map, BASELINE_CAPABILITIES);
    for (let i = 0; i < 30; i++) updateClone(clone, map, IDLE, FIXED_DT_MS);
    const x0 = clone.body.x;
    // No input, but a steady rightward vent push moves the clone right.
    for (let i = 0; i < 10; i++) updateClone(clone, map, IDLE, FIXED_DT_MS, MOVE_SPEED);
    expect(clone.body.x).toBeGreaterThan(x0);
  });
});
