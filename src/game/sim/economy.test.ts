import { describe, expect, it } from 'vitest';

import {
  CRAFT_BIOMINERAL_COST,
  CRAFT_BLUEPRINT_COST,
  CRAFT_SCRAP_COST,
  REPAIR_HP_PER_CHUNK,
  REPAIR_SCRAP_COST,
  SELL_BIOMINERAL_SCRAP,
  UPGRADE_BIOMINERAL_COST,
  UPGRADE_SCRAP_COST,
} from '@/game/data/economy';
import { createRunState, STARTING_HULL_HP } from './run-state';
import {
  buyModule,
  canBuyModule,
  canCraftModule,
  canInstallModule,
  canRepairHull,
  canSellBiominerals,
  canUninstallModule,
  canUpgradeModule,
  canUpgradeReactor,
  craftModule,
  installModule,
  modulePrice,
  repairHull,
  sellBiominerals,
  uninstallModule,
  upgradeModule,
  upgradeReactor,
} from './economy';

function makeRun(overrides: Partial<ReturnType<typeof createRunState>> = {}) {
  const run = createRunState('test-economy');
  return Object.assign(run, overrides);
}

// ── Hull repair ──

describe('repairHull', () => {
  it('restores HP by chunk size and deducts Scrap', () => {
    const run = makeRun({
      hullHp: 80,
      resources: { scrap: 50, biominerals: 0, coreCrystals: 0, blueprints: 0 },
    });
    const result = repairHull(run);
    expect(result).toEqual({ ok: true });
    expect(run.hullHp).toBe(80 + REPAIR_HP_PER_CHUNK);
    expect(run.resources.scrap).toBe(50 - REPAIR_SCRAP_COST);
  });

  it('clamps HP at max hull HP', () => {
    const run = makeRun({
      hullHp: 95,
      resources: { scrap: 50, biominerals: 0, coreCrystals: 0, blueprints: 0 },
    });
    repairHull(run);
    expect(run.hullHp).toBe(STARTING_HULL_HP);
  });

  it('refuses at full HP', () => {
    const run = makeRun({
      resources: { scrap: 50, biominerals: 0, coreCrystals: 0, blueprints: 0 },
    });
    expect(repairHull(run)).toEqual({ ok: false, reason: 'hull-full-hp' });
  });

  it('refuses when cannot afford', () => {
    const run = makeRun({
      hullHp: 50,
      resources: { scrap: 0, biominerals: 0, coreCrystals: 0, blueprints: 0 },
    });
    expect(repairHull(run)).toEqual({ ok: false, reason: 'cannot-afford' });
  });

  it('canRepairHull mirrors repairHull guard', () => {
    const affordable = makeRun({
      hullHp: 50,
      resources: { scrap: 50, biominerals: 0, coreCrystals: 0, blueprints: 0 },
    });
    expect(canRepairHull(affordable)).toBe(true);
    const fullHp = makeRun({
      resources: { scrap: 50, biominerals: 0, coreCrystals: 0, blueprints: 0 },
    });
    expect(canRepairHull(fullHp)).toBe(false);
    const broke = makeRun({
      hullHp: 50,
      resources: { scrap: 0, biominerals: 0, coreCrystals: 0, blueprints: 0 },
    });
    expect(canRepairHull(broke)).toBe(false);
  });
});

// ── Buy module ──

