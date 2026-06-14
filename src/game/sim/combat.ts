import { getCard, getEnemy, getHull, getModule, HAND_SIZE, MALFUNCTION_REPAIR_AP } from '../data';
import type {
  CardEffect,
  EnemyDef,
  EnemyId,
  EnemyIntentDef,
  HullId,
  ModuleId,
  ModuleTargeting,
} from '../data';
import { generateCombatDeck } from './deck';
import type { CombatCard } from './deck';
import { restoreRng } from './rng';
import type { Rng, RngState } from './rng';
import type { RunState } from './run-state';

/**
 * Turn-based combat engine (GDD §5.5): draw 5 → spend AP on data-interpreted card
 * effects → unplayed cards discard → enemy acts on its telegraphed intent → reshuffle
 * discard into draw pile when empty.
 *
 * CombatState is plain JSON, like RunState — a fight serializes mid-turn and continues
 * identically. All randomness (shuffle, dodge rolls, random intents) consumes only the
 * combat RNG stream, carried by value in `CombatState.rng` (ADR 003). `createCombat`
 * does not mutate the RunState it reads; when a fight ends, the caller (2.2/2.4) commits
 * `CombatState.rng` back to `runState.rng.combat` — and hull HP / scrap likewise — so
 * consecutive fights continue the stream instead of replaying it.
 *
 * Malfunctions (GDD §5.6): per-card-instance state — `CombatCard.malfunctioning`. A hit
 * flags *every* card instance of the targeted module across all piles; playing one card
 * clears only that instance, so a module contributing N cards is a genuine N-play repair
 * tax (the module's planet item stays offline until every instance clears). A module is
 * "operational" (a valid re-target) only when none of its instances are flagged. Within
 * a lane the malfunction set persists between fights as module indices (per-card flags
 * can't survive deck regeneration): `createCombat` re-flags this fight's fresh instances
 * from the LaneContext and the orchestrator derives the set back out via
 * `malfunctioningModules`; arrival clears them (systems reset).
 *
 * Lanes (GDD §5.1): a fight created with a LaneContext gains travel — +1 progress per
 * survived turn plus engine card effects — and ends as 'escaped' the moment total lane
 * progress reaches the distance. Anchor enemies (§5.7) halt all travel while alive;
 * `payToll` is the other way past them.
 *
 * Invalid actions (bad hand index, unaffordable card, acting after the fight ended)
 * throw — same loud-failure policy as the data lookups; the UI's job is to never offer
 * an illegal play.
 */

export interface ShieldLayer {
  /** Enemy phases a spent layer stays down (from the granting module's passive). */
  rechargeTurns: number;
  /** 0 = layer is up; counts down once per enemy phase after the one that spent it. */
  turnsUntilUp: number;
}

export interface CombatModifiers {
  /** Flat bonus consumed by the next damage effect (Lock-On, Charge Capacitor…). */
  nextAttackBonus: number;
  /** Multiplier consumed by the next damage effect (Overcharge). */
  nextAttackMultiplier: number;
  /** Extra damage the enemy takes per hit, rest of the fight (Tracer Lock). */
  enemyVulnerable: number;
  /** Chance each incoming hit misses; covers one enemy phase, then resets. */
  dodgeChance: number;
  /** Enemy attacks auto-miss while > 0; ticks down once per enemy phase. */
  untargetableTurns: number;
  /** Deep Scan — the already-rolled intent is exposed to the UI this turn. */
  intentRevealed: boolean;
}

/** 'escaped' = the encounter ended without a kill: arrival in realspace or a paid toll. */
export type CombatOutcome = 'ongoing' | 'victory' | 'defeat' | 'escaped';

/**
 * The lane snapshot a fight needs, frozen at combat start like `modules` — combat
 * never mutates the lane struct itself; the orchestrator commits results back.
 */
export interface LaneContext {
  distance: number;
  progressAtStart: number;
  /** Module indices still malfunctioning from earlier fights in this lane (GDD §5.6). */
  malfunctioning: number[];
}

