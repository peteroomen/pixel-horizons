import { describe, expect, it } from 'vitest';

import {
  BACKPACK_CAPACITY,
  BIOMINERAL_DEPOSIT_YIELD,
  FIXED_DT_MS,
  POD_WINDOW_MS,
} from '@/game/data/surface';
import type { InputState } from './clone';
import { baselineLoadout } from './items';
import { createSurface, updateSurface } from './surface';
import type { SurfaceState } from './surface';

/**
 * Integration arena. Clone spawns at (16,16) and falls to the floor (body
 * rests at y=60). Pod 'D' at tile (3,2) → AABB x=48..80, y=32..80, resting on
 * the floor. Biomineral deposit at tile (2,4) is in melee range from spawn
 * facing right; scrap cache at (7,4) sits further right.
 */
const POD_ARENA: string[] = [
  '##########',
  '#P.......#',
  '#..D.....#',
  '#........#',
  '#.b....s.#',
  '##########',
];

const IDLE: InputState = { left: false, right: false, jump: false, attack: false, dash: false };
const RIGHT: InputState = { ...IDLE, right: true };
const ATTACK: InputState = { ...IDLE, attack: true };

function run(state: SurfaceState, input: InputState, n: number): void {
  for (let i = 0; i < n; i++) {
    updateSurface(state, input, FIXED_DT_MS);
  }
}

/** Land, then swing once at the deposit next to spawn (facing right). */
function mineSpawnDeposit(state: SurfaceState): void {
  run(state, IDLE, 30); // fall + settle
  updateSurface(state, ATTACK, FIXED_DT_MS); // rising edge
  run(state, IDLE, 12); // swing through the active window
}

describe('createSurface', () => {
  it('builds pod from the level marker with the default window', () => {
    const state = createSurface(POD_ARENA);
    expect(state.pod).not.toBeNull();
    expect(state.pod?.remainingMs).toBe(POD_WINDOW_MS);
    expect(state.outcome).toBe('ongoing');
    expect(state.lostBackpack).toBeNull();
  });

  it('honors the podWindowMs override', () => {
    const state = createSurface(POD_ARENA, { podWindowMs: 2000 });
    expect(state.pod?.windowMs).toBe(2000);
  });

  it('levels without a pod marker get a null pod and never end', () => {
    const state = createSurface(['######', '#P...#', '######']);
    expect(state.pod).toBeNull();
    run(state, RIGHT, 300);
    expect(state.outcome).toBe('ongoing');
  });
});

describe('mining flows into the backpack', () => {
  it('breaking a deposit adds its yield and bumps the map version', () => {
    const state = createSurface(POD_ARENA);
    const v0 = state.map.version;
    mineSpawnDeposit(state);
    expect(state.clone.backpack.biominerals).toBe(BIOMINERAL_DEPOSIT_YIELD);
    expect(state.map.version).toBe(v0 + 1);
  });

  it('clamps the backpack at capacity, losing overflow', () => {
    const state = createSurface(POD_ARENA);
    run(state, IDLE, 30);
    state.clone.backpack.scrap = BACKPACK_CAPACITY - 1;
    updateSurface(state, ATTACK, FIXED_DT_MS);
    run(state, IDLE, 12);
    // Yield is 2 but only 1 unit of space remained
    expect(state.clone.backpack.biominerals).toBe(1);
    expect(state.clone.backpack.scrap + state.clone.backpack.biominerals).toBe(BACKPACK_CAPACITY);
  });
});

describe('deposit at the pod', () => {
  it('walking onto the pod auto-deposits the backpack', () => {
    const state = createSurface(POD_ARENA);
    mineSpawnDeposit(state);
    run(state, RIGHT, 15); // walk into the pod AABB
    expect(state.clone.backpack.biominerals).toBe(0);
    expect(state.pod?.deposited.biominerals).toBe(BIOMINERAL_DEPOSIT_YIELD);
  });
});

