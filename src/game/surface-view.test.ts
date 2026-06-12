import { describe, expect, it } from 'vitest';

import { POD_WARNING_MS } from '@/game/data/surface';
import { buildSurfaceView, surfaceViewEquals } from './surface-view';
import { createSurface } from './surface/surface';

const POD_LEVEL = ['#######', '#PD...#', '#.....#', '#######'];
const NO_POD_LEVEL = ['#######', '#P....#', '#.....#', '#######'];

describe('buildSurfaceView', () => {
  it('rounds pod seconds up so the full window shows immediately', () => {
    const state = createSurface(POD_LEVEL, { podWindowMs: 300_000 });
    if (state.pod === null) throw new Error('expected pod');
    state.pod.remainingMs = 299_001;
    expect(buildSurfaceView(state).podSecondsLeft).toBe(300);
  });

  it('flags the warning window from POD_WARNING_MS', () => {
    const state = createSurface(POD_LEVEL, { podWindowMs: 300_000 });
    if (state.pod === null) throw new Error('expected pod');
    state.pod.remainingMs = POD_WARNING_MS + 1;
    expect(buildSurfaceView(state).podWarning).toBe(false);
    state.pod.remainingMs = POD_WARNING_MS;
    expect(buildSurfaceView(state).podWarning).toBe(true);
  });

  it('handles pod-less levels with null timer fields', () => {
    const view = buildSurfaceView(createSurface(NO_POD_LEVEL));
    expect(view.podSecondsLeft).toBeNull();
    expect(view.podWindowSeconds).toBeNull();
    expect(view.podWarning).toBe(false);
  });

  it('copies Resources — mutating the view does not touch sim state', () => {
    const state = createSurface(POD_LEVEL);
    const view = buildSurfaceView(state);
    view.backpack.scrap = 99;
    view.deposited.biominerals = 99;
    expect(state.clone.backpack.scrap).toBe(0);
    expect(state.pod?.deposited.biominerals).toBe(0);
  });
});

describe('surfaceViewEquals', () => {
  it('is true for two builds of unchanged state and false after a change', () => {
    const state = createSurface(POD_LEVEL, { podWindowMs: 10_000 });
    const a = buildSurfaceView(state);
    const b = buildSurfaceView(state);
    expect(surfaceViewEquals(a, b)).toBe(true);

    state.clone.backpack.biominerals = 2;
    expect(surfaceViewEquals(a, buildSurfaceView(state))).toBe(false);
  });

  it('detects timer, outcome, and lostBackpack changes', () => {
    const state = createSurface(POD_LEVEL, { podWindowMs: 10_000 });
    const a = buildSurfaceView(state);
    if (state.pod === null) throw new Error('expected pod');

    state.pod.remainingMs = 8_900; // 10 → 9 displayed seconds
    const b = buildSurfaceView(state);
    expect(surfaceViewEquals(a, b)).toBe(false);

    state.outcome = 'stranded';
    state.lostBackpack = { scrap: 1, biominerals: 0, coreCrystals: 0, blueprints: 0 };
    const c = buildSurfaceView(state);
    expect(surfaceViewEquals(b, c)).toBe(false);
    expect(surfaceViewEquals(c, buildSurfaceView(state))).toBe(true);
  });
});