export interface CombatState {
  enemyId: EnemyId;
  enemyHp: number;
  /**
   * Bulwark armor pool (GDD §5.7): absorbs non-piercing damage before HP, regrows at
   * the end of each enemy phase. 0 for enemies without armor.
   */
  enemyArmor: number;
  /** Organ HP, parallel to the enemy's `parts` (GDD §5.4); [] for enemies without organs. */
  partHp: number[];
  /** Single-target selection: null = the core, else an index into `parts`. */
  targetPart: number | null;
  /** Set when the Armor-Node is destroyed — armor stays 0 and stops regrowing. */
  armorBroken: boolean;
  /** Set by an organ's `stagger` on-destroy — the enemy skips its next action. */
  staggered: boolean;
  /** Index into the enemy's intent list — the telegraphed action for its next phase. */
  intentIndex: number;
  hullId: HullId;
  hullHp: number;
  /** The run's module list frozen at combat start (refits take effect next combat, §5.3). */
  modules: ModuleId[];
  shields: ShieldLayer[];
  /** One-shot layers (Emergency Barrier, Cargo Thrust) — absorbed first, never recharge. */
  tempShieldLayers: number;
  ap: number;
  apPerTurn: number;
  /** Per-turn innate (Slipstream, Point-Defense) spent; resets each enemy phase. */
  innateUsedThisTurn: boolean;
  /** Per-combat innate (Auxiliary Router) spent; never resets. */
  innateUsedThisCombat: boolean;
  turn: number;
  drawPile: CombatCard[];
  hand: CombatCard[];
  discardPile: CombatCard[];
  exhaustPile: CombatCard[];
  /** Turns of travel gained this fight: +1 per survived turn plus engine card effects. */
  travelProgress: number;
  /** Null = fight outside a lane (tests): no passive tick, no escape-by-arrival. */
  lane: { distance: number; progressAtStart: number } | null;
  /** Run scrap frozen at combat start — toll affordability is `scrapAtStart + scrapGained`. */
  scrapAtStart: number;
  /** Accumulated here; applied to RunState resources by the caller when the fight ends. */
  scrapGained: number;
  /** Current phase index into the enemy's `phases` array (-1 = base phase). */
  phaseIndex: number;
  modifiers: CombatModifiers;
  rng: RngState;
  outcome: CombatOutcome;
}

export function createCombat(run: RunState, enemyId: EnemyId, lane?: LaneContext): CombatState {
  const enemy = getEnemy(enemyId);
  const rng = restoreRng(run.rng.combat);
  const drawPile = rng.shuffle(generateCombatDeck(run.modules));
  // Re-flag this fight's fresh instances from any malfunctions carried in by the lane.
  if (lane !== undefined) {
    for (const card of drawPile) {
      if (card.moduleIndex !== null && lane.malfunctioning.includes(card.moduleIndex)) {
        card.malfunctioning = true;
      }
    }
  }
  const shields = run.modules.flatMap((mod): ShieldLayer[] => {
    const def = getModule(mod.id);
    const tier = def.tiers[mod.tier === 2 ? 'mk2' : 'mk1'] ?? def.tiers.mk1;
    const passive = tier.passive;
    if (passive === undefined || passive.kind !== 'shield-layers') {
      return [];
    }
    return Array.from({ length: passive.layers }, () => ({
      rechargeTurns: passive.rechargeTurns,
      turnsUntilUp: 0,
    }));
  });

  const state: CombatState = {
    enemyId,
    enemyHp: enemy.maxHp,
    enemyArmor: enemy.armor?.amount ?? 0,
    partHp: enemy.parts?.map((p) => p.maxHp) ?? [],
    targetPart: null,
    armorBroken: false,
    staggered: false,
    intentIndex: enemy.pattern === 'random' ? rng.int(0, enemy.intents.length) : 0,
    hullId: run.hullId,
    hullHp: run.hullHp,
    modules: run.modules.map((m) => m.id),
    shields,
    tempShieldLayers: 0,
    ap: run.reactorLevel,
    apPerTurn: run.reactorLevel,
    innateUsedThisTurn: false,
    innateUsedThisCombat: false,
    turn: 1,
    drawPile,
    hand: [],
    discardPile: [],
    exhaustPile: [],
    travelProgress: 0,
    lane:
      lane === undefined
        ? null
        : { distance: lane.distance, progressAtStart: lane.progressAtStart },
    scrapAtStart: run.resources.scrap,
    scrapGained: 0,
    phaseIndex: -1,
    modifiers: {
      nextAttackBonus: 0,
      nextAttackMultiplier: 1,
      enemyVulnerable: 0,
      dodgeChance: 0,
      untargetableTurns: 0,
      intentRevealed: false,
    },
    rng: rng.getState(),
    outcome: 'ongoing',
  };
  drawCards(state, rng, HAND_SIZE);
  state.rng = rng.getState();
  return state;
}

/** Whether this card instance currently presents as its Malfunction form (GDD §5.6). */
export function isCardMalfunctioning(card: CombatCard): boolean {
  return card.malfunctioning;
}

/** Every card instance across all four piles — the malfunction state lives here now. */
function allCombatCards(state: CombatState): CombatCard[] {
  return [...state.drawPile, ...state.hand, ...state.discardPile, ...state.exhaustPile];
}

/**
 * Whether any instance of this module is currently flagged — i.e. the module is *not*
 * fully operational. A module is a valid malfunction re-target only when this is false,
 * and its planet item stays offline (3.3) until it is.
 */
export function isModuleMalfunctioning(state: CombatState, moduleIndex: number): boolean {
  return allCombatCards(state).some((c) => c.moduleIndex === moduleIndex && c.malfunctioning);
}

