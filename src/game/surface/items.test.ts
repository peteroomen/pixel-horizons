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

describe('projectLoadout — tier 2 items', () => {
  it('Mining Laser Mk II projects 2× yield + deposit scanner', () => {
    const loadout = projectLoadout([{ id: 'mod-mining-laser', tier: 2 }], REACTOR);
    expect(loadout.yieldMultiplier).toBe(2);
    expect(loadout.scanner).toBe(true);
  });

  it('Thruster Mk II keeps double jump and adds high jump', () => {
    const loadout = projectLoadout([{ id: 'mod-thruster', tier: 2 }], REACTOR);
    expect(loadout.capabilities.maxAirJumps).toBe(1);
    expect(loadout.capabilities.jumpVelocityMultiplier).toBe(1.15);
  });

  it('Phase Shifter Mk II has a stronger dash (longer range, shorter cooldown)', () => {
    const mk1 = projectLoadout([{ id: 'mod-phase-shifter', tier: 1 }], REACTOR);
    const mk2 = projectLoadout([{ id: 'mod-phase-shifter', tier: 2 }], REACTOR);
    expect(mk2.capabilities.dash).toEqual({ distancePx: 64, cooldownMs: 1200 });
    expect(mk2.capabilities.dash!.distancePx).toBeGreaterThan(mk1.capabilities.dash!.distancePx);
  });

  it('tier 2 falls back to mk1 item when mk2 has no planet item', () => {
    const mk1 = projectLoadout([{ id: 'mod-cargo-scanner', tier: 1 }], REACTOR);
    const mk2 = projectLoadout([{ id: 'mod-cargo-scanner', tier: 2 }], REACTOR);
    expect(mk2.scanner).toBe(true);
    expect(mk2.items[0].name).toBe(mk1.items[0].name);
  });

  it('an upgrade never loses a working effect', () => {
    const mk1 = projectLoadout([{ id: 'mod-mining-laser', tier: 1 }], REACTOR);
    const mk2 = projectLoadout([{ id: 'mod-mining-laser', tier: 2 }], REACTOR);
    expect(mk2.yieldMultiplier).toBeGreaterThanOrEqual(mk1.yieldMultiplier);
  });
});

describe('projectLoadout — clone matrix combat stats (GDD §6.3)', () => {
  it('baseline clone (no modules) is 3 HP, 1 melee, no regen', () => {
    const { capabilities } = projectLoadout([], 0);
    expect(capabilities.maxHp).toBe(3);
    expect(capabilities.meleeDamage).toBe(1);
    expect(capabilities.regenMsPerHp).toBeNull();
  });

  it('Standard Print Matrix sets 3 HP (chassis — active even at reactor 0)', () => {
    const { capabilities } = projectLoadout([{ id: 'mod-standard-print-matrix', tier: 1 }], 0);
    expect(capabilities.maxHp).toBe(3);
  });

  it('Scavenger Matrix is a 2-HP chassis', () => {
    const { capabilities } = projectLoadout([{ id: 'mod-scavenger-matrix', tier: 1 }], 0);
    expect(capabilities.maxHp).toBe(2);
  });

  it('Enforcer Matrix is 2 HP with +1 melee', () => {
    const { capabilities } = projectLoadout([{ id: 'mod-enforcer-matrix', tier: 1 }], 0);
    expect(capabilities.maxHp).toBe(2);
    expect(capabilities.meleeDamage).toBe(2);
  });

  it('Repair Matrix carries a self-heal cadence', () => {
    const { capabilities } = projectLoadout([{ id: 'mod-repair-matrix', tier: 1 }], 0);
    expect(capabilities.regenMsPerHp).toBeGreaterThan(0);
  });
});
