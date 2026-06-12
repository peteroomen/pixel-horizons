import { describe, expect, it } from 'vitest';

import {
  ATTACK_ACTIVE_TO_MS,
  ATTACK_COOLDOWN_MS,
  ATTACK_DURATION_MS,
  COYOTE_TIME_MS,
  FIXED_DT_MS,
  JUMP_VELOCITY,
  MOVE_SPEED,
} from '@/game/data/surface';
import { attackHitbox, createClone, updateClone } from './clone';
import type { CloneState, InputState } from './clone';
import { TILE_BREAKABLE, TILE_DEPOSIT_BIOMINERAL, TILE_EMPTY, parseLevel, tileAt } from './tilemap';

/** Tall open arena for movement tests (6 tiles high). */
const ARENA = ['######', '#P...#', '#....#', '#....#', '#....#', '######'];

/**
 * Arena with a breakable rock at floor level next to spawn.
 * Clone at tile (1,4), rock at tile (2,4). Floor is row 5.
 * Clone lands at y = 5*16 - 20 = 60 (body top). Torso at y = 60+10 = 70.
 * Rock tile (2,4): x=32..47, y=64..79. Hitbox at y=62..78 — overlaps.
 */
const ROCK_ARENA = ['######', '#P...#', '#....#', '#....#', '#.*..#', '######'];

const NO_INPUT: InputState = { left: false, right: false, jump: false, attack: false };

type ParsedMap = ReturnType<typeof parseLevel>;

/** Run n fixed timesteps with the same input. */
function steps(clone: CloneState, map: ParsedMap, input: InputState, n: number): void {
  for (let i = 0; i < n; i++) {
    updateClone(clone, map, input, FIXED_DT_MS);
  }
}

/** Run until grounded or a max step limit, then return steps taken. */
function runUntilGrounded(clone: CloneState, map: ParsedMap, maxSteps = 200): number {
  for (let i = 0; i < maxSteps; i++) {
    updateClone(clone, map, NO_INPUT, FIXED_DT_MS);
    if (clone.grounded) return i + 1;
  }
  return maxSteps;
}

describe('createClone', () => {
  it('spawns at the level spawn point', () => {
    const map = parseLevel(ARENA);
    const clone = createClone(map);
    expect(clone.body.x).toBe(map.spawnX);
    expect(clone.body.y).toBe(map.spawnY);
  });

  it('starts with no velocity and no active attack', () => {
    const map = parseLevel(ARENA);
    const clone = createClone(map);
    expect(clone.body.vx).toBe(0);
    expect(clone.body.vy).toBe(0);
    expect(clone.attackElapsedMs).toBe(-1);
  });
});

describe('updateClone — gravity', () => {
  it('clone falls due to gravity when airborne', () => {
    const map = parseLevel(ARENA);
    const clone = createClone(map);
    const initialVy = clone.body.vy;
    updateClone(clone, map, NO_INPUT, FIXED_DT_MS);
    expect(clone.body.vy).toBeGreaterThan(initialVy);
  });

  it('falls and eventually lands on the floor', () => {
    const map = parseLevel(ARENA);
    const clone = createClone(map);
    const n = runUntilGrounded(clone, map);
    expect(clone.grounded).toBe(true);
    expect(n).toBeLessThan(200);
  });
});

describe('updateClone — horizontal movement', () => {
  it('moves right when right is held', () => {
    const map = parseLevel(ARENA);
    const clone = createClone(map);
    const startX = clone.body.x;
    updateClone(clone, map, { ...NO_INPUT, right: true }, FIXED_DT_MS);
    expect(clone.body.x).toBeGreaterThan(startX);
  });

  it('moves left when left is held', () => {
    const map = parseLevel(ARENA);
    const clone = createClone(map);
    steps(clone, map, { ...NO_INPUT, right: true }, 20);
    const startX = clone.body.x;
    updateClone(clone, map, { ...NO_INPUT, left: true }, FIXED_DT_MS);
    expect(clone.body.x).toBeLessThan(startX);
  });

  it('facing updates to match movement direction', () => {
    const map = parseLevel(ARENA);
    const clone = createClone(map);
    updateClone(clone, map, { ...NO_INPUT, right: true }, FIXED_DT_MS);
    expect(clone.facing).toBe(1);
    steps(clone, map, { ...NO_INPUT, right: true }, 20);
    updateClone(clone, map, { ...NO_INPUT, left: true }, FIXED_DT_MS);
    expect(clone.facing).toBe(-1);
  });

  it('vx uses MOVE_SPEED constant', () => {
    const map = parseLevel(ARENA);
    const clone = createClone(map);
    updateClone(clone, map, { ...NO_INPUT, right: true }, FIXED_DT_MS);
    expect(clone.body.vx).toBe(MOVE_SPEED);
  });
});