/**
 * The module indices with at least one flagged instance, sorted ascending — the
 * cross-fight representation the lane carries between encounters (GDD §5.6).
 */
export function malfunctioningModules(state: CombatState): number[] {
  const set = new Set<number>();
  for (const card of allCombatCards(state)) {
    if (card.malfunctioning && card.moduleIndex !== null) {
      set.add(card.moduleIndex);
    }
  }
  return [...set].sort((a, b) => a - b);
}

/** Flags every card instance of a module across all piles — the whole module goes down. */
function flagModule(state: CombatState, moduleIndex: number): void {
  for (const card of allCombatCards(state)) {
    if (card.moduleIndex === moduleIndex) {
      card.malfunctioning = true;
    }
  }
}

/**
 * Travel is halted while an anchor enemy lives (GDD §5.7) — the passive tick and
 * `travel` card effects do nothing. Engine cards stay playable; learning they're
 * wasted against a Blockade is the counterplay signal.
 */
export function isTravelAnchored(state: CombatState): boolean {
  return getEnemy(state.enemyId).anchor !== undefined && state.enemyHp > 0;
}

/** Arrival ends everything (GDD §5.1): drop to realspace, encounter over, no kill rewards. */
function checkArrival(state: CombatState): void {
  if (
    state.lane !== null &&
    state.lane.progressAtStart + state.travelProgress >= state.lane.distance
  ) {
    state.outcome = 'escaped';
  }
}

/**
 * Pays the Anchormaw's Scrap toll (GDD §5.7) — the blockade lets you pass: the
 * encounter ends as 'escaped', no victory rewards, and the toll lands as a negative
 * `scrapGained` delta for `applyCombatResult` to commit.
 */
export function payToll(state: CombatState): void {
  if (state.outcome !== 'ongoing') {
    throw new Error('combat already ended');
  }
  const anchor = getEnemy(state.enemyId).anchor;
  if (anchor === undefined) {
    throw new Error(`${state.enemyId} does not anchor the lane`);
  }
  if (anchor.tollScrap > state.scrapAtStart + state.scrapGained) {
    throw new Error(
      `cannot afford toll: costs ${anchor.tollScrap} scrap, have ${state.scrapAtStart + state.scrapGained}`,
    );
  }
  state.scrapGained -= anchor.tollScrap;
  state.outcome = 'escaped';
}

/** Whether the toll button should be offered at all right now (mirrors payToll's guards). */
export function canPayToll(state: CombatState): boolean {
  if (state.outcome !== 'ongoing') {
    return false;
  }
  const anchor = getEnemy(state.enemyId).anchor;
  return anchor !== undefined && anchor.tollScrap <= state.scrapAtStart + state.scrapGained;
}

/** The AP this card costs to play right now — the repair cost while flipped. */
export function cardPlayCost(_state: CombatState, card: CombatCard): number {
  if (isCardMalfunctioning(card)) {
    return MALFUNCTION_REPAIR_AP;
  }
  // Module modifiers (GDD §6.6) shave AP off this instance, floored at 0.
  return Math.max(0, getCard(card.cardId).apCost - (card.apCostDelta ?? 0));
}

/** Unplayable cards (Infestations, §5.6) clog the hand until the discard step. */
export function isCardPlayable(card: CombatCard): boolean {
  return getCard(card.cardId).unplayable !== true;
}

/**
 * The Discard keyword's cost (GDD §5.9): N other cards this card discards from hand as
 * it plays. Always 0 for a malfunctioning instance — repairing it has no extra cost.
 */
export function cardDiscardCost(card: CombatCard): number {
  return isCardMalfunctioning(card) ? 0 : (getCard(card.cardId).discardCost ?? 0);
}

/** Whether this card can be Jettisoned right now (GDD §5.9) — never while malfunctioning. */
export function isCardJettisonable(card: CombatCard): boolean {
  return !isCardMalfunctioning(card) && getCard(card.cardId).jettison !== undefined;
}

/**
 * Plays the card at `handIndex`. `discardIndices` supplies the other-card targets for a
 * Discard-keyword card (GDD §5.9); it must list exactly `cardDiscardCost` distinct hand
 * indices, none equal to `handIndex`. The UI resolves the selection; the sim validates it.
 */
