/**
 * Economy tunables (GDD §4.3, §6.4, §7.4, §8.1–8.2). All prices/costs/rates
 * live here — never in transaction logic — so balance passes touch one file.
 */

/** Hull repair: 1 Scrap per 2 HP, bought in fixed-size chunks (§7.4). */
export const REPAIR_HP_PER_CHUNK = 10;
export const REPAIR_SCRAP_COST = 5;

/** Mk II upgrade at the Engineer: Biominerals + Scrap (§8.2). */
export const UPGRADE_BIOMINERAL_COST = 15;
export const UPGRADE_SCRAP_COST = 10;

/** Crafting at the workbench: Blueprint + Biominerals + Scrap (§8.1). */
export const CRAFT_BLUEPRINT_COST = 1;
export const CRAFT_BIOMINERAL_COST = 10;
export const CRAFT_SCRAP_COST = 10;

/** Sell Biominerals at the Merchant: Scrap received per unit (§7.4). */
export const SELL_BIOMINERAL_SCRAP = 2;

/** Base Scrap price per module at the Merchant (§8.1). */
export const MODULE_BASE_PRICE: Record<string, number> = {
  'mod-light-laser': 25,
  'mod-flak-array': 25,
  'mod-kinetic-railgun': 35,
  'mod-mining-laser': 20,
  'mod-missile-pod': 30,
  'mod-autocannon': 20,
  'mod-phase-shifter': 30,
  'mod-shield-generator': 30,
  'mod-cargo-scanner': 20,
  'mod-thruster': 25,
  'mod-hauler-engine': 25,
  'mod-scavenger-matrix': 20,
  'mod-enforcer-matrix': 20,
  'mod-repair-matrix': 25,
  'mod-assault-matrix': 25,
};

/** Fallback price for modules not in the table. */
export const MODULE_DEFAULT_PRICE = 25;

/** Merchant shop: number of module offers per visit. */
export const SHOP_OFFER_COUNT = 4;

/**
 * Modules available in the merchant pool (no clone-bay matrices — those are
 * hull-intrinsic, never sold).
 */
export const SHOP_MODULE_POOL: readonly string[] = [
  'mod-light-laser',
  'mod-flak-array',
  'mod-kinetic-railgun',
  'mod-mining-laser',
  'mod-missile-pod',
  'mod-autocannon',
  'mod-phase-shifter',
  'mod-shield-generator',
  'mod-cargo-scanner',
  'mod-thruster',
  'mod-hauler-engine',
];
