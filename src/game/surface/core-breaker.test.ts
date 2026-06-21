import { describe, expect, it } from 'vitest';

import {
  type Ball,
  type Peg,
  type ShotInput,
  createPeg,
  defaultConfig,
  pegDef,
  simulateShot,
  spawnBall,
  step,
} from './core-breaker';

const DOWN = Math.PI / 2; // straight down (y-down screen space)

function clonePegs(pegs: Peg[]): Peg[] {
  return pegs.map((p) => ({ ...p }));
}

/** Hand-authored field below the launch point — RNG-free. */
function field(): Peg[] {
  return [
    createPeg(0, 300, 120, 'mineral', 10),
    createPeg(1, 340, 140, 'ore', 10),
    createPeg(2, 320, 180, 'hard', 10),
    createPeg(3, 360, 220, 'mineral', 10),
    createPeg(4, 290, 240, 'crystal', 11),
  ];
}

describe('core-breaker determinism', () => {
  it('same field + same shot ⇒ identical break/drop stream', () => {
    const cfg = defaultConfig();
    const shot: ShotInput = { type: 'standard', angleRad: DOWN + 0.15, power: 320 };
    expect(simulateShot(field(), shot, cfg)).toEqual(simulateShot(field(), shot, cfg));
  });

  it('a scripted multi-shot sequence reproduces exactly', () => {
    const cfg = defaultConfig();
    const shots: ShotInput[] = [
      { type: 'drill', angleRad: DOWN, power: 500 },
      { type: 'standard', angleRad: DOWN + 0.2, power: 300 },
      { type: 'heavy', angleRad: DOWN - 0.1, power: 280 },
    ];
    const runShots = (pegs: Peg[]) => shots.map((s) => simulateShot(pegs, s, cfg));
    expect(runShots(field())).toEqual(runShots(field()));
  });
});

describe('core-breaker peg behaviour', () => {
  it('PEG_DEFS map the §6.7 resources and HP', () => {
    expect(pegDef('mineral')).toEqual({
      maxHits: 1,
      resource: 'biominerals',
      amount: 1,
      dropPerHit: false,
    });
    expect(pegDef('ore')).toEqual({
      maxHits: 3,
      resource: 'biominerals',
      amount: 2,
      dropPerHit: true,
    });
    expect(pegDef('crystal')).toEqual({
      maxHits: 4,
      resource: 'coreCrystals',
      amount: 1,
      dropPerHit: false,
    });
    expect(pegDef('rock')).toEqual({ maxHits: 2, resource: null, amount: 0, dropPerHit: false });
    expect(pegDef('bloom')).toEqual({ maxHits: 99, resource: null, amount: 0, dropPerHit: false });
  });

  it('ghost ball registers exactly one hit per pass (cooldown blocks re-hit)', () => {
    const cfg = defaultConfig();
    // Ghost doesn't deflect, so it passes straight through without bouncing back.
    const ore = [createPeg(0, 320, 120, 'ore', 10)];
    simulateShot(ore, { type: 'ghost', angleRad: DOWN, power: 600 }, cfg);
    expect(ore[0].hits).toBe(2); // 3 → 2, single pass
  });

  it('a mineral peg breaks in one hit and drops biominerals', () => {
    const cfg = defaultConfig();
    const pegs = [createPeg(0, 320, 120, 'mineral', 10)];
    const res = simulateShot(pegs, { type: 'standard', angleRad: DOWN, power: 400 }, cfg);
    expect(res.brokenPegIds).toContain(0);
    expect(res.drops).toEqual([{ pegId: 0, kind: 'mineral', resource: 'biominerals', amount: 1 }]);
  });

  it('an ore peg drops biominerals on every hit and breaks on the third', () => {
    const cfg = defaultConfig();
    const ore = [createPeg(0, 320, 120, 'ore', 10)];
    const shot: ShotInput = { type: 'ghost', angleRad: DOWN, power: 600 };

    const r1 = simulateShot(ore, shot, cfg);
    expect(ore[0].hits).toBe(2);
    expect(r1.drops).toHaveLength(1); // per-hit drop (dropPerHit=true)
    expect(r1.brokenPegIds).not.toContain(0);

    const r2 = simulateShot(ore, shot, cfg);
    expect(ore[0].hits).toBe(1);
    expect(r2.drops).toHaveLength(1);

    const r3 = simulateShot(ore, shot, cfg);
    expect(r3.brokenPegIds).toContain(0);
    expect(r3.drops).toHaveLength(1);
    expect(r3.drops[0]).toMatchObject({ resource: 'biominerals', amount: 2 });
  });

  it('a heavy ball deals 2× damage (breaks a rock in one hit)', () => {
    const cfg = defaultConfig();
    // Rock has maxHits=2; heavy ball deals 2 damage.
    const pegs = [createPeg(0, 320, 120, 'rock', 10)];
    const res = simulateShot(pegs, { type: 'heavy', angleRad: DOWN, power: 400 }, cfg);
    expect(res.brokenPegIds).toContain(0);
  });
});

