import { describe, expect, it } from 'vitest';

import { getHull, HULL_DEFS, BASELINE_AP } from '../data';
import {
  createRunState,
  deserializeRunState,
  RNG_STREAMS,
  RUN_STATE_VERSION,
  serializeRunState,
  STARTING_HULL_HP,
} from './run-state';

describe('createRunState', () => {
  it('is deterministic for the same seed', () => {
    expect(createRunState('alpha')).toEqual(createRunState('alpha'));
  });

  it('starts at full hull with empty resources at sector 1', () => {
    const state = createRunState('alpha');
    expect(state.version).toBe(RUN_STATE_VERSION);
    expect(state.hullHp).toBe(STARTING_HULL_HP);
    expect(state.resources).toEqual({ scrap: 0, biominerals: 0, coreCrystals: 0, blueprints: 0 });
    expect(state.position).toEqual({ sector: 1, nodeId: null });
    expect(state.cargo).toEqual([]);
    expect(state.reactorLevel).toBe(BASELINE_AP);
  });

  it("installs the hull's starting modules as tier-1 instances for every hull", () => {
    for (const hull of HULL_DEFS) {
      const state = createRunState('alpha', hull.id);
      const expected = hull.startingModules.map((id) => ({ id, tier: 1 }));
      expect(state.modules, hull.id).toEqual(expected);
    }
  });

  it('copies the starting modules instead of sharing the catalog array', () => {
    const state = createRunState('alpha');
    const catalogModules = getHull('hull-scout').startingModules;
    expect(state.modules.map((m) => m.id)).toEqual(catalogModules);
    expect(state.modules).not.toBe(catalogModules);
  });

  it('throws on an unknown hull id', () => {
    expect(() => createRunState('alpha', 'hull-nope')).toThrow('hull-nope');
  });

  it('seeds an independent rng state per stream', () => {
    const { rng } = createRunState('alpha');
    const states = RNG_STREAMS.map((stream) => rng[stream].state);
    expect(new Set(states).size).toBe(RNG_STREAMS.length);
  });
});

describe('serialize / deserialize round-trip', () => {
  it('round-trips a fresh state losslessly', () => {
    const state = createRunState('round-trip');
    expect(deserializeRunState(serializeRunState(state))).toEqual(state);
  });

  it('round-trips a mutated mid-run state', () => {
    const state = createRunState('mid-run');
    state.hullHp = 42;
    state.resources.scrap = 17;
    state.modules = [
      { id: 'mod-light-laser', tier: 1 },
      { id: 'mod-thruster', tier: 2 },
    ];
    state.cargo = [{ id: 'mod-phase-shifter', tier: 1 }];
    state.reactorLevel = 5;
    state.position = { sector: 2, nodeId: 'node-7' };
    state.rng['combat'].state = 12345;
    expect(deserializeRunState(serializeRunState(state))).toEqual(state);
  });
});

describe('deserializeRunState validation', () => {
  const valid = (): string => serializeRunState(createRunState('victim'));

  it('returns null on corrupt JSON', () => {
    expect(deserializeRunState('not json at all')).toBeNull();
    expect(deserializeRunState(valid().slice(0, 40))).toBeNull();
    expect(deserializeRunState('')).toBeNull();
  });

  it('returns null on non-object payloads', () => {
    expect(deserializeRunState('null')).toBeNull();
    expect(deserializeRunState('[1,2,3]')).toBeNull();
    expect(deserializeRunState('"a string"')).toBeNull();
  });

  it('returns null on a wrong version', () => {
    const tampered = { ...JSON.parse(valid()), version: RUN_STATE_VERSION + 1 };
    expect(deserializeRunState(JSON.stringify(tampered))).toBeNull();
  });

  it('returns null when a field is missing', () => {
    for (const field of [
      'seed',
      'hullId',
      'hullHp',
      'resources',
      'modules',
      'cargo',
      'reactorLevel',
      'position',
      'rng',
    ]) {
      const tampered = JSON.parse(valid());
      delete tampered[field];
      expect(deserializeRunState(JSON.stringify(tampered)), `missing ${field}`).toBeNull();
    }
  });

  it('returns null when a field has the wrong type', () => {
    const cases: Record<string, unknown> = {
      hullHp: 'full',
      modules: [1, 2],
      modules2: 'not-array',
      cargo: 'not-array',
      reactorLevel: 'high',
      resources: { scrap: 'lots' },
      position: { sector: 'one', nodeId: null },
    };
    for (const [field, value] of Object.entries(cases)) {
      const key = field === 'modules2' ? 'modules' : field;
      const tampered = { ...JSON.parse(valid()), [key]: value };
      expect(deserializeRunState(JSON.stringify(tampered)), `bad ${field}`).toBeNull();
    }
  });

  it('returns null for v1 saves (pre-ModuleInstance)', () => {
    const v1 = JSON.parse(valid());
    v1.version = 1;
    v1.modules = ['mod-light-laser', 'mod-thruster'];
    delete v1.cargo;
    delete v1.reactorLevel;
    expect(deserializeRunState(JSON.stringify(v1))).toBeNull();
  });

  it('returns null when an rng stream is missing or malformed', () => {
    const missing = JSON.parse(valid());
    delete missing.rng['combat'];
    expect(deserializeRunState(JSON.stringify(missing))).toBeNull();

    const malformed = JSON.parse(valid());
    malformed.rng['map-gen'] = { seed: 'x', state: 'not-a-number' };
    expect(deserializeRunState(JSON.stringify(malformed))).toBeNull();
  });

  it('drops unknown extra properties instead of carrying them along', () => {
    const padded = { ...JSON.parse(valid()), legacyField: true };
    const result = deserializeRunState(JSON.stringify(padded));
    expect(result).toEqual(createRunState('victim'));
    expect(result).not.toHaveProperty('legacyField');
  });
});