describe('launch outcomes', () => {
  it('clone on the pod at expiry → aboard, everything banked', () => {
    const state = createSurface(POD_ARENA, { podWindowMs: 2000 });
    mineSpawnDeposit(state);
    run(state, RIGHT, 15); // onto the pod
    run(state, IDLE, 150); // wait past the 120-step window
    expect(state.outcome).toBe('aboard');
    expect(state.pod?.launched).toBe(true);
    expect(state.pod?.deposited.biominerals).toBe(BIOMINERAL_DEPOSIT_YIELD);
    expect(state.clone.backpack.biominerals).toBe(0);
    expect(state.lostBackpack).toBeNull();
  });

  it('clone away from the pod at expiry → stranded, backpack lost, deposits safe', () => {
    const state = createSurface(POD_ARENA, { podWindowMs: 2000 });
    mineSpawnDeposit(state); // backpack holds the yield, clone stays at spawn
    run(state, IDLE, 150);
    expect(state.outcome).toBe('stranded');
    expect(state.lostBackpack).toEqual({
      scrap: 0,
      biominerals: BIOMINERAL_DEPOSIT_YIELD,
      coreCrystals: 0,
      blueprints: 0,
    });
    expect(state.clone.backpack).toEqual({
      scrap: 0,
      biominerals: 0,
      coreCrystals: 0,
      blueprints: 0,
    });
    expect(state.pod?.deposited).toEqual({
      scrap: 0,
      biominerals: 0,
      coreCrystals: 0,
      blueprints: 0,
    });
  });

  it('the sim freezes after launch', () => {
    const state = createSurface(POD_ARENA, { podWindowMs: 100 });
    run(state, IDLE, 30); // expires mid-fall — stranded
    expect(state.outcome).toBe('stranded');
    const snapshot = JSON.parse(JSON.stringify(state)) as SurfaceState;
    run(state, { ...IDLE, right: true, jump: true, attack: true }, 30);
    expect(state).toEqual(snapshot);
  });
});

describe('determinism', () => {
  it('the same input script twice produces deep-equal final states', () => {
    const script: InputState[] = [
      ...Array<InputState>(30).fill(IDLE),
      ATTACK,
      ...Array<InputState>(12).fill(IDLE),
      ...Array<InputState>(15).fill(RIGHT),
      { ...IDLE, jump: true },
      ...Array<InputState>(80).fill(IDLE),
    ];
    const a = createSurface(POD_ARENA, { podWindowMs: 1500 });
    const b = createSurface(POD_ARENA, { podWindowMs: 1500 });
    for (const input of script) updateSurface(a, input, FIXED_DT_MS);
    for (const input of script) updateSurface(b, input, FIXED_DT_MS);
    expect(a).toEqual(b);
  });
});

describe('createSurface/updateSurface — loadout integration (3.3)', () => {
  it('applies the yield multiplier to mined deposits', () => {
    const state = createSurface(POD_ARENA, {
      loadout: { ...baselineLoadout(), yieldMultiplier: 2 },
    });
    mineSpawnDeposit(state);
    expect(state.clone.backpack.biominerals).toBe(2 * BIOMINERAL_DEPOSIT_YIELD);
  });

  it('enforces the loadout backpack capacity', () => {
    const state = createSurface(POD_ARENA, {
      loadout: { ...baselineLoadout(), yieldMultiplier: 2, backpackCapacity: 3 },
    });
    mineSpawnDeposit(state);
    // 2× yield = 4 clamps at the capacity of 3
    expect(state.clone.backpack.biominerals).toBe(3);
  });

  it('engine quality extends the pod window', () => {
    const state = createSurface(POD_ARENA, {
      podWindowMs: 10_000,
      loadout: { ...baselineLoadout(), podWindowBonusMs: 90_000 },
    });
    expect(state.pod?.windowMs).toBe(100_000);
    expect(state.pod?.remainingMs).toBe(100_000);
  });

  it('clone inherits loadout capabilities', () => {
    const state = createSurface(POD_ARENA, {
      loadout: {
        ...baselineLoadout(),
        capabilities: {
          maxAirJumps: 2,
          jumpVelocityMultiplier: 1,
          moveSpeedMultiplier: 1,
          dash: null,
        },
      },
    });
    expect(state.clone.capabilities.maxAirJumps).toBe(2);
    expect(state.clone.airJumpsLeft).toBe(2);
  });
});