export function playCard(
  state: CombatState,
  handIndex: number,
  discardIndices: readonly number[] = [],
): void {
  if (state.outcome !== 'ongoing') {
    throw new Error('combat already ended');
  }
  if (!Number.isInteger(handIndex) || handIndex < 0 || handIndex >= state.hand.length) {
    throw new Error(`no card at hand index ${handIndex}`);
  }
  const instance = state.hand[handIndex];
  if (!isCardPlayable(instance)) {
    throw new Error(`${instance.cardId} is unplayable`);
  }
  const cost = cardPlayCost(state, instance);
  if (cost > state.ap) {
    throw new Error(`cannot afford ${instance.cardId}: costs ${cost} AP, have ${state.ap}`);
  }

  if (isCardMalfunctioning(instance)) {
    // Play-to-repair (§5.6): no card effects, no discard cost. Only *this* instance
    // clears — sibling cards of the same module stay flagged, so a multi-card module
    // is a multi-play tax.
    state.ap -= cost;
    state.hand.splice(handIndex, 1);
    instance.malfunctioning = false;
    state.discardPile.push(instance);
    return;
  }

  const card = getCard(instance.cardId);
  const discardCost = card.discardCost ?? 0;
  validateDiscardSelection(state, handIndex, discardIndices, discardCost);
  // Resolve the discard targets by reference before any splicing shifts indices.
  const discards = discardIndices.map((i) => state.hand[i]);

  state.ap -= cost;
  state.hand = state.hand.filter((c) => c !== instance && !discards.includes(c));
  state.discardPile.push(...discards);

  const rng = restoreRng(state.rng);
  for (const effect of card.effects) {
    applyEffect(state, rng, effect);
  }
  // Modifier-appended effects (GDD §6.6) fire after the card's own effects.
  for (const effect of instance.bonusEffects ?? []) {
    applyEffect(state, rng, effect);
  }
  (card.exhaust === true ? state.exhaustPile : state.discardPile).push(instance);
  state.rng = rng.getState();

  // An engine card may have ended the fight by arrival mid-play — escape stands.
  if (state.outcome === 'ongoing' && state.enemyHp <= 0) {
    state.outcome = 'victory';
  }
}

function validateDiscardSelection(
  state: CombatState,
  handIndex: number,
  discardIndices: readonly number[],
  discardCost: number,
): void {
  if (discardIndices.length !== discardCost) {
    throw new Error(
      `this card discards exactly ${discardCost} card(s); got ${discardIndices.length}`,
    );
  }
  const seen = new Set<number>();
  for (const i of discardIndices) {
    if (!Number.isInteger(i) || i < 0 || i >= state.hand.length) {
      throw new Error(`no card at discard index ${i}`);
    }
    if (i === handIndex) {
      throw new Error('a card cannot pay its own discard cost');
    }
    if (seen.has(i)) {
      throw new Error(`duplicate discard index ${i}`);
    }
    seen.add(i);
  }
}

/**
 * Jettison (GDD §5.9): discard the card at `handIndex` for its declared benefit (Draw N
 * or +N AP) instead of playing it — costs no AP, the floor that keeps travel cards from
 * being dead at the boss (§5.4). Throws if the card has no Jettison (or is malfunctioning).
 */
export function jettisonCard(state: CombatState, handIndex: number): void {
  if (state.outcome !== 'ongoing') {
    throw new Error('combat already ended');
  }
  if (!Number.isInteger(handIndex) || handIndex < 0 || handIndex >= state.hand.length) {
    throw new Error(`no card at hand index ${handIndex}`);
  }
  const instance = state.hand[handIndex];
  if (!isCardJettisonable(instance)) {
    throw new Error(`${instance.cardId} cannot be jettisoned`);
  }
  const jettison = getCard(instance.cardId).jettison;
  if (jettison === undefined) {
    throw new Error(`${instance.cardId} cannot be jettisoned`);
  }
  state.hand.splice(handIndex, 1);
  state.discardPile.push(instance);
  if (jettison.benefit === 'ap') {
    state.ap += jettison.amount;
  } else {
    const rng = restoreRng(state.rng);
    drawCards(state, rng, jettison.amount);
    state.rng = rng.getState();
  }
}

/**
 * Activates the hull's innate ability (GDD §4.1) — the guaranteed non-dead-hand
 * action. `handIndex` is required only by discard-to-draw (Slipstream). Passive
 * innates (Salvage Rig) are applied by the engine where their kind names, never here.
 * (Named activate-, not use-: a bare `useX()` call trips react-hooks lint at callers.)
 */