describe('updateClone — jumping', () => {
  it('cannot jump when airborne (not grounded, no coyote)', () => {
    const map = parseLevel(ARENA);
    const clone = createClone(map);
    // Press jump before landing — not grounded, coyote not active
    updateClone(clone, map, { ...NO_INPUT, jump: true }, FIXED_DT_MS);
    expect(clone.body.vy).not.toBe(JUMP_VELOCITY);
  });

  it('can jump once grounded', () => {
    const map = parseLevel(ARENA);
    const clone = createClone(map);
    runUntilGrounded(clone, map);
    clone.prevJump = false;
    updateClone(clone, map, { ...NO_INPUT, jump: true }, FIXED_DT_MS);
    expect(clone.body.vy).toBe(JUMP_VELOCITY);
    expect(clone.grounded).toBe(false);
  });

  it('jump-cut shortens the apex when button is released early', () => {
    const map = parseLevel(ARENA);

    // Held jump
    const cloneHeld = createClone(map);
    runUntilGrounded(cloneHeld, map);
    cloneHeld.prevJump = false;
    updateClone(cloneHeld, map, { ...NO_INPUT, jump: true }, FIXED_DT_MS);
    let heldPeakY = cloneHeld.body.y;
    for (let i = 0; i < 40; i++) {
      updateClone(cloneHeld, map, { ...NO_INPUT, jump: true }, FIXED_DT_MS);
      if (cloneHeld.body.vy >= 0) break;
      heldPeakY = cloneHeld.body.y;
    }

    // Tapped jump
    const cloneTap = createClone(map);
    runUntilGrounded(cloneTap, map);
    cloneTap.prevJump = false;
    updateClone(cloneTap, map, { ...NO_INPUT, jump: true }, FIXED_DT_MS);
    updateClone(cloneTap, map, { ...NO_INPUT, jump: false }, FIXED_DT_MS); // release
    let tapPeakY = cloneTap.body.y;
    for (let i = 0; i < 40; i++) {
      updateClone(cloneTap, map, NO_INPUT, FIXED_DT_MS);
      if (cloneTap.body.vy >= 0) break;
      tapPeakY = cloneTap.body.y;
    }

    // Held jump reaches higher (lower Y value)
    expect(heldPeakY).toBeLessThan(tapPeakY);
  });

  it('coyote jump fires within the window after walking off a ledge', () => {
    const map = parseLevel(ARENA);
    const clone = createClone(map);
    runUntilGrounded(clone, map);
    // Simulate walking off a ledge: set coyote active, unground
    clone.grounded = false;
    clone.coyoteMs = COYOTE_TIME_MS;
    clone.prevJump = false;
    updateClone(clone, map, { ...NO_INPUT, jump: true }, FIXED_DT_MS);
    expect(clone.body.vy).toBe(JUMP_VELOCITY);
  });

  it('coyote jump does not fire after window expires', () => {
    const map = parseLevel(ARENA);
    const clone = createClone(map);
    // Genuinely airborne, well above the floor (body 30..50, floor top at 80) —
    // a clone still standing on the floor would simply re-ground and jump.
    clone.body.y = 30;
    clone.grounded = false;
    clone.coyoteMs = 1; // Almost expired
    // One frame to expire coyote
    updateClone(clone, map, NO_INPUT, FIXED_DT_MS);
    expect(clone.coyoteMs).toBe(0);
    expect(clone.grounded).toBe(false);
    // Try to jump — should fail
    clone.prevJump = false;
    const vyBefore = clone.body.vy;
    updateClone(clone, map, { ...NO_INPUT, jump: true }, FIXED_DT_MS);
    expect(clone.body.vy).not.toBe(JUMP_VELOCITY);
    expect(clone.body.vy).toBeGreaterThan(vyBefore); // gravity applied
  });

  it('jump buffer remembers a press while airborne', () => {
    const map = parseLevel(ARENA);
    const clone = createClone(map);
    runUntilGrounded(clone, map);
    // Jump up
    clone.prevJump = false;
    updateClone(clone, map, { ...NO_INPUT, jump: true }, FIXED_DT_MS);
    // Hold a few frames then release
    for (let i = 0; i < 5; i++) updateClone(clone, map, NO_INPUT, FIXED_DT_MS);
    // Press jump while in the air
    clone.prevJump = false;
    updateClone(clone, map, { ...NO_INPUT, jump: true }, FIXED_DT_MS);
    expect(clone.jumpBufferMs).toBeGreaterThan(0);
  });
});

