/**
 * Data catalog types. Definitions are declarative data — combat (Slice 2.1) and the
 * surface item projection (Slice 3.3) interpret them; nothing in data/ executes.
 *
 * Canonical id scheme: kebab-case with a type prefix — `hull-scout`,
 * `mod-light-laser`, `card-laser-burst`. Clone Bay matrices are modules with
 * slot `clone-bay`.
 */

export type CardId = string;
export type ModuleId = string;
export type HullId = string;

export type CardEffect =
  | { kind: 'damage'; amount: number; piercing?: boolean }
  | { kind: 'travel'; amount: number }
  | { kind: 'restore-shield-layer'; count: number }
  | { kind: 'temp-shield-layer'; count: number }
  | { kind: 'dodge-chance'; chance: number }
  | { kind: 'untargetable'; turns: number }
  | { kind: 'buff-next-attack'; bonus: number }
  | { kind: 'amplify-next-attack'; multiplier: number }
  | { kind: 'debuff-target-vulnerable'; amount: number }
  | { kind: 'strip-armor' }
  | { kind: 'reveal-intent' }
  | { kind: 'draw'; count: number }
  | { kind: 'gain-scrap'; amount: number }
  | { kind: 'retain-cards'; count: number }
  | { kind: 'repair-all-modules' };

export interface CardDef {
  id: CardId;
  name: string;
  apCost: number;
  effects: CardEffect[];
  exhaust?: boolean;
}

export type ModuleSlot = 'weapon' | 'utility' | 'engine' | 'clone-bay';

export type ModulePassive = {
  kind: 'shield-layers';
  layers: number;
  rechargeTurns: number;
};

/** Inert metadata until Slice 3.3 — recorded so the catalog mirrors GDD §5.8. */
export interface PlanetItem {
  name: string;
  description: string;
}

export interface ModuleTier {
  /** 1–4 entries (GDD §5.3); duplicates are copies. */
  cards: CardId[];
  passive?: ModulePassive;
  planetItem?: PlanetItem;
}

export interface ModuleDef {
  id: ModuleId;
  name: string;
  slot: ModuleSlot;
  tiers: {
    mk1: ModuleTier;
    /** Absent where the GDD says TBD. */
    mk2?: ModuleTier;
  };
}

export type EnemyId = string;

/**
 * One telegraphed enemy action. A union of one for now — open for later archetypes:
 * module targeting (2.3), travel anchoring (2.4), infestation injection (2.5).
 */
export type EnemyIntentDef = {
  kind: 'attack';
  name: string;
  amount: number;
  /** Hits resolve one at a time — each interacts with shield layers separately (GDD §5.2). */
  hits?: number;
  piercing?: boolean;
};

export interface EnemyDef {
  id: EnemyId;
  name: string;
  archetype: string;
  maxHp: number;
  /** 'cycle' walks intents in order; 'random' picks each turn via the combat RNG stream. */
  pattern: 'cycle' | 'random';
  intents: EnemyIntentDef[];
}

export interface InnateAbility {
  id: string;
  name: string;
  description: string;
}

export interface HullDef {
  id: HullId;
  name: string;
  /** Every hull additionally has exactly 1 clone-bay slot (GDD §4.1). */
  slots: { weapon: number; utility: number; engine: number };
  startingModules: ModuleId[];
  innateAbility: InnateAbility;
  playstyle: string;
}