describe('buyModule', () => {
  it('deducts Scrap and installs the module at tier 1', () => {
    const run = makeRun({
      resources: { scrap: 100, biominerals: 0, coreCrystals: 0, blueprints: 0 },
    });
    const before = run.modules.length;
    const price = modulePrice('mod-phase-shifter');
    const result = buyModule(run, 'mod-phase-shifter');
    expect(result).toEqual({ ok: true });
    expect(run.resources.scrap).toBe(100 - price);
    expect(run.modules.length).toBe(before + 1);
    expect(run.modules[run.modules.length - 1]).toEqual({ id: 'mod-phase-shifter', tier: 1 });
  });

  it('refuses when cannot afford', () => {
    const run = makeRun({
      resources: { scrap: 0, biominerals: 0, coreCrystals: 0, blueprints: 0 },
    });
    expect(buyModule(run, 'mod-phase-shifter')).toEqual({ ok: false, reason: 'cannot-afford' });
  });

  it('refuses when slot is full', () => {
    // Scout has 1 weapon slot, starts with mod-light-laser
    const run = makeRun({
      resources: { scrap: 200, biominerals: 0, coreCrystals: 0, blueprints: 0 },
    });
    expect(buyModule(run, 'mod-flak-array')).toEqual({ ok: false, reason: 'slot-full' });
  });

  it('canBuyModule mirrors buyModule guard', () => {
    const run = makeRun({
      resources: { scrap: 200, biominerals: 0, coreCrystals: 0, blueprints: 0 },
    });
    // Scout has 2 utility slots; starts with mod-phase-shifter in one
    expect(canBuyModule(run, 'mod-cargo-scanner')).toBe(true);
    // Weapon slot already full
    expect(canBuyModule(run, 'mod-flak-array')).toBe(false);
  });
});

// ── Sell biominerals ──

describe('sellBiominerals', () => {
  it('converts biominerals to Scrap at the rate', () => {
    const run = makeRun({
      resources: { scrap: 10, biominerals: 20, coreCrystals: 0, blueprints: 0 },
    });
    const result = sellBiominerals(run, 5);
    expect(result).toEqual({ ok: true });
    expect(run.resources.biominerals).toBe(15);
    expect(run.resources.scrap).toBe(10 + 5 * SELL_BIOMINERAL_SCRAP);
  });

  it('refuses with insufficient biominerals', () => {
    const run = makeRun({
      resources: { scrap: 10, biominerals: 2, coreCrystals: 0, blueprints: 0 },
    });
    expect(sellBiominerals(run, 5)).toEqual({ ok: false, reason: 'cannot-afford' });
  });

  it('refuses zero or negative count', () => {
    const run = makeRun({
      resources: { scrap: 10, biominerals: 20, coreCrystals: 0, blueprints: 0 },
    });
    expect(sellBiominerals(run, 0)).toEqual({ ok: false, reason: 'cannot-afford' });
    expect(sellBiominerals(run, -1)).toEqual({ ok: false, reason: 'cannot-afford' });
  });

  it('canSellBiominerals mirrors the guard', () => {
    const run = makeRun({
      resources: { scrap: 0, biominerals: 5, coreCrystals: 0, blueprints: 0 },
    });
    expect(canSellBiominerals(run, 5)).toBe(true);
    expect(canSellBiominerals(run, 6)).toBe(false);
    expect(canSellBiominerals(run, 0)).toBe(false);
  });
});

// ── Upgrade module ──

describe('upgradeModule', () => {
  it('upgrades tier 1 → 2 and deducts resources', () => {
    const run = makeRun({
      resources: {
        scrap: UPGRADE_SCRAP_COST,
        biominerals: UPGRADE_BIOMINERAL_COST,
        coreCrystals: 0,
        blueprints: 0,
      },
    });
    // Find a module that has mk2 defined (mod-phase-shifter does)
    const idx = run.modules.findIndex((m) => m.id === 'mod-phase-shifter');
    expect(idx).toBeGreaterThanOrEqual(0);
    const result = upgradeModule(run, idx);
    expect(result).toEqual({ ok: true });
    expect(run.modules[idx].tier).toBe(2);
    expect(run.resources.scrap).toBe(0);
    expect(run.resources.biominerals).toBe(0);
  });

  it('refuses when already tier 2', () => {
    const run = makeRun({
      resources: { scrap: 100, biominerals: 100, coreCrystals: 0, blueprints: 0 },
    });
    const idx = run.modules.findIndex((m) => m.id === 'mod-phase-shifter');
    run.modules[idx].tier = 2;
    expect(upgradeModule(run, idx)).toEqual({ ok: false, reason: 'already-max-tier' });
  });

  it('refuses when mk2 is not defined', () => {
    const run = makeRun({
      resources: { scrap: 100, biominerals: 100, coreCrystals: 0, blueprints: 0 },
    });
    // mod-standard-print-matrix has no mk2
    const idx = run.modules.findIndex((m) => m.id === 'mod-standard-print-matrix');
    expect(upgradeModule(run, idx)).toEqual({ ok: false, reason: 'no-mk2-defined' });
  });

  it('refuses when cannot afford', () => {
    const run = makeRun({
      resources: { scrap: 0, biominerals: 0, coreCrystals: 0, blueprints: 0 },
    });
    const idx = run.modules.findIndex((m) => m.id === 'mod-phase-shifter');
    expect(upgradeModule(run, idx)).toEqual({ ok: false, reason: 'cannot-afford' });
  });

  it('canUpgradeModule mirrors the guard', () => {
    const run = makeRun({
      resources: {
        scrap: UPGRADE_SCRAP_COST,
        biominerals: UPGRADE_BIOMINERAL_COST,
        coreCrystals: 0,
        blueprints: 0,
      },
    });
    const idx = run.modules.findIndex((m) => m.id === 'mod-phase-shifter');
    expect(canUpgradeModule(run, idx)).toBe(true);
    run.modules[idx].tier = 2;
    expect(canUpgradeModule(run, idx)).toBe(false);
  });
});

