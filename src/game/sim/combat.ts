import {
  BASELINE_AP,
  getCard,
  getEnemy,
  getHull,
  getModule,
  HAND_SIZE,
  MALFUNCTION_REPAIR_AP,
} from '../data';
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
 * Malfunctions (GDD §5.6): module-level state in `malfunctioning`; a card *presents*
 * as its Malfunction form iff its module index is listed there — flipping is derived,
 * never stored, so the repaired card returning to the discard pile is already back to
 * normal for free. Malfunctions live and die with the CombatState; persistence across
 * encounters within a lane is 2.4's lane work.
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
  /** Cards kept through the next discard step (Desync Hull), leftmost first. */
  retainCount: number;
  /** Deep Scan — the already-rolled intent is exposed to the UI this turn. */
  intentRevealed: boolean;
}

export type CombatOutcome = 'ongoing' | 'victory' | 'defeat';

export interface CombatState {
  enemyId: EnemyId;
  enemyHp: number;
  /** Index into the enemy's intent list — the telegraphed action for its next phase. */
  intentIndex: number;
  hullId: HullId;
  hullHp: number;
  /** The run's module list frozen at combat start (refits take effect next combat, §5.3). */
  modules: ModuleId[];
  /** Indices into `modules` currently malfunctioning — their cards present flipped. */
  malfunctioning: number[];
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
  /** Bare counter until lanes consume it (2.4). */
  travelProgress: number;
  /** Accumulated here; applied to RunState resources by the caller when the fight ends. */
  scrapGained: number;
  modifiers: CombatModifiers;
  rng: RngState;
  outcome: CombatOutcome;
}

export function createCombat(run: RunState, enemyId: EnemyId): CombatState {
  const enemy = getEnemy(enemyId);
  const rng = restoreRng(run.rng.combat);
  const drawPile = rng.shuffle(generateCombatDeck(run.modules));
  const shields = run.modules.flatMap((moduleId): ShieldLayer[] => {
    const passive = getModule(moduleId).tiers.mk1.passive;
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
    intentIndex: enemy.pattern === 'random' ? rng.int(0, enemy.intents.length) : 0,
    hullId: run.hullId,
    hullHp: run.hullHp,
    modules: [...run.modules],
    malfunctioning: [],
    shields,
    tempShieldLayers: 0,
    ap: BASELINE_AP,
    apPerTurn: BASELINE_AP,
    innateUsedThisTurn: false,
    innateUsedThisCombat: false,
    turn: 1,
    drawPile,
    hand: [],
    discardPile: [],
    exhaustPile: [],
    travelProgress: 0,
    scrapGained: 0,
    modifiers: {
      nextAttackBonus: 0,
      nextAttackMultiplier: 1,
      enemyVulnerable: 0,
      dodgeChance: 0,
      untargetableTurns: 0,
      retainCount: 0,
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
export function isCardMalfunctioning(state: CombatState, card: CombatCard): boolean {
  return state.malfunctioning.includes(card.moduleIndex);
}

/** The AP this card costs to play right now — the repair cost while flipped. */
export function cardPlayCost(state: CombatState, card: CombatCard): number {
  return isCardMalfunctioning(state, card) ? MALFUNCTION_REPAIR_AP : getCard(card.cardId).apCost;
}

export function playCard(state: CombatState, handIndex: number): void {
  if (state.outcome !== 'ongoing') {
    throw new Error('combat already ended');
  }
  if (!Number.isInteger(handIndex) || handIndex < 0 || handIndex >= state.hand.length) {
    throw new Error(`no card at hand index ${handIndex}`);
  }
  const instance = state.hand[handIndex];
  const cost = cardPlayCost(state, instance);
  if (cost > state.ap) {
    throw new Error(`cannot afford ${instance.cardId}: costs ${cost} AP, have ${state.ap}`);
  }

  state.ap -= cost;
  state.hand.splice(handIndex, 1);

  if (isCardMalfunctioning(state, instance)) {
    // Play-to-repair (§5.6): no card effects — the module comes back online and the
    // card lands in the discard pile, presenting as its normal form again (derived).
    state.malfunctioning = state.malfunctioning.filter((i) => i !== instance.moduleIndex);
    state.discardPile.push(instance);
    return;
  }

  const card = getCard(instance.cardId);
  const rng = restoreRng(state.rng);
  for (const effect of card.effects) {
    applyEffect(state, rng, effect);
  }
  (card.exhaust === true ? state.exhaustPile : state.discardPile).push(instance);
  state.rng = rng.getState();

  if (state.enemyHp <= 0) {
    state.outcome = 'victory';
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
      state.enemyHp = Math.max(
        0,
        state.enemyHp - (effect.amount + state.modifiers.enemyVulnerable),
      );
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

  const kept = Math.min(state.modifiers.retainCount, state.hand.length);
  state.discardPile.push(...state.hand.splice(kept));
  state.modifiers.retainCount = 0;

  // Snapshot before the attack so a layer spent this phase doesn't also tick this
  // phase — rechargeTurns counts full enemy phases the layer stays down.
  const recharging = state.shields.filter((layer) => layer.turnsUntilUp > 0);
  resolveEnemyIntent(state, rng, enemy.intents[state.intentIndex]);
  if (state.hullHp <= 0) {
    state.outcome = 'defeat';
    state.rng = rng.getState();
    return;
  }
  for (const layer of recharging) {
    layer.turnsUntilUp -= 1;
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

/** The enemy action telegraphed for the upcoming enemy phase (shown by the UI in 2.2). */
export function currentIntent(state: CombatState): EnemyIntentDef {
  return getEnemy(state.enemyId).intents[state.intentIndex];
}

/**
 * The rng commit-back contract (see module header): once a fight has ended, fold its
 * results into the RunState so the next fight continues the combat stream instead of
 * replaying it. Mutates `run` in place. Passive victory innates (Salvage Rig) land
 * here — "after every won encounter" is exactly this moment.
 */
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
      // effect.piercing is recorded but currently indistinguishable from plain damage:
      // no enemy has shield layers or armor until 2.5.
      state.enemyHp = Math.max(0, state.enemyHp - total);
      break;
    }
    case 'travel':
      state.travelProgress += effect.amount;
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
    case 'retain-cards':
      state.modifiers.retainCount += effect.count;
      break;
    case 'strip-armor':
      throw new Error('strip-armor is not implemented until Slice 2.5 (Carapace armor)');
    case 'repair-all-modules':
      // Repair Clone (§4.2) — the alternative to playing each Malfunction card.
      state.malfunctioning = [];
      break;
    default: {
      const exhaustive: never = effect;
      throw new Error(`unhandled card effect: ${JSON.stringify(exhaustive)}`);
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
      state.malfunctioning.push(target);
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
    .filter((index) => !state.malfunctioning.includes(index));
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
  state.intentIndex =
    enemy.pattern === 'random'
      ? rng.int(0, enemy.intents.length)
      : (state.intentIndex + 1) % enemy.intents.length;
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
  }
}