export function activateInnate(state: CombatState, handIndex?: number): void {
  if (state.outcome !== 'ongoing') {
    throw new Error('combat already ended');
  }
  const innate = getHull(state.hullId).innateAbility;
  if (innate.uses === 'passive') {
    throw new Error(`${innate.id} is passive and cannot be activated`);
  }
  if (innate.uses === 'per-turn' && state.innateUsedThisTurn) {
    throw new Error(`${innate.id} already used this turn`);
  }
  if (innate.uses === 'per-combat' && state.innateUsedThisCombat) {
    throw new Error(`${innate.id} already used this combat`);
  }

  const effect = innate.effect;
  switch (effect.kind) {
    case 'damage': {
      if (effect.apCost > state.ap) {
        throw new Error(`cannot afford ${innate.id}: costs ${effect.apCost} AP, have ${state.ap}`);
      }
      state.ap -= effect.apCost;
      // Deliberately skips next-attack modifiers — Point-Defense must not eat a
      // Lock-On meant for a weapon card. Vulnerable applies to every hit as printed.
      dealDamageToEnemy(state, effect.amount + state.modifiers.enemyVulnerable, false);
      break;
    }
    case 'discard-to-draw': {
      if (
        handIndex === undefined ||
        !Number.isInteger(handIndex) ||
        handIndex < 0 ||
        handIndex >= state.hand.length
      ) {
        throw new Error(`no card at hand index ${String(handIndex)}`);
      }
      const rng = restoreRng(state.rng);
      const [discarded] = state.hand.splice(handIndex, 1);
      state.discardPile.push(discarded);
      drawCards(state, rng, 1);
      state.rng = rng.getState();
      break;
    }
    case 'gain-ap':
      state.ap += effect.amount;
      break;
    case 'scrap-on-victory':
      // Unreachable while data pairs scrap-on-victory with uses: 'passive'.
      throw new Error(`${innate.id} is passive and cannot be activated`);
    default: {
      const exhaustive: never = effect;
      throw new Error(`unhandled innate effect: ${JSON.stringify(exhaustive)}`);
    }
  }

  if (innate.uses === 'per-turn') {
    state.innateUsedThisTurn = true;
  } else {
    state.innateUsedThisCombat = true;
  }

  if (state.enemyHp <= 0) {
    state.outcome = 'victory';
  }
}

/** Whether the innate button should be offered at all right now (mirrors useInnate's guards). */
export function canUseInnate(state: CombatState): boolean {
  if (state.outcome !== 'ongoing') {
    return false;
  }
  const innate = getHull(state.hullId).innateAbility;
  if (innate.uses === 'passive') {
    return false;
  }
  if (innate.uses === 'per-turn' && state.innateUsedThisTurn) {
    return false;
  }
  if (innate.uses === 'per-combat' && state.innateUsedThisCombat) {
    return false;
  }
  switch (innate.effect.kind) {
    case 'damage':
      return innate.effect.apCost <= state.ap;
    case 'discard-to-draw':
      return state.hand.length > 0;
    default:
      return true;
  }
}

export function endTurn(state: CombatState): void {
  if (state.outcome !== 'ongoing') {
    throw new Error('combat already ended');
  }
  const enemy = getEnemy(state.enemyId);
  const rng = restoreRng(state.rng);

  // Retain keyword (GDD §5.9): cards declaring `retain` survive the discard step and
  // stay in hand; a malfunctioning instance never retains (it presents as a repair card).
  const retained: CombatCard[] = [];
  for (const card of state.hand) {
    if (!card.malfunctioning && getCard(card.cardId).retain === true) {
      retained.push(card);
    } else {
      state.discardPile.push(card);
    }
  }
  state.hand = retained;

  // Snapshot before the attack so a layer spent this phase doesn't also tick this
  // phase — rechargeTurns counts full enemy phases the layer stays down.
  const recharging = state.shields.filter((layer) => layer.turnsUntilUp > 0);
  if (state.staggered) {
    // An organ's stagger (GDD §5.4) costs the enemy this action — but only once.
    state.staggered = false;
  } else {
    resolveEnemyIntent(state, rng, activeIntents(state)[state.intentIndex]);
    if (state.hullHp <= 0) {
      state.outcome = 'defeat';
      state.rng = rng.getState();
      return;
    }
  }
  for (const layer of recharging) {
    layer.turnsUntilUp -= 1;
  }

  // Living organs act after the enemy's main action (GDD §5.4): the Spore-Sac floods.
  applyOrganAbilities(state, rng);

  // Organic armor regrows after the enemy phase (GDD §5.7): chip damage spread
  // across turns is eaten; sustained damage within one turn breaks through.
  // Phase-specific armor overrides the base definition. With an Armor-Node organ
  // (GDD §5.4) the regrow is gated on that organ still living.
  const phaseArmor =
    state.phaseIndex >= 0 && enemy.phases !== undefined
      ? enemy.phases[state.phaseIndex].armor
      : undefined;
  const armor = phaseArmor ?? enemy.armor;
  if (armor !== undefined && (!hasArmorRegenOrgan(state) || hasLivingArmorRegenOrgan(state))) {
    state.enemyArmor = Math.min(armor.amount, state.enemyArmor + armor.regen);
  }

  // A survived full turn is a turn of travel (GDD §5.1) — halted while anchored.
  if (state.lane !== null && !isTravelAnchored(state)) {
    state.travelProgress += 1;
    checkArrival(state);
    if (state.outcome !== 'ongoing') {
      state.rng = rng.getState();
      return;
    }
  }

  state.modifiers.dodgeChance = 0;
  state.modifiers.intentRevealed = false;
  if (state.modifiers.untargetableTurns > 0) {
    state.modifiers.untargetableTurns -= 1;
  }

  rollNextIntent(state, rng, enemy);
  state.turn += 1;
  state.ap = state.apPerTurn;
  state.innateUsedThisTurn = false;
  drawCards(state, rng, HAND_SIZE - state.hand.length);
  state.rng = rng.getState();
}