// ── Craft module ──

describe('craftModule', () => {
  it('deducts blueprint + biominerals + scrap and installs the module', () => {
    const run = makeRun({
      resources: {
        scrap: CRAFT_SCRAP_COST,
        biominerals: CRAFT_BIOMINERAL_COST,
        coreCrystals: 0,
        blueprints: CRAFT_BLUEPRINT_COST,
      },
    });
    // Scout: utility slot has 1 free (2 total, 1 used by phase-shifter)
    const result = craftModule(run, 'mod-cargo-scanner');
    expect(result).toEqual({ ok: true });
    expect(run.resources.blueprints).toBe(0);
    expect(run.resources.biominerals).toBe(0);
    expect(run.resources.scrap).toBe(0);
    expect(run.modules[run.modules.length - 1]).toEqual({ id: 'mod-cargo-scanner', tier: 1 });
  });

  it('refuses without blueprints', () => {
    const run = makeRun({
      resources: { scrap: 100, biominerals: 100, coreCrystals: 0, blueprints: 0 },
    });
    expect(craftModule(run, 'mod-cargo-scanner')).toEqual({ ok: false, reason: 'cannot-afford' });
  });

  it('refuses when slot full', () => {
    const run = makeRun({
      resources: { scrap: 100, biominerals: 100, coreCrystals: 0, blueprints: 5 },
    });
    // Scout: 1 weapon slot, already full
    expect(craftModule(run, 'mod-flak-array')).toEqual({ ok: false, reason: 'slot-full' });
  });

  it('canCraftModule mirrors the guard', () => {
    const run = makeRun({
      resources: {
        scrap: CRAFT_SCRAP_COST,
        biominerals: CRAFT_BIOMINERAL_COST,
        coreCrystals: 0,
        blueprints: CRAFT_BLUEPRINT_COST,
      },
    });
    expect(canCraftModule(run, 'mod-cargo-scanner')).toBe(true);
    expect(canCraftModule(run, 'mod-flak-array')).toBe(false);
  });
});

// ── Install / uninstall ──

describe('installModule', () => {
  it('moves a module from cargo to installed', () => {
    const run = makeRun();
    run.cargo.push({ id: 'mod-cargo-scanner', tier: 1 });
    const result = installModule(run, 0);
    expect(result).toEqual({ ok: true });
    expect(run.cargo).toHaveLength(0);
    expect(run.modules[run.modules.length - 1]).toEqual({ id: 'mod-cargo-scanner', tier: 1 });
  });

  it('refuses when slot is full', () => {
    const run = makeRun();
    // Scout: 1 weapon slot, already has mod-light-laser
    run.cargo.push({ id: 'mod-flak-array', tier: 1 });
    expect(installModule(run, 0)).toEqual({ ok: false, reason: 'slot-full' });
  });

  it('refuses with invalid cargo index', () => {
    const run = makeRun();
    expect(installModule(run, 99)).toEqual({ ok: false, reason: 'invalid-index' });
  });

  it('canInstallModule mirrors the guard', () => {
    const run = makeRun();
    run.cargo.push({ id: 'mod-cargo-scanner', tier: 1 });
    expect(canInstallModule(run, 0)).toBe(true);
    run.cargo[0] = { id: 'mod-flak-array', tier: 1 };
    expect(canInstallModule(run, 0)).toBe(false);
  });
});

