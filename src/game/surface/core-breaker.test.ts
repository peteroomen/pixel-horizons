import { describe, expect, it } from 'vitest';

import {
  type Peg,
  type ShotInput,
  createPeg,
  defaultConfig,
  pegDef,
  simulateShot,
} from './core-breaker';

const DOWN = Math.PI / 2; // straight down (y-down screen space)

function clonePegs(pegs: Peg[]): Peg[] {
  return pegs.map((p) => ({ ...p }));
}

/** A small hand-authored field below the launch point — RNG-free (field-gen is CB.2). */
function field(): Peg[] {
  return [
    createPeg(0, 300, 120, 'mineral', 7),
    createPeg(1, 340, 140, 'ore', 7),
    createPeg(2, 320, 180, 'hardrock', 7),
    createPeg(3, 360, 220, 'mineral', 7),
    createPeg(4, 290, 240, 'crystal', 7),
  ];
}

describe('core-breaker determinism', () => {
  it('same field + same shot ⇒ identical break/drop stream', () => {
    const cfg = defaultConfig();
    const shot: ShotInput = { type: 'bouncy', angleRad: DOWN + 0.15, power: 320 };
    expect(simulateShot(field(), shot, cfg)).toEqual(simulateShot(field(), shot, cfg));
  });

  it('a scripted multi-shot drop reproduces exactly', () => {
    const cfg = defaultConfig();
    const shots: ShotInput[] = [
      { type: 'pierce', angleRad: DOWN, power: 500 },
      { type: 'bouncy', angleRad: DOWN + 0.2, power: 300 },
      { type: 'homing', angleRad: DOWN - 0.1, power: 280 },
    ];
    const runDrop = (pegs: Peg[]) => shots.map((s) => simulateShot(pegs, s, cfg));
    expect(runDrop(field())).toEqual(runDrop(field()));
  });
});

describe('core-breaker peg behaviour', () => {
  it('PEG_DEFS map the §6.7 resources', () => {
    expect(pegDef('mineral')).toEqual({ maxHits: 1, resource: 'scrap', amount: 1 });
    expect(pegDef('ore')).toEqual({ maxHits: 3, resource: 'biominerals', amount: 2 });
    expect(pegDef('crystal')).toEqual({ maxHits: 4, resource: 'coreCrystals', amount: 1 });
  });

  it('a single pierce pass registers exactly one hit (cooldown stops double-count)', () => {
    const cfg = defaultConfig();
    const ore = [createPeg(0, 320, 120, 'ore', 7)];
    const res = simulateShot(ore, { type: 'pierce', angleRad: DOWN, power: 600 }, cfg);
    expect(ore[0].hits).toBe(2); // 3 → 2, not all the way down
    expect(res.brokenPegIds).not.toContain(0);
  });

  it('a mineral peg breaks in one hit and drops scrap', () => {
    const cfg = defaultConfig();
    const pegs = [createPeg(0, 320, 120, 'mineral', 7)];
    const res = simulateShot(pegs, { type: 'pierce', angleRad: DOWN, power: 600 }, cfg);
    expect(res.brokenPegIds).toContain(0);
    expect(res.drops).toEqual([{ pegId: 0, kind: 'mineral', resource: 'scrap', amount: 1 }]);
  });

  it('an ore peg breaks on the third hit and drops biominerals', () => {
    const cfg = defaultConfig();
    const ore = [createPeg(0, 320, 120, 'ore', 7)];
    const shot: ShotInput = { type: 'pierce', angleRad: DOWN, power: 600 };
    simulateShot(ore, shot, cfg);
    expect(ore[0].hits).toBe(2);
    simulateShot(ore, shot, cfg);
    expect(ore[0].hits).toBe(1);
    const res = simulateShot(ore, shot, cfg);
    expect(res.brokenPegIds).toContain(0);
    expect(res.drops).toEqual([{ pegId: 0, kind: 'ore', resource: 'biominerals', amount: 2 }]);
  });
});