/** The active intent table — base intents or the current phase's intents. */
function activeIntents(state: CombatState): EnemyIntentDef[] {
  const enemy = getEnemy(state.enemyId);
  if (state.phaseIndex >= 0 && enemy.phases !== undefined) {
    return enemy.phases[state.phaseIndex].intents;
  }
  return enemy.intents;
}

/** The enemy action telegraphed for the upcoming enemy phase (shown by the UI in 2.2). */
export function currentIntent(state: CombatState): EnemyIntentDef {
  return activeIntents(state)[state.intentIndex];
}

/**
 * The rng commit-back contract (see module header): once a fight has ended, fold its
 * results into the RunState so the next fight continues the combat stream instead of
 * replaying it. Mutates `run` in place. Passive victory innates (Salvage Rig) land
 * here — "after every won encounter" is exactly this moment.
 */
/**
 * Roll the enemy's Scrap reward on the combat stream (GDD §6.4). Called once at
 * victory; the rolled amount lands in `scrapGained` so the UI can show it and
 * the commit path folds it into the run like all other Scrap.
 */
export function rollVictoryScrap(state: CombatState): void {
  const reward = getEnemy(state.enemyId).scrapReward;
  const rng = restoreRng(state.rng);
  state.scrapGained += rng.int(reward.min, reward.max + 1);
  state.rng = rng.getState();
}

export function applyCombatResult(run: RunState, state: CombatState): void {
  if (state.outcome === 'ongoing') {
    throw new Error('cannot apply combat result: combat is still ongoing');
  }
  run.rng.combat = state.rng;
  run.hullHp = state.hullHp;
  run.resources.scrap += state.scrapGained;
  const innate = getHull(run.hullId).innateAbility;
  if (state.outcome === 'victory' && innate.effect.kind === 'scrap-on-victory') {
    run.resources.scrap += innate.effect.amount;
  }
}

function applyEffect(state: CombatState, rng: Rng, effect: CardEffect): void {
  switch (effect.kind) {
    case 'damage': {
      // Next-attack modifiers are consumed by the first damage effect, so only the
      // first hit of a multi-hit card benefits; vulnerable applies to every hit.
      const bonus = state.modifiers.nextAttackBonus;
      const multiplier = state.modifiers.nextAttackMultiplier;
      state.modifiers.nextAttackBonus = 0;
      state.modifiers.nextAttackMultiplier = 1;
      const total = (effect.amount + bonus) * multiplier + state.modifiers.enemyVulnerable;
      dealDamageToEnemy(state, total, effect.piercing === true, effect.target === 'all');
      break;
    }
    case 'travel':
      if (!isTravelAnchored(state)) {
        state.travelProgress += effect.amount;
        // Card-driven arrival ends the fight mid-turn — the enemy never gets its
        // phase. That immediacy is the escape payoff of engine cards (GDD §5.1).
        checkArrival(state);
      }
      break;
    case 'restore-shield-layer':
      for (let i = 0; i < effect.count; i++) {
        const down = state.shields.find((layer) => layer.turnsUntilUp > 0);
        if (down === undefined) {
          break;
        }
        down.turnsUntilUp = 0;
      }
      break;
    case 'temp-shield-layer':
      state.tempShieldLayers += effect.count;
      break;
    case 'dodge-chance':
      // Max, not sum — stacked dodge sources don't add up to certainty.
      state.modifiers.dodgeChance = Math.max(state.modifiers.dodgeChance, effect.chance);
      break;
    case 'untargetable':
      state.modifiers.untargetableTurns += effect.turns;
      break;
    case 'buff-next-attack':
      state.modifiers.nextAttackBonus += effect.bonus;
      break;
    case 'amplify-next-attack':
      state.modifiers.nextAttackMultiplier *= effect.multiplier;
      break;
    case 'debuff-target-vulnerable':
      state.modifiers.enemyVulnerable += effect.amount;
      break;
    case 'reveal-intent':
      state.modifiers.intentRevealed = true;
      break;
    case 'draw':
      drawCards(state, rng, effect.count);
      break;
    case 'gain-scrap':
      state.scrapGained += effect.amount;
      break;
    case 'strip-armor':
      // Gone for the rest of the turn — regen brings it back after the enemy phase.
      state.enemyArmor = 0;
      break;
    case 'repair-all-modules':
      // Repair Clone (§4.2) — the alternative to playing each Malfunction card: clears
      // every flagged instance across all piles at once.
      for (const c of allCombatCards(state)) {
        c.malfunctioning = false;
      }
      break;
    default: {
      const exhaustive: never = effect;
      throw new Error(`unhandled card effect: ${JSON.stringify(exhaustive)}`);
    }
  }
}

