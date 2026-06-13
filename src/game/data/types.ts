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

/**
 * Effects that fire as a card enters the hand (Infestations, GDD §5.6). A separate,
 * deliberately tiny union — not CardEffect — because drawCards runs inside endTurn
 * *and* mid-card `draw` effects: members must never draw (recursion) and must not
 * consume RNG (re-entrancy).
 */
export type OnDrawEffect = { kind: 'lose-shield-layer'; count: number };

export interface CardDef {
  id: CardId;
  name: string;
  apCost: number;
  effects: CardEffect[];
  exhaust?: boolean;
  /** Hand-clog (Infestations, GDD §5.6): playCard throws, the UI never offers it. */
  unplayable?: true;
  onDraw?: OnDrawEffect[];
}

export type ModuleSlot = 'weapon' | 'utility' | 'engine' | 'clone-bay';

export type ModulePassive = {
  kind: 'shield-layers';
  layers: number;
  rechargeTurns: number;
};

/**
 * One mechanical consequence of a projected planet item (GDD §6.3) — interpreted
 * by surface/items.ts, like card effects are interpreted by combat. Tunable
 * numbers ride on the effect itself: per-item balance is data, not logic.
 */
export type PlanetItemEffect =
  | { kind: 'double-jump' }
  | { kind: 'high-jump'; jumpVelocityMultiplier: number }
  | { kind: 'phase-dash'; distancePx: number; cooldownMs: number }
  | { kind: 'mining-yield'; multiplier: number }
  | { kind: 'yield-bonus'; percent: number }
  | { kind: 'deposit-scanner' }
  | { kind: 'backpack-capacity'; bonus: number }
  /** Projected and shown in the HUD, but mechanically inert until clone damage exists (3.4). */
  | { kind: 'shield-bubble'; cooldownMs: number }
  | { kind: 'move-speed'; multiplier: number };

export interface PlanetItem {
  name: string;
  description: string;
  /** Omitted/empty = flavor only — recorded for the catalog, no projection yet. */
  effects?: PlanetItemEffect[];
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
 * One telegraphed enemy action — open for later archetypes: travel anchoring (2.4),
 * infestation injection (2.5).
 */
export type ModuleTargeting = 'highest-value' | 'random';

export type EnemyIntentDef =
  | {
      kind: 'attack';
      name: string;
      amount: number;
      /** Hits resolve one at a time — each interacts with shield layers separately (GDD §5.2). */
      hits?: number;
      piercing?: boolean;
    }
  | {
      /**
       * A hull hit that also malfunctions a module (GDD §5.2/§5.6). A shield layer that
       * absorbs the hit absorbs the malfunction too. 'highest-value' hunts the
       * operational module contributing the most cards; 'random' rolls the combat stream.
       */
      kind: 'attack-module';
      name: string;
      amount: number;
      piercing?: boolean;
      targeting: ModuleTargeting;
    }
  | {
      /**
       * Scrambler archetypes (GDD §5.6/§5.7): inserts `count` copies of an Infestation
       * card at random draw-pile positions. Not a hit — dodge, untargetable, and
       * shields don't interact; blocking it with defenses would erase the archetype.
       */
      kind: 'inject';
      name: string;
      cardId: CardId;
      count: number;
    };

export interface EnemyDef {
  id: EnemyId;
  name: string;
  archetype: string;
  maxHp: number;
  /** 'cycle' walks intents in order; 'random' picks each turn via the combat RNG stream. */
  pattern: 'cycle' | 'random';
  intents: EnemyIntentDef[];
  /**
   * Blockade archetypes (GDD §5.7): a trait, not an intent — the latch is permanent
   * encounter state. Travel progress is halted while this enemy lives; paying the
   * Scrap toll ends the encounter without victory rewards.
   */
  anchor?: { tollScrap: number };
  /**
   * Bulwark archetypes (GDD §5.7): a damage pool absorbing non-piercing hits before
   * HP, regrowing `regen` (capped at `amount`) at the end of each enemy phase —
   * sustained damage within one turn breaks through, chip across turns is eaten.
   */
  armor?: { amount: number; regen: number };
}

/**
 * Hull innate abilities are interpreted data, like card effects (GDD §4.1): they
 * guarantee a non-dead hand even when every module is malfunctioning. 'passive'
 * effects are never activated through useInnate — the engine applies them at the
 * moment named by their kind.
 */
export type InnateEffect =
  | { kind: 'damage'; apCost: number; amount: number }
  | { kind: 'discard-to-draw' }
  | { kind: 'gain-ap'; amount: number }
  | { kind: 'scrap-on-victory'; amount: number };

export interface InnateAbility {
  id: string;
  name: string;
  description: string;
  uses: 'per-turn' | 'per-combat' | 'passive';
  effect: InnateEffect;
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