describe('updateClone — attack', () => {
  it('starts an attack on rising edge when cooldown is zero', () => {
    const map = parseLevel(ARENA);
    const clone = createClone(map);
    runUntilGrounded(clone, map);
    clone.prevAttack = false;
    updateClone(clone, map, { ...NO_INPUT, attack: true }, FIXED_DT_MS);
    expect(clone.attackElapsedMs).toBeGreaterThanOrEqual(0);
  });

  it('attack hitbox becomes active during the active window', () => {
    const map = parseLevel(ARENA);
    const clone = createClone(map);
    runUntilGrounded(clone, map);
    clone.prevAttack = false;
    let hbSeen = false;
    for (let i = 0; i < 20; i++) {
      updateClone(clone, map, i === 0 ? { ...NO_INPUT, attack: true } : NO_INPUT, FIXED_DT_MS);
      if (attackHitbox(clone) !== null) {
        hbSeen = true;
        break;
      }
    }
    expect(hbSeen).toBe(true);
  });

  it('attack hitbox is null when idle', () => {
    const map = parseLevel(ARENA);
    const clone = createClone(map);
    expect(attackHitbox(clone)).toBeNull();
  });

  it('attack cooldown prevents immediate re-swing', () => {
    const map = parseLevel(ARENA);
    const clone = createClone(map);
    runUntilGrounded(clone, map);
    clone.prevAttack = false;
    updateClone(clone, map, { ...NO_INPUT, attack: true }, FIXED_DT_MS);
    expect(clone.attackElapsedMs).toBeGreaterThanOrEqual(0);
    // Wait for attack to finish
    const framesForAttack = Math.ceil(ATTACK_DURATION_MS / FIXED_DT_MS) + 2;
    steps(clone, map, NO_INPUT, framesForAttack);
    expect(clone.attackElapsedMs).toBe(-1); // idle
    expect(clone.attackCooldownMs).toBeGreaterThan(0); // still on cooldown
    // Try to re-attack — blocked by cooldown
    clone.prevAttack = false;
    updateClone(clone, map, { ...NO_INPUT, attack: true }, FIXED_DT_MS);
    expect(clone.attackElapsedMs).toBe(-1); // still idle
  });

  it('attack cooldown expires after ATTACK_COOLDOWN_MS', () => {
    const map = parseLevel(ARENA);
    const clone = createClone(map);
    runUntilGrounded(clone, map);
    clone.prevAttack = false;
    updateClone(clone, map, { ...NO_INPUT, attack: true }, FIXED_DT_MS);
    const framesForCooldown = Math.ceil(ATTACK_COOLDOWN_MS / FIXED_DT_MS) + 2;
    steps(clone, map, NO_INPUT, framesForCooldown);
    expect(clone.attackCooldownMs).toBe(0);
    // Now can attack again
    clone.prevAttack = false;
    updateClone(clone, map, { ...NO_INPUT, attack: true }, FIXED_DT_MS);
    expect(clone.attackElapsedMs).toBeGreaterThanOrEqual(0);
  });

  it('breaks a breakable rock within the attack hitbox and reports it', () => {
    const map = parseLevel(ROCK_ARENA);
    const clone = createClone(map);
    runUntilGrounded(clone, map);
    clone.facing = 1; // face right
    clone.prevAttack = false;
    // Run through the full active window, collecting reported breaks
    const allBroken: number[] = [];
    const framesForActive = Math.ceil(ATTACK_ACTIVE_TO_MS / FIXED_DT_MS) + 2;
    for (let i = 0; i < framesForActive; i++) {
      const { brokenTiles } = updateClone(
        clone,
        map,
        i === 0 ? { ...NO_INPUT, attack: true } : NO_INPUT,
        FIXED_DT_MS,
      );
      allBroken.push(...brokenTiles);
    }
    // Rock at tile (2,4) should be broken (at floor level, within attack range)
    expect(tileAt(map, 2, 4)).toBe(TILE_EMPTY);
    expect(allBroken).toEqual([TILE_BREAKABLE]);
  });

  it('returns no broken tiles for swings that hit nothing', () => {
    const map = parseLevel(ARENA);
    const clone = createClone(map);
    runUntilGrounded(clone, map);
    clone.prevAttack = false;
    const framesForActive = Math.ceil(ATTACK_ACTIVE_TO_MS / FIXED_DT_MS) + 2;
    for (let i = 0; i < framesForActive; i++) {
      const { brokenTiles } = updateClone(
        clone,
        map,
        i === 0 ? { ...NO_INPUT, attack: true } : NO_INPUT,
        FIXED_DT_MS,
      );
      expect(brokenTiles).toEqual([]);
    }
  });

  it('reports two stacked tiles broken by one swing in a single step', () => {
    // Deposit at torso height (row 3) and rock at floor level (row 4), both in column 2.
    // Hitbox spans y=62..78 → tile rows 3 (48..63) and 4 (64..79) — both overlap.
    const map = parseLevel(['######', '#P...#', '#....#', '#.b..#', '#.*..#', '######']);
    const clone = createClone(map);
    runUntilGrounded(clone, map);
    clone.facing = 1;
    clone.prevAttack = false;
    const allBroken: number[] = [];
    const framesForActive = Math.ceil(ATTACK_ACTIVE_TO_MS / FIXED_DT_MS) + 2;
    for (let i = 0; i < framesForActive; i++) {
      const { brokenTiles } = updateClone(
        clone,
        map,
        i === 0 ? { ...NO_INPUT, attack: true } : NO_INPUT,
        FIXED_DT_MS,
      );
      if (brokenTiles.length > 0) {
        allBroken.push(...brokenTiles);
        // Both must arrive in the same step (the first active frame)
        expect(brokenTiles).toHaveLength(2);
      }
    }
    expect(allBroken.sort()).toEqual([TILE_BREAKABLE, TILE_DEPOSIT_BIOMINERAL].sort());
  });
});

