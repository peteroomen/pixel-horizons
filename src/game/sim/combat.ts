import { BASELINE_AP, getCard, getEnemy, getModule, HAND_SIZE } from '../data';
import type { CardEffect, CardId, EnemyDef, EnemyId, EnemyIntentDef } from '../data';
import { generateDeck } from './deck';
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
  hullHp: number;
  shields: ShieldLayer[];
  /** One-shot layers (Emergency Barrier, Cargo Thrust) — absorbed first, never recharge. */
  tempShieldLayers: number;
  ap: number;
  apPerTurn: number;
  turn: number;
  drawPile: CardId[];
  hand: CardId[];
  discardPile: CardId[];
  exhaustPile: CardId[];
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
  const drawPile = rng.shuffle(generateDeck(run.modules));
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
    hullHp: run.hullHp,
    shields,
    tempShieldLayers: 0,
    ap: BASELINE_AP,
    apPerTurn: BASELINE_AP,
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

export function playCard(state: CombatState, handIndex: number): void {
  if (state.outcome !== 'ongoing') {
    throw new Error('combat already ended');
  }
  if (!Number.isInteger(handIndex) || handIndex < 0 || handIndex >= state.hand.length) {
    throw new Error(`no card at hand index ${handIndex}`);
  }
  const cardId = state.hand[handIndex];
  const card = getCard(cardId);
  if (card.apCost > state.ap) {
    throw new Error(`cannot afford ${cardId}: costs ${card.apCost} AP, have ${state.ap}`);
  }

  const rng = restoreRng(state.rng);
  state.ap -= card.apCost;
  state.hand.splice(handIndex, 1);
  for (const effect of card.effects) {
    applyEffect(state, rng, effect);
  }
  (card.exhaust === true ? state.exhaustPile : state.discardPile).push(cardId);
  state.rng = rng.getState();

  if (state.enemyHp <= 0) {
    state.outcome = 'victory';
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
  drawCards(state, rng, HAND_SIZE - state.hand.length);
  state.rng = rng.getState();
}

/** The enemy action telegraphed for the upcoming enemy phase (shown by the UI in 2.2). */
export function currentIntent(state: CombatState): EnemyIntentDef {
  return getEnemy(state.enemyId).intents[state.intentIndex];
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
      throw new Error('repair-all-modules is not implemented until Slice 2.3 (malfunctions)');
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
  }
}

/**
 * One incoming hit against the ship. The single funnel for all enemy damage so that
 * module-hit absorption (2.3) extends here without reshaping callers — a layer that
 * absorbs a hit absorbs everything riding on it (GDD §5.2).
 */
function resolveIncomingHit(state: CombatState, rng: Rng, amount: number, piercing: boolean): void {
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
