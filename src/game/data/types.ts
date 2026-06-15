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

export type ModuleTierLevel = 1 | 2;

export type ModifierId = string;

export type StatusId = string;

export interface ModuleInstance {
  id: ModuleId;
  tier: ModuleTierLevel;
  /** Attach-to-module modifiers (GDD §6.6) — events bolt these on; deck-gen applies them. */
  modifiers?: ModifierId[];
}

export type CardEffect =
  | {
      kind: 'damage';
      amount: number;
      piercing?: boolean;
      /** Cleave (GDD §5.4): 'all' hits the core and every living organ; default 'core'. */
      target?: 'core' | 'all';
    }
  | { kind: 'travel'; amount: number }
  | { kind: 'restore-shield-layer'; count: number }
  | { kind: 'temp-shield-layer'; count: number }
  | { kind: 'dodge-chance'; chance: number }
  | { kind: 'untargetable'; turns: number }
  /**
   * Apply a Power/status (GDD §5.10, ADR 008). `to: 'self'` → ship; `to: 'target'` →
   * the focused enemy organ, else the core. Replaces the old next-attack/vulnerable
   * effect kinds — those are now the `status-charged`/`-overcharged`/`-marked` statuses.
   */
  | { kind: 'apply-status'; status: StatusId; magnitude: number; to: 'self' | 'target' }
  | { kind: 'strip-armor' }
  | { kind: 'reveal-intent' }
  | { kind: 'draw'; count: number }
  | { kind: 'gain-scrap'; amount: number }
  | { kind: 'repair-all-modules' };

/**
 * Effects that fire as a card enters the hand (Infestations, GDD §5.6). A separate,
 * deliberately tiny union — not CardEffect — because drawCards runs inside endTurn
 * *and* mid-card `draw` effects: members must never draw (recursion) and must not
 * consume RNG (re-entrancy).
 */
export type OnDrawEffect =
  | { kind: 'lose-shield-layer'; count: number }
  /** Player-positive on-draw (GDD §5.9): a temp shield layer banked as the card enters hand. */
  | { kind: 'gain-temp-shield'; count: number };

export interface CardDef {
  id: CardId;
  name: string;
  apCost: number;
  effects: CardEffect[];
  exhaust?: boolean;
  /** Hand-clog (Infestations, GDD §5.6): playCard throws, the UI never offers it. */
  unplayable?: true;
  onDraw?: OnDrawEffect[];
  /** Retain keyword (GDD §5.9): this card survives the end-of-turn discard, staying in hand. */
  retain?: true;
  /**
   * Jettison keyword (GDD §5.9): instead of playing, discard this card from hand for a
   * small benefit (Draw N or +N AP). Resolves the travel-card-dead-at-boss problem (§5.4).
   */
  jettison?: { benefit: 'draw' | 'ap'; amount: number };
  /** Discard keyword (GDD §5.9): playing this card first discards N other cards as a cost. */
  discardCost?: number;
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

/**
 * A module modifier (GDD §6.6) — an attach-to-module hack that adjusts how the module's
 * cards generate. Interpreted by deck.ts; like every other definition, pure data.
 */
export interface ModifierDef {
  id: ModifierId;
  name: string;
  description: string;
  /** AP shaved off each of the module's cards (floored at 0). */
  apCostReduction?: number;
  /** Effects appended to each of the module's cards when played. */
  bonusEffects?: CardEffect[];
}

export type ResourceKind = 'scrap' | 'biominerals' | 'coreCrystals' | 'blueprints';

/**
 * One consequence of an event choice (GDD §6.6 / §4.4) — interpreted by sim/events.ts.
 * `attach-modifier` needs a target module the player picks; the choice flags that.
 */
export type EventOutcome =
  | { kind: 'gain-resources'; resource: ResourceKind; amount: number }
  | { kind: 'lose-resources'; resource: ResourceKind; amount: number }
  | { kind: 'gain-module-to-cargo'; moduleId: ModuleId }
  | { kind: 'repair-hull'; amount: number }
  | { kind: 'damage-hull'; amount: number }
  | { kind: 'attach-modifier'; modifierId: ModifierId }
  | { kind: 'nothing' };

export interface EventChoice {
  label: string;
  description: string;
  outcomes: EventOutcome[];
  /** True when an outcome (attach-modifier) needs the player to pick an installed module. */
  requiresModuleTarget?: boolean;
}

export interface EventDef {
  id: string;
  title: string;
  body: string;
  choices: EventChoice[];
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

/**
 * A targetable boss organ (GDD §5.4) — a sub-part with its own HP that grants the enemy
 * a per-turn pressure ability while alive and a one-shot consequence when destroyed. The
 * core is killable any time; organs are pressure, not a gate. Bosses/elites only.
 */
export type PartAbility =
  | { kind: 'inject-each-turn'; cardId: CardId; count: number }
  | { kind: 'armor-regen' };

export type PartOnDestroy = 'stagger' | 'break-armor';

export interface EnemyPart {
  id: string;
  name: string;
  maxHp: number;
  grants: PartAbility;
  onDestroy?: PartOnDestroy;
}

export interface EnemyDef {
  id: EnemyId;
  name: string;
  archetype: string;
  maxHp: number;
  /** 'cycle' walks intents in order; 'random' picks each turn via the combat RNG stream. */
  pattern: 'cycle' | 'random';
  intents: EnemyIntentDef[];
  /**
   * Scrap dropped on victory (GDD §6.4): rolled on the combat stream within the
   * [min, max] band. The "minimum Scrap drop" guarantee — every won encounter pays.
   */
  scrapReward: { min: number; max: number };
  /**
   * Multi-phase bosses (GDD §7.5): when HP drops below the threshold, the enemy
   * switches to a new intent table. Phases are checked in order; once entered,
   * a phase is permanent (no re-checking earlier thresholds).
   */
  phases?: EnemyPhase[];
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
  /** Targetable organs (GDD §5.4) — bosses/elites only; default undefined = single-target. */
  parts?: EnemyPart[];
  /**
   * Gate guardians (GDD §7.5): fought only at the sector gate, never rolled as a random
   * lane encounter. Excluded from the default lane pool — the dedicated boss fight
   * (`main.startBossFight`) and the `?enemy=` dev knob still reach them.
   */
  boss?: boolean;
}

export interface EnemyPhase {
  belowHpFraction: number;
  intents: EnemyIntentDef[];
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