describe('core-breaker ball-type behaviours', () => {
  it('a ghost ball passes through bloom without being consumed', () => {
    const cfg = defaultConfig();
    const bloom = [createPeg(0, 320, 120, 'bloom', 12)];
    const res = simulateShot(bloom, { type: 'ghost', angleRad: DOWN, power: 400 }, cfg);
    expect(res.end).not.toBe('consumed');
    expect(bloom[0].hits).toBe(99); // ghost does not damage bloom
  });

  it('every non-ghost ball type is consumed by bloom', () => {
    const cfg = defaultConfig();
    for (const type of ['standard', 'heavy', 'split', 'drill'] as const) {
      const bloom = [createPeg(0, 320, 120, 'bloom', 12)];
      const res = simulateShot(bloom, { type, angleRad: DOWN, power: 400 }, cfg);
      expect(res.end).toBe('consumed');
    }
  });

  it('drill ball damages non-rock pegs without deflecting (passes through both)', () => {
    const cfg = defaultConfig();
    // Two minerals stacked vertically — drill bores through both.
    const pegs = [createPeg(0, 320, 100, 'mineral', 10), createPeg(1, 320, 160, 'mineral', 10)];
    const res = simulateShot(pegs, { type: 'drill', angleRad: DOWN, power: 500 }, cfg);
    expect(res.brokenPegIds).toContain(0);
    expect(res.brokenPegIds).toContain(1);
  });

  it('split ball spawns exactly one sibling on first hit; sibling will not fork again', () => {
    const cfg = defaultConfig();
    const pegs = [createPeg(0, 320, 80, 'mineral', 10)];
    const ball = spawnBall({ type: 'split', angleRad: DOWN, power: 300 }, cfg);
    const spawned: Ball[] = [];
    for (let i = 0; i < cfg.maxSteps && ball.live; i++) {
      const ev = step(ball, pegs, cfg, NaN);
      spawned.push(...ev.spawned);
      if (spawned.length > 0) break;
    }
    expect(spawned).toHaveLength(1);
    expect(spawned[0].didSplit).toBe(true);
  });
});

describe('core-breaker shot termination', () => {
  it('settles when speed stays below the rest threshold', () => {
    const cfg = { ...defaultConfig(), gravity: 0 };
    const res = simulateShot([], { type: 'standard', angleRad: DOWN, power: 5 }, cfg);
    expect(res.end).toBe('settled');
  });

  it('ends as fellOut when the ball drops past the floor', () => {
    const cfg = defaultConfig();
    const res = simulateShot([], { type: 'standard', angleRad: DOWN, power: 300 }, cfg);
    expect(res.end).toBe('fellOut');
  });

  it('respects the maxSteps cap (no infinite loop)', () => {
    const cfg = { ...defaultConfig(), gravity: 0, restitution: 1, maxSteps: 400 };
    const res = simulateShot([], { type: 'standard', angleRad: 0, power: 100 }, cfg);
    expect(res.end).toBe('maxSteps');
    expect(res.steps).toBe(400);
  });
});

describe('core-breaker fixed-step solver', () => {
  it('does not tunnel a fast ball through a peg at the default sub-step', () => {
    const cfg = defaultConfig();
    const pegs = [createPeg(0, 320, 164, 'mineral', 10)];
    const res = simulateShot(pegs, { type: 'standard', angleRad: DOWN, power: 2400 }, cfg);
    expect(res.brokenPegIds).toContain(0);
  });

  it('demonstrates why sub-stepping matters: a coarse step tunnels the same shot', () => {
    const cfg = { ...defaultConfig(), step: 1 / 60 };
    const pegs = [createPeg(0, 320, 164, 'mineral', 10)];
    const res = simulateShot(pegs, { type: 'standard', angleRad: DOWN, power: 2400 }, cfg);
    expect(res.brokenPegIds).not.toContain(0);
  });

  it('standard and heavy balls produce distinguishable outcomes on the same field', () => {
    const cfg = defaultConfig();
    const f = field();
    const std = simulateShot(
      clonePegs(f),
      { type: 'standard', angleRad: DOWN + 0.1, power: 350 },
      cfg,
    );
    const heavy = simulateShot(
      clonePegs(f),
      { type: 'heavy', angleRad: DOWN + 0.1, power: 350 },
      cfg,
    );
    expect(std).not.toEqual(heavy);
  });
});
