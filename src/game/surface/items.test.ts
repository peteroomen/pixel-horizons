import { describe, expect, it } from 'vitest';

import { getHull } from '@/game/data';
import type { ModuleInstance } from '@/game/data';
import { BACKPACK_CAPACITY, POD_WINDOW_PER_ENGINE_MS } from '@/game/data/surface';
import { moduleIds } from '@/game/sim/deck';
import { BASELINE_CAPABILITIES, projectLoadout } from './items';

const REACTOR = 3;

function mk1(ids: string[]): ModuleInstance[] {
  return moduleIds(ids);
}

function hullLoadout(hullId: string) {
  return projectLoadout(mk1(getHull(hullId).startingModules), REACTOR);
}

describe('projectLoadout — per-hull identities (GDD §6.3)', () => {
  it('Scout: phase dash + stacked double jumps, two engines of pod window', () => {
    const loadout = hullLoadout('hull-scout');
    expect(loadout.capabilities.dash).toEqual({ distancePx: 48, cooldownMs: 1500 });
    expect(loadout.capabilities.maxAirJumps).toBe(2);
    expect(loadout.capabilities.jumpVelocityMultiplier).toBe(1);
    expect(loadout.podWindowBonusMs).toBe(2 * POD_WINDOW_PER_ENGINE_MS);
    expect(loadout.scanner).toBe(false);
    expect(loadout.yieldMultiplier).toBe(1);
  });

  it('Gunship: fights well, barely jumps — no traversal items, no engine window', () => {
    const loadout = hullLoadout('hull-gunship');
    expect(loadout.capabilities).toEqual({ ...BASELINE_CAPABILITIES, dash: null });
    expect(loadout.podWindowBonusMs).toBe(0);
    expect(loadout.shieldBubble).toEqual({ cooldownMs: 30_000 });
    expect(loadout.backpackCapacity).toBe(BACKPACK_CAPACITY);
  });

  it('Freighter: 2× mining, scanner, high jump, reinforced backpack', () => {
    const loadout = hullLoadout('hull-freighter');
    expect(loadout.yieldMultiplier).toBe(2);
    expect(loadout.scanner).toBe(true);
    expect(loadout.capabilities.jumpVelocityMultiplier).toBe(1.25);
    expect(loadout.capabilities.maxAirJumps).toBe(0);
    expect(loadout.backpackCapacity).toBe(BACKPACK_CAPACITY + 10);
    expect(loadout.podWindowBonusMs).toBe(POD_WINDOW_PER_ENGINE_MS);
  });

  it('Tactical: bubble + scanner + double jump, exactly at the reactor cap', () => {
    const loadout = hullLoadout('hull-tactical');
    const equipped = loadout.items.filter((i) => !i.chassis);
    expect(equipped).toHaveLength(3);
    expect(equipped.every((i) => i.active)).toBe(true);
    expect(loadout.capabilities.maxAirJumps).toBe(1);
    expect(loadout.scanner).toBe(true);
  });
});

describe('projectLoadout — reactor item cap (GDD §4.3)', () => {
  const FOUR_ITEM_MODULES = [
    'mod-thruster',
    'mod-phase-shifter',
    'mod-shield-generator',
    'mod-cargo-scanner',
  ];

  it('caps active items at reactor level in install order', () => {
    const loadout = projectLoadout(mk1(FOUR_ITEM_MODULES), 2);
    expect(loadout.items.map((i) => i.active)).toEqual([true, true, false, false]);
  });

  it('inactive items contribute no effects', () => {
    const loadout = projectLoadout(mk1(FOUR_ITEM_MODULES), 2);
    expect(loadout.scanner).toBe(false);
    expect(loadout.shieldBubble).toBeNull();
    expect(loadout.capabilities.dash).not.toBeNull();
  });

  it('itemless modules do not consume cap slots', () => {
    // Autocannon has no planet item — the scanner behind it must still equip.
    const loadout = projectLoadout(mk1(['mod-thruster', 'mod-autocannon', 'mod-cargo-scanner']), 2);
    expect(loadout.scanner).toBe(true);
    expect(loadout.items).toHaveLength(2);
  });

  it('chassis items bypass the cap and stay active', () => {
    const loadout = projectLoadout(mk1([...FOUR_ITEM_MODULES, 'mod-scavenger-matrix']), 1);
    const chassis = loadout.items.find((i) => i.chassis);
    expect(chassis?.active).toBe(true);
    expect(loadout.yieldMultiplier).toBeCloseTo(1.15);
  });
});

describe('projectLoadout — effect combination', () => {
  it('mining multipliers and yield bonuses combine multiplicatively', () => {
    const loadout = projectLoadout(mk1(['mod-mining-laser', 'mod-scavenger-matrix']), REACTOR);
    expect(loadout.yieldMultiplier).toBeCloseTo(2.3);
  });

  it('enforcer matrix slows the clone', () => {
    const loadout = projectLoadout(mk1(['mod-enforcer-matrix']), REACTOR);
    expect(loadout.capabilities.moveSpeedMultiplier).toBeCloseTo(0.9);
  });

  it('no modules projects the bare clone', () => {
    const loadout = projectLoadout([], REACTOR);
    expect(loadout.items).toEqual([]);
    expect(loadout.capabilities).toEqual(BASELINE_CAPABILITIES);
    expect(loadout.yieldMultiplier).toBe(1);
    expect(loadout.backpackCapacity).toBe(BACKPACK_CAPACITY);
    expect(loadout.podWindowBonusMs).toBe(0);
  });
});