describe('core-breaker Bloom hazard', () => {
  it('consumes a bouncy ball and is NOT cleared', () => {
    const cfg = defaultConfig();
    const bloom = [createPeg(0, 320, 120, 'bloom', 7)];
    const res = simulateShot(bloom, { type: 'bouncy', angleRad: DOWN, power: 400 }, cfg);
    expect(res.end).toBe('consumed');
    expect(bloom[0].hits).toBe(1);
    expect(res.brokenPegIds).not.toContain(0);
  });

  it('a pierce ball punches through and clears it', () => {
    const cfg = defaultConfig();
    const bloom = [createPeg(0, 320, 120, 'bloom', 7)];
    const res = simulateShot(bloom, { type: 'pierce', angleRad: DOWN, power: 400 }, cfg);
    expect(res.brokenPegIds).toContain(0);
    expect(res.end).not.toBe('consumed');
    expect(res.drops).toEqual([{ pegId: 0, kind: 'bloom', resource: 'scrap', amount: 1 }]);
  });

  it('a phase ball survives the first Bloom but is consumed by the second', () => {
    const cfg = defaultConfig();
    const two = [createPeg(0, 320, 110, 'bloom', 7), createPeg(1, 320, 200, 'bloom', 7)];
    const res = simulateShot(two, { type: 'phase', angleRad: DOWN, power: 400 }, cfg);
    expect(res.brokenPegIds).toEqual([0]); // first cleared via phase
    expect(res.end).toBe('consumed'); // second consumes it
    expect(two[1].hits).toBe(1); // second not cleared
  });
});

describe('core-breaker shot termination', () => {
  it('settles when speed stays below the rest threshold', () => {
    const cfg = { ...defaultConfig(), gravity: 0 };
    const res = simulateShot([], { type: 'pierce', angleRad: DOWN, power: 5 }, cfg);
    expect(res.end).toBe('settled');
  });

  it('ends as fellOut when the ball drops past the floor', () => {
    const cfg = defaultConfig();
    const res = simulateShot([], { type: 'bouncy', angleRad: DOWN, power: 300 }, cfg);
    expect(res.end).toBe('fellOut');
  });

  it('respects the maxSteps cap (no infinite loop)', () => {
    const cfg = { ...defaultConfig(), gravity: 0, restitution: 1, maxSteps: 400 };
    const res = simulateShot([], { type: 'bouncy', angleRad: 0, power: 100 }, cfg);
    expect(res.end).toBe('maxSteps');
    expect(res.steps).toBe(400);
  });
});

describe('core-breaker fixed-step solver', () => {
  it('does not tunnel a fast ball through a peg at the default sub-step', () => {
    const cfg = defaultConfig();
    const pegs = [createPeg(0, 320, 164, 'mineral', 7)];
    const res = simulateShot(pegs, { type: 'pierce', angleRad: DOWN, power: 2400 }, cfg);
    expect(res.brokenPegIds).toContain(0);
  });

  it('demonstrates why sub-stepping matters: a coarse step tunnels the same shot', () => {
    const cfg = { ...defaultConfig(), step: 1 / 60 };
    const pegs = [createPeg(0, 320, 164, 'mineral', 7)];
    const res = simulateShot(pegs, { type: 'pierce', angleRad: DOWN, power: 2400 }, cfg);
    expect(res.brokenPegIds).not.toContain(0);
  });

  it('pierce and bouncy balls produce distinguishable outcomes on the same field', () => {
    const cfg = defaultConfig();
    const f = field();
    const pierce = simulateShot(
      clonePegs(f),
      { type: 'pierce', angleRad: DOWN + 0.1, power: 350 },
      cfg,
    );
    const bouncy = simulateShot(
      clonePegs(f),
      { type: 'bouncy', angleRad: DOWN + 0.1, power: 350 },
      cfg,
    );
    expect(pierce).not.toEqual(bouncy);
  });
});