describe('determinism', () => {
  it('same input script twice produces deep-equal final states', () => {
    const map1 = parseLevel(ROCK_ARENA);
    const map2 = parseLevel(ROCK_ARENA);
    const clone1 = createClone(map1);
    const clone2 = createClone(map2);

    const script: InputState[] = [
      // Fall to floor
      ...Array<InputState>(20).fill(NO_INPUT),
      // Run right
      ...Array<InputState>(10).fill({ ...NO_INPUT, right: true }),
      // Jump
      { ...NO_INPUT, jump: true },
      ...Array<InputState>(5).fill({ ...NO_INPUT, jump: true }),
      // Land and attack
      ...Array<InputState>(20).fill(NO_INPUT),
      { ...NO_INPUT, attack: true },
      ...Array<InputState>(15).fill(NO_INPUT),
    ];

    for (const input of script) {
      updateClone(clone1, map1, input, FIXED_DT_MS);
    }
    for (const input of script) {
      updateClone(clone2, map2, input, FIXED_DT_MS);
    }

    expect(clone1).toEqual(clone2);
    expect(map1.tiles).toEqual(map2.tiles);
    expect(map1.version).toBe(map2.version);
  });
});

describe('updateClone — real level integration', () => {
  it('idles grounded on the Rocky test level floor indefinitely', async () => {
    const { ROCKY_TEST_LEVEL } = await import('@/game/data/levels');
    const map = parseLevel(ROCKY_TEST_LEVEL);
    const clone = createClone(map);
    const idle: InputState = { left: false, right: false, jump: false, attack: false };
    for (let i = 0; i < 600; i++) {
      updateClone(clone, map, idle, FIXED_DT_MS);
    }
    // Spawn column's floor is row 18 (top y = 288); clone rests at 288 - 20 = 268
    expect(clone.body.y).toBe(268);
    expect(clone.grounded).toBe(true);
  });
});