describe('uninstallModule', () => {
  it('moves a module from installed to cargo', () => {
    const run = makeRun();
    const idx = run.modules.findIndex((m) => m.id === 'mod-phase-shifter');
    const mod = run.modules[idx];
    const beforeLen = run.modules.length;
    const result = uninstallModule(run, idx);
    expect(result).toEqual({ ok: true });
    expect(run.modules.length).toBe(beforeLen - 1);
    expect(run.cargo[run.cargo.length - 1]).toEqual(mod);
  });

  it('refuses to uninstall clone-bay modules', () => {
    const run = makeRun();
    const idx = run.modules.findIndex((m) => m.id === 'mod-standard-print-matrix');
    expect(uninstallModule(run, idx)).toEqual({ ok: false, reason: 'not-installed' });
  });

  it('refuses with invalid module index', () => {
    const run = makeRun();
    expect(uninstallModule(run, 99)).toEqual({ ok: false, reason: 'invalid-index' });
  });

  it('canUninstallModule mirrors the guard', () => {
    const run = makeRun();
    const weaponIdx = run.modules.findIndex((m) => m.id === 'mod-light-laser');
    expect(canUninstallModule(run, weaponIdx)).toBe(true);
    const cloneIdx = run.modules.findIndex((m) => m.id === 'mod-standard-print-matrix');
    expect(canUninstallModule(run, cloneIdx)).toBe(false);
  });
});

// ── Reactor upgrade ──

describe('upgradeReactor', () => {
  it('spends a Core Crystal and increments reactor level', () => {
    const run = makeRun({
      resources: { scrap: 0, biominerals: 0, coreCrystals: 1, blueprints: 0 },
    });
    const before = run.reactorLevel;
    const result = upgradeReactor(run);
    expect(result).toEqual({ ok: true });
    expect(run.reactorLevel).toBe(before + 1);
    expect(run.resources.coreCrystals).toBe(0);
  });

  it('refuses without a crystal', () => {
    const run = makeRun({
      resources: { scrap: 0, biominerals: 0, coreCrystals: 0, blueprints: 0 },
    });
    expect(upgradeReactor(run)).toEqual({ ok: false, reason: 'cannot-afford' });
  });

  it('canUpgradeReactor mirrors the guard', () => {
    const run = makeRun({
      resources: { scrap: 0, biominerals: 0, coreCrystals: 1, blueprints: 0 },
    });
    expect(canUpgradeReactor(run)).toBe(true);
    run.resources.coreCrystals = 0;
    expect(canUpgradeReactor(run)).toBe(false);
  });
});

// ── Slot limits per hull ──

describe('slot limits per hull (GDD §4.1)', () => {
  it('Scout: 1 weapon, 2 utility, 2 engine — buying a 2nd weapon refuses', () => {
    const run = makeRun({
      resources: { scrap: 200, biominerals: 0, coreCrystals: 0, blueprints: 0 },
    });
    expect(canBuyModule(run, 'mod-flak-array')).toBe(false); // weapon full
    expect(canBuyModule(run, 'mod-cargo-scanner')).toBe(true); // 1 utility free
  });

  it('Gunship: 3 weapon slots, can buy more weapons', () => {
    const run = createRunState('test-economy', 'hull-gunship');
    run.resources.scrap = 200;
    // Gunship starts with 3 weapons — all full
    expect(canBuyModule(run, 'mod-light-laser')).toBe(false);
  });

  it('installing after uninstalling the same slot type succeeds', () => {
    const run = makeRun({
      resources: { scrap: 200, biominerals: 0, coreCrystals: 0, blueprints: 0 },
    });
    // Scout: 1 weapon full → uninstall → slot free → buy another
    const weaponIdx = run.modules.findIndex((m) => m.id === 'mod-light-laser');
    expect(uninstallModule(run, weaponIdx)).toEqual({ ok: true });
    expect(buyModule(run, 'mod-flak-array')).toEqual({ ok: true });
  });
});