/** Living organ indices (GDD §5.4) — a valid single-target pick has partHp > 0. */
export function isPartAlive(state: CombatState, partIndex: number): boolean {
  return state.partHp[partIndex] !== undefined && state.partHp[partIndex] > 0;
}

/** Selects the single-target focus: null = core, else a living organ (else a no-op). */
export function selectTarget(state: CombatState, target: number | null): void {
  if (target === null || isPartAlive(state, target)) {
    state.targetPart = target;
  }
}

/**
 * One outgoing hit against the enemy — the single funnel for all player damage
 * (cards and damage innates), mirroring resolveIncomingHit. `cleave` (GDD §5.4) hits the
 * core and every living organ at once; otherwise the hit lands on the selected target
 * (a living organ, else the core). Armor absorbs non-piercing core damage; organs have
 * no armor.
 */
function dealDamageToEnemy(
  state: CombatState,
  amount: number,
  piercing: boolean,
  cleave = false,
): void {
  if (cleave) {
    damageCore(state, amount, piercing);
    const parts = getEnemy(state.enemyId).parts ?? [];
    for (let i = 0; i < parts.length; i++) {
      damagePart(state, i, amount);
    }
    return;
  }
  if (state.targetPart !== null && isPartAlive(state, state.targetPart)) {
    damagePart(state, state.targetPart, amount);
    return;
  }
  damageCore(state, amount, piercing);
}

function damageCore(state: CombatState, amount: number, piercing: boolean): void {
  let remaining = amount;
  if (!piercing) {
    const absorbed = Math.min(state.enemyArmor, remaining);
    state.enemyArmor -= absorbed;
    remaining -= absorbed;
  }
  state.enemyHp = Math.max(0, state.enemyHp - remaining);
  checkPhaseTransition(state);
}

function damagePart(state: CombatState, partIndex: number, amount: number): void {
  if (!isPartAlive(state, partIndex)) return;
  state.partHp[partIndex] = Math.max(0, state.partHp[partIndex] - amount);
  if (state.partHp[partIndex] === 0) {
    onPartDestroyed(state, partIndex);
  }
}

function onPartDestroyed(state: CombatState, partIndex: number): void {
  const part = getEnemy(state.enemyId).parts?.[partIndex];
  if (part?.onDestroy === 'stagger') {
    state.staggered = true;
  } else if (part?.onDestroy === 'break-armor') {
    state.enemyArmor = 0;
    state.armorBroken = true;
  }
  // A destroyed organ can't stay the focus — fall back to the core.
  if (state.targetPart === partIndex) {
    state.targetPart = null;
  }
}

/** Whether the enemy has an Armor-Node organ at all (gates the armor-regrow behavior). */
function hasArmorRegenOrgan(state: CombatState): boolean {
  return (getEnemy(state.enemyId).parts ?? []).some((p) => p.grants.kind === 'armor-regen');
}

/** Whether a living Armor-Node organ is keeping the armor regrowing (GDD §5.4). */
function hasLivingArmorRegenOrgan(state: CombatState): boolean {
  const parts = getEnemy(state.enemyId).parts ?? [];
  return parts.some((p, i) => p.grants.kind === 'armor-regen' && isPartAlive(state, i));
}

/** Per-turn organ pressure (GDD §5.4): each living organ fires its granted ability. */
function applyOrganAbilities(state: CombatState, rng: Rng): void {
  const parts = getEnemy(state.enemyId).parts ?? [];
  parts.forEach((part, i) => {
    if (!isPartAlive(state, i)) return;
    if (part.grants.kind === 'inject-each-turn') {
      for (let n = 0; n < part.grants.count; n++) {
        const position = rng.int(0, state.drawPile.length + 1);
        state.drawPile.splice(position, 0, {
          cardId: part.grants.cardId,
          moduleIndex: null,
          malfunctioning: false,
        });
      }
    }
  });
}

function checkPhaseTransition(state: CombatState): void {
  const enemy = getEnemy(state.enemyId);
  if (enemy.phases === undefined || enemy.maxHp === 0) return;
  const hpFraction = state.enemyHp / enemy.maxHp;
  const nextPhase = state.phaseIndex + 1;
  if (nextPhase >= enemy.phases.length) return;
  const phase = enemy.phases[nextPhase];
  if (hpFraction < phase.belowHpFraction) {
    state.phaseIndex = nextPhase;
    state.intentIndex = 0;
    if (phase.armor !== undefined) {
      state.enemyArmor = phase.armor.amount;
    }
  }
}

function resolveEnemyIntent(state: CombatState, rng: Rng, intent: EnemyIntentDef): void {
  switch (intent.kind) {
    case 'attack': {
      const hits = intent.hits ?? 1;
      for (let i = 0; i < hits && state.hullHp > 0; i++) {
        resolveIncomingHit(state, rng, intent.amount, intent.piercing === true);
      }
      break;
    }
    case 'attack-module':
      resolveIncomingHit(state, rng, intent.amount, intent.piercing === true, intent.targeting);
      break;
    case 'inject':
      // "Into your deck" (§5.6): random draw-pile positions on the combat stream.
      // Not a hit — dodge, untargetable, and shields don't interact.
      for (let i = 0; i < intent.count; i++) {
        const position = rng.int(0, state.drawPile.length + 1);
        state.drawPile.splice(position, 0, {
          cardId: intent.cardId,
          moduleIndex: null,
          malfunctioning: false,
        });
      }
      break;
    default: {
      const exhaustive: never = intent;
      throw new Error(`unhandled enemy intent: ${JSON.stringify(exhaustive)}`);
    }
  }
}

/**
 * One incoming hit against the ship — the single funnel for all enemy damage. A hit
 * that is dodged or absorbed by a layer absorbs everything riding on it, including
 * the malfunction (GDD §5.2); only a hit that reaches the hull marks a module.
 */
function resolveIncomingHit(
  state: CombatState,
  rng: Rng,
  amount: number,
  piercing: boolean,
  moduleTargeting?: ModuleTargeting,
): void {
  if (state.modifiers.untargetableTurns > 0) {
    return;
  }
  if (state.modifiers.dodgeChance > 0 && rng.next() < state.modifiers.dodgeChance) {
    return;
  }
  if (!piercing) {
    if (state.tempShieldLayers > 0) {
      state.tempShieldLayers -= 1;
      return;
    }
    const layer = state.shields.find((l) => l.turnsUntilUp === 0);
    if (layer !== undefined) {
      layer.turnsUntilUp = layer.rechargeTurns;
      return;
    }
  }
  state.hullHp = Math.max(0, state.hullHp - amount);
  if (moduleTargeting !== undefined) {
    const target = pickTargetModule(state, rng, moduleTargeting);
    if (target !== null) {
      flagModule(state, target);
    }
  }
}

/**
 * Picks the module a landed hit malfunctions, among operational modules only — an
 * already-flipped module can't flip twice (§5.2: one damage state). All down → null
 * (plain hull damage). 'highest-value' = most Mk I cards, ties to the lowest index —
 * deterministic, no RNG; 'random' rolls the combat stream.
 */
function pickTargetModule(state: CombatState, rng: Rng, targeting: ModuleTargeting): number | null {
  const operational = state.modules
    .map((_, index) => index)
    .filter((index) => !isModuleMalfunctioning(state, index));
  if (operational.length === 0) {
    return null;
  }
  if (targeting === 'random') {
    return operational[rng.int(0, operational.length)];
  }
  return operational.reduce((best, index) =>
    moduleValue(state.modules[index]) > moduleValue(state.modules[best]) ? index : best,
  );
}

function moduleValue(moduleId: ModuleId): number {
  return getModule(moduleId).tiers.mk1.cards.length;
}

function rollNextIntent(state: CombatState, rng: Rng, enemy: EnemyDef): void {
  const intents = activeIntents(state);
  state.intentIndex =
    enemy.pattern === 'random'
      ? rng.int(0, intents.length)
      : (state.intentIndex + 1) % intents.length;
}

function drawCards(state: CombatState, rng: Rng, count: number): void {
  for (let i = 0; i < count; i++) {
    if (state.drawPile.length === 0) {
      if (state.discardPile.length === 0) {
        return;
      }
      state.drawPile = rng.shuffle(state.discardPile);
      state.discardPile = [];
    }
    const next = state.drawPile.shift();
    if (next === undefined) {
      return;
    }
    state.hand.push(next);
    applyOnDrawEffects(state, next);
  }
}

/**
 * Fires a card's on-draw effects as it enters the hand (Infestations, GDD §5.6).
 * drawCards runs inside endTurn and mid-card `draw` effects, so the OnDrawEffect
 * union is kept draw-free and RNG-free by construction (see data/types.ts).
 */
function applyOnDrawEffects(state: CombatState, card: CombatCard): void {
  const onDraw = getCard(card.cardId).onDraw;
  if (onDraw === undefined) {
    return;
  }
  for (const effect of onDraw) {
    switch (effect.kind) {
      case 'lose-shield-layer':
        for (let i = 0; i < effect.count; i++) {
          if (state.tempShieldLayers > 0) {
            state.tempShieldLayers -= 1;
            continue;
          }
          const layer = state.shields.find((l) => l.turnsUntilUp === 0);
          if (layer === undefined) {
            break;
          }
          layer.turnsUntilUp = layer.rechargeTurns;
        }
        break;
      case 'gain-temp-shield':
        state.tempShieldLayers += effect.count;
        break;
      default: {
        const exhaustive: never = effect;
        throw new Error(`unhandled on-draw effect: ${JSON.stringify(exhaustive)}`);
      }
    }
  }
}
