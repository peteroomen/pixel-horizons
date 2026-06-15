import { describe, expect, it } from 'vitest';

import { BASELINE_AP, getCard, getEnemy, HAND_SIZE, MALFUNCTION_REPAIR_AP } from '../data';
import type { CombatState } from './combat';
import {
  applyCombatResult,
  canPayToll,
  canUseInnate,
  cardDiscardCost,
  cardPlayCost,
  createCombat,
  currentIntent,
  endTurn,
  isCardJettisonable,
  isCardMalfunctioning,
  isCardPlayable,
  isTravelAnchored,
  jettisonCard,
  malfunctioningModules,
  payToll,
  playCard,
  activateInnate,
  rollVictoryScrap,
  selectTarget,
} from './combat';
import type { LaneContext } from './combat';
import type { CombatCard } from './deck';
import { generateDeck, moduleIds } from './deck';
import { restoreRng } from './rng';
import { createRunState } from './run-state';
import type { RunState } from './run-state';

const LAMPREY = 'enemy-lamprey';
const PARASITE = 'enemy-parasite';
const ANCHORMAW = 'enemy-anchormaw';
const CARAPACE = 'enemy-carapace';
const SPORECASTER = 'enemy-sporecaster';

function gunshipRun(seed = 'combat-test'): RunState {
  return createRunState(seed, 'hull-gunship');
}

function scoutRun(seed = 'combat-test'): RunState {
  return createRunState(seed, 'hull-scout');
}

/** Fabricates hand instances for scripted tests; module 0 unless a test flips it. */
function hand(...cardIds: string[]): CombatCard[] {
  return cardIds.map((cardId) => ({ cardId, moduleIndex: 0, malfunctioning: false }));
}

/**
 * Flags every card instance of a module across all of a state's piles — the test-side
 * mirror of the engine's internal hit-flagging, so tests can set up partial damage.
 */
function flagModule(state: CombatState, moduleIndex: number): void {
  for (const pile of [state.drawPile, state.hand, state.discardPile, state.exhaustPile]) {
    for (const card of pile) {
      if (card.moduleIndex === moduleIndex) {
        card.malfunctioning = true;
      }
    }
  }
}

function ids(pile: readonly CombatCard[]): string[] {
  return pile.map((card) => card.cardId);
}

function findInHand(state: CombatState, cardId: string): number {
  const index = state.hand.findIndex((card) => card.cardId === cardId);
  if (index === -1) {
    throw new Error(`${cardId} not in hand: ${ids(state.hand).join(', ')}`);
  }
  return index;
}

/**
 * Plays affordable damage cards greedily until the fight ends, recording the action
 * script so a second combat can replay it verbatim.
 */
function autoplay(state: CombatState, maxTurns = 10): string[] {
  const damageCards = ['card-missile-salvo', 'card-flak-volley', 'card-cannon-burst'];
  const log: string[] = [];
  while (state.outcome === 'ongoing' && state.turn <= maxTurns) {
    let played = true;
    while (played && state.outcome === 'ongoing') {
      played = false;
      for (const cardId of damageCards) {
        const index = state.hand.findIndex(
          (card) => card.cardId === cardId && cardPlayCost(state, card) <= state.ap,
        );
        if (index !== -1) {
          playCard(state, index);
          log.push(cardId);
          played = true;
          break;
        }
      }
    }
    if (state.outcome === 'ongoing') {
      endTurn(state);
      log.push('end-turn');
    }
  }
  return log;
}

function replay(state: CombatState, log: readonly string[]): void {
  for (const action of log) {
    if (action === 'end-turn') {
      endTurn(state);
    } else {
      playCard(state, findInHand(state, action));
    }
  }
}

describe('createCombat', () => {
  it('shuffles the module deck and draws an opening hand of 5', () => {
    const run = gunshipRun();
    const state = createCombat(run, LAMPREY);
    const deck = generateDeck(run.modules);
    expect(state.hand.length).toBe(HAND_SIZE);
    expect(state.drawPile.length).toBe(deck.length - HAND_SIZE);
    expect(ids([...state.hand, ...state.drawPile]).sort()).toEqual([...deck].sort());
  });

  it('starts at baseline AP, turn 1, full enemy HP, ongoing', () => {
    const state = createCombat(gunshipRun(), LAMPREY);
    expect(state.ap).toBe(BASELINE_AP);
    expect(state.apPerTurn).toBe(BASELINE_AP);
    expect(state.turn).toBe(1);
    expect(state.enemyHp).toBe(getEnemy(LAMPREY).maxHp);
    expect(state.outcome).toBe('ongoing');
    expect(state.travelProgress).toBe(0);
    expect(state.scrapGained).toBe(0);
    expect(malfunctioningModules(state)).toEqual([]);
    expect(state.innateUsedThisTurn).toBe(false);
    expect(state.innateUsedThisCombat).toBe(false);
  });

  it('freezes the run module list and tags every card with its module', () => {
    const run = scoutRun();
    const state = createCombat(run, LAMPREY);
    expect(state.modules).toEqual(run.modules.map((m) => m.id));
    expect(state.modules).not.toBe(run.modules);
    for (const card of [...state.hand, ...state.drawPile]) {
      expect(card.moduleIndex).toBeGreaterThanOrEqual(0);
      expect(card.moduleIndex).toBeLessThan(run.modules.length);
    }
    // The two Scout thrusters are distinct malfunction targets: their identical
    // card ids carry different module indices.
    const burnOrigins = new Set(
      [...state.hand, ...state.drawPile]
        .filter((card) => card.cardId === 'card-burn')
        .map((card) => card.moduleIndex),
    );
    expect(burnOrigins.size).toBe(2);
  });

  it('collects shield layers from module passives', () => {
    const gunship = createCombat(gunshipRun(), LAMPREY);
    expect(gunship.shields).toEqual([
      { rechargeTurns: 2, turnsUntilUp: 0 },
      { rechargeTurns: 2, turnsUntilUp: 0 },
    ]);
    const scout = createCombat(scoutRun(), LAMPREY);
    expect(scout.shields).toEqual([]);
  });

  it('telegraphs the first intent of a cycle enemy', () => {
    const state = createCombat(gunshipRun(), LAMPREY);
    expect(state.intentIndex).toBe(0);
    expect(currentIntent(state)).toEqual(getEnemy(LAMPREY).intents[0]);
  });

  it('does not mutate the RunState it reads', () => {
    const run = gunshipRun();
    const before = JSON.parse(JSON.stringify(run)) as RunState;
    createCombat(run, LAMPREY);
    expect(run).toEqual(before);
  });

  it('throws on an unknown enemy id', () => {
    expect(() => createCombat(gunshipRun(), 'enemy-nope')).toThrow('enemy-nope');
  });
});

describe('determinism (ADR 003)', () => {
  it('same seed + same script ⇒ identical fight, replayed action for action', () => {
    const reference = createCombat(gunshipRun('det-seed'), LAMPREY);
    const log = autoplay(reference);
    expect(reference.outcome).toBe('victory');

    const rerun = createCombat(gunshipRun('det-seed'), LAMPREY);
    replay(rerun, log);
    expect(rerun).toEqual(reference);
  });

  it('survives a JSON round-trip between every action', () => {
    const reference = createCombat(gunshipRun('det-seed'), LAMPREY);
    const log = autoplay(reference);

    let state = createCombat(gunshipRun('det-seed'), LAMPREY);
    for (const action of log) {
      state = JSON.parse(JSON.stringify(state)) as CombatState;
      replay(state, [action]);
    }
    expect(state).toEqual(reference);
  });

  it('malfunction targeting replays identically, random rolls included', () => {
    const reference = createCombat(gunshipRun('parasite-seed'), PARASITE);
    const log = autoplay(reference, 20);
    const rerun = createCombat(gunshipRun('parasite-seed'), PARASITE);
    replay(rerun, log);
    expect(rerun).toEqual(reference);
    expect(malfunctioningModules(rerun)).toEqual(malfunctioningModules(reference));
  });

  it('different seeds shuffle differently', () => {
    const a = createCombat(gunshipRun('seed-a'), LAMPREY);
    const b = createCombat(gunshipRun('seed-b'), LAMPREY);
    expect(ids([...a.hand, ...a.drawPile])).not.toEqual(ids([...b.hand, ...b.drawPile]));
  });
});

describe('playCard', () => {
  it('pays AP, applies damage, and discards the card', () => {
    const state = createCombat(gunshipRun(), LAMPREY);
    state.hand = hand('card-missile-salvo');
    playCard(state, 0);
    expect(state.ap).toBe(BASELINE_AP - 2);
    expect(state.enemyHp).toBe(getEnemy(LAMPREY).maxHp - 8);
    expect(state.hand).toEqual([]);
    expect(ids(state.discardPile)).toContain('card-missile-salvo');
  });

  it('exhausted cards go to the exhaust pile, not the discard pile', () => {
    const state = createCombat(gunshipRun(), LAMPREY);
    state.hand = hand('card-emergency-barrier');
    playCard(state, 0);
    expect(state.tempShieldLayers).toBe(1);
    expect(ids(state.exhaustPile)).toEqual(['card-emergency-barrier']);
    expect(ids(state.discardPile)).not.toContain('card-emergency-barrier');
  });

  it('throws on insufficient AP, bad index, and after the fight ended', () => {
    const state = createCombat(gunshipRun(), LAMPREY);
    state.hand = hand('card-missile-salvo');
    state.ap = 1;
    expect(() => playCard(state, 0)).toThrow('cannot afford');
    expect(() => playCard(state, 7)).toThrow('hand index');
    state.outcome = 'victory';
    expect(() => playCard(state, 0)).toThrow('already ended');
    expect(() => endTurn(state)).toThrow('already ended');
  });

  it('wins the fight the moment enemy HP reaches 0', () => {
    const state = createCombat(gunshipRun(), LAMPREY);
    // (8 + 3) × 2 = 22 = exactly the Lamprey's HP.
    state.hand = hand('card-lock-on', 'card-overcharge', 'card-missile-salvo');
    playCard(state, findInHand(state, 'card-lock-on'));
    playCard(state, findInHand(state, 'card-overcharge'));
    playCard(state, findInHand(state, 'card-missile-salvo'));
    expect(state.enemyHp).toBe(0);
    expect(state.outcome).toBe('victory');
  });
});

describe('Jettison keyword (GDD §5.9)', () => {
  it('discards the card for its benefit and costs no AP', () => {
    const state = createCombat(gunshipRun(), LAMPREY);
    state.hand = hand('card-afterburner', 'card-missile-salvo');
    state.ap = 1;
    const afterburner = state.hand[0];
    expect(isCardJettisonable(afterburner)).toBe(true);
    jettisonCard(state, 0); // Afterburner: Jettison → +1 AP
    expect(state.ap).toBe(2);
    expect(state.travelProgress).toBe(0); // the travel effect did NOT run
    expect(state.discardPile).toContain(afterburner);
    expect(ids(state.hand)).toEqual(['card-missile-salvo']);
  });

  it('exhausts an exhaust card so injected clog clears for good (Spore Cluster)', () => {
    const state = createCombat(gunshipRun(), SPORECASTER);
    state.hand = hand('card-spore-cluster');
    const spore = state.hand[0];
    expect(isCardJettisonable(spore)).toBe(true);
    jettisonCard(state, 0);
    // Goes to the exhaust pile, not discard — it can never reshuffle back into the fight.
    expect(state.exhaustPile).toContain(spore);
    expect(state.discardPile).not.toContain(spore);
    expect(ids(state.hand)).toEqual([]);
  });

  it('throws for a card with no Jettison, and a malfunctioning instance refuses', () => {
    const state = createCombat(gunshipRun(), LAMPREY);
    state.hand = hand('card-missile-salvo');
    expect(isCardJettisonable(state.hand[0])).toBe(false);
    expect(() => jettisonCard(state, 0)).toThrow('cannot be jettisoned');

    const flagged: CombatCard = {
      cardId: 'card-afterburner',
      moduleIndex: 0,
      malfunctioning: true,
    };
    state.hand = [flagged];
    expect(isCardJettisonable(flagged)).toBe(false);
    expect(() => jettisonCard(state, 0)).toThrow('cannot be jettisoned');
  });
});

describe('Discard keyword (GDD §5.9)', () => {
  it('discards the chosen card as a cost, then resolves the card', () => {
    const state = createCombat(gunshipRun(), LAMPREY);
    state.hand = hand('card-salvage-round', 'card-missile-salvo', 'card-flak-volley');
    const salvage = state.hand[0];
    const fodder = state.hand[2];
    expect(cardDiscardCost(salvage)).toBe(1);
    playCard(state, 0, [2]); // discard Flak Volley to fire Salvage Round (Deal 9)
    expect(state.enemyHp).toBe(getEnemy(LAMPREY).maxHp - 9);
    expect(state.ap).toBe(BASELINE_AP - 1);
    expect(state.discardPile).toContain(salvage);
    expect(state.discardPile).toContain(fodder);
    expect(ids(state.hand)).toEqual(['card-missile-salvo']);
  });

  it('validates the discard selection', () => {
    const state = createCombat(gunshipRun(), LAMPREY);
    state.hand = hand('card-salvage-round', 'card-missile-salvo');
    expect(() => playCard(state, 0)).toThrow('discards exactly 1'); // no targets supplied
    expect(() => playCard(state, 0, [0])).toThrow('cannot pay its own discard cost');
    expect(() => playCard(state, 0, [5])).toThrow('no card at discard index');
  });
});

describe('module modifiers in combat (GDD §6.6)', () => {
  it('apCostDelta lowers the play cost, floored at 0', () => {
    const state = createCombat(gunshipRun(), LAMPREY);
    const cheap: CombatCard = {
      cardId: 'card-missile-salvo', // base 2 AP
      moduleIndex: 0,
      malfunctioning: false,
      apCostDelta: 1,
    };
    expect(cardPlayCost(state, cheap)).toBe(1);
  });

  it('bonusEffects fire after the card resolves', () => {
    const state = createCombat(gunshipRun(), LAMPREY);
    state.hand = [
      {
        cardId: 'card-missile-salvo',
        moduleIndex: 0,
        malfunctioning: false,
        bonusEffects: [{ kind: 'draw', count: 1 }],
      },
    ];
    playCard(state, 0);
    expect(state.enemyHp).toBe(getEnemy(LAMPREY).maxHp - 8);
    expect(state.hand.length).toBe(1); // played 1, drew 1 back
  });
});

describe('Cleave keyword (GDD §5.9)', () => {
  it('hits the core like any attack while the enemy has no organs', () => {
    const state = createCombat(gunshipRun(), LAMPREY);
    state.hand = hand('card-scatter-shell'); // Deal 6 to all · piercing
    playCard(state, 0);
    expect(state.enemyHp).toBe(getEnemy(LAMPREY).maxHp - 6);
  });
});

describe('card effects', () => {
  function fresh(cards: string[], ap = BASELINE_AP): CombatState {
    const state = createCombat(gunshipRun(), LAMPREY);
    state.hand = hand(...cards);
    state.ap = ap;
    return state;
  }

  it('Charged is flat and consumed by the next damage effect', () => {
    const state = fresh(['card-lock-on', 'card-missile-salvo']);
    playCard(state, 0);
    expect(state.shipStatuses).toEqual([{ id: 'status-charged', magnitude: 3 }]);
    playCard(state, 0);
    expect(state.enemyHp).toBe(getEnemy(LAMPREY).maxHp - 11);
    expect(state.shipStatuses).toHaveLength(0);
  });

  it('Overcharged multiplies and is consumed', () => {
    const state = fresh(['card-overcharge', 'card-cannon-burst']);
    playCard(state, 0);
    // First hit doubled (3 × 2), second hit plain — buffs are per-hit, not per-card.
    playCard(state, 0);
    expect(state.enemyHp).toBe(getEnemy(LAMPREY).maxHp - 9);
    expect(state.shipStatuses).toHaveLength(0);
  });

  it('Marked adds to every hit against its target for the rest of the fight', () => {
    const state = fresh(['card-tracer-lock', 'card-cannon-burst']);
    playCard(state, 0);
    playCard(state, 0);
    expect(state.enemyHp).toBe(getEnemy(LAMPREY).maxHp - 10);
    // Tracer Lock with no organ focused marks the core; the mark persists.
    expect(state.coreStatuses).toEqual([{ id: 'status-marked', magnitude: 2 }]);
  });

  it('travel accumulates as a bare counter', () => {
    const state = fresh(['card-burn', 'card-afterburner']);
    playCard(state, 0);
    playCard(state, 0);
    expect(state.travelProgress).toBe(7);
  });

  it('draw pulls from the draw pile', () => {
    const state = fresh(['card-telemetry-sync']);
    const pileBefore = state.drawPile.length;
    playCard(state, 0);
    expect(state.hand.length).toBe(1);
    expect(state.drawPile.length).toBe(pileBefore - 1);
  });

  it('gain-scrap accumulates in the combat state', () => {
    const state = fresh(['card-resource-ping']);
    playCard(state, 0);
    expect(state.scrapGained).toBe(1);
    expect(ids(state.exhaustPile)).toEqual(['card-resource-ping']);
  });

  it('reveal-intent flags the telegraphed intent until end of turn', () => {
    const state = fresh(['card-deep-scan']);
    playCard(state, 0);
    expect(state.modifiers.intentRevealed).toBe(true);
    endTurn(state);
    expect(state.modifiers.intentRevealed).toBe(false);
  });
});

describe('malfunctions (GDD §5.6)', () => {
  it('a module hit that reaches the hull also flips the targeted module', () => {
    // Scout has no shields; Parasite opens with Burrow (3 dmg, highest-value).
    // Scout module values: laser 2, phase-shifter 3, thruster 3, thruster 3, matrix 1
    // — ties go to the lowest index, so the Phase Shifter (index 1) is hunted first.
    const state = createCombat(scoutRun(), PARASITE);
    endTurn(state);
    expect(state.hullHp).toBe(97);
    expect(malfunctioningModules(state)).toEqual([1]);
  });

  it('flags every card instance of the hit module, not just one', () => {
    const state = createCombat(scoutRun(), PARASITE);
    endTurn(state); // Phase Shifter (index 1) hunted first
    const phaseShifterCards = [...state.drawPile, ...state.hand, ...state.discardPile].filter(
      (c) => c.moduleIndex === 1,
    );
    expect(phaseShifterCards.length).toBeGreaterThan(1);
    expect(phaseShifterCards.every((c) => c.malfunctioning)).toBe(true);
  });

  it('a shield layer that absorbs the hit absorbs the malfunction too (§5.2)', () => {
    const state = createCombat(gunshipRun(), PARASITE);
    endTurn(state); // Burrow eaten by a Shield Generator layer
    expect(state.hullHp).toBe(100);
    expect(malfunctioningModules(state)).toEqual([]);
    expect(state.shields.filter((l) => l.turnsUntilUp > 0).length).toBe(1);
  });

  it('a piercing module hit bypasses shields and flips a module', () => {
    const state = createCombat(gunshipRun(), LAMPREY);
    state.intentIndex = 2; // Rend: 9 dmg, piercing, random module
    endTurn(state);
    expect(state.hullHp).toBe(91);
    expect(malfunctioningModules(state).length).toBe(1);
    expect(state.shields.map((l) => l.turnsUntilUp)).toEqual([0, 0]);
  });

  it('an untargetable or dodged hit malfunctions nothing', () => {
    const state = createCombat(scoutRun(), PARASITE);
    state.hand = hand('card-phase-walk');
    playCard(state, 0);
    endTurn(state);
    expect(state.hullHp).toBe(100);
    expect(malfunctioningModules(state)).toEqual([]);
  });

  it('flipped cards cost the repair AP regardless of their printed cost', () => {
    const state = createCombat(scoutRun(), PARASITE);
    const afterburner: CombatCard = {
      cardId: 'card-afterburner',
      moduleIndex: 2,
      malfunctioning: true,
    };
    expect(isCardMalfunctioning(afterburner)).toBe(true);
    expect(cardPlayCost(state, afterburner)).toBe(MALFUNCTION_REPAIR_AP);
    state.hand = [afterburner];
    state.ap = 1; // printed cost is 2 — unaffordable if it weren't flipped
    playCard(state, 0);
    expect(state.ap).toBe(0);
  });

  it('playing a flipped card clears only that instance and applies no card effects', () => {
    const state = createCombat(scoutRun(), PARASITE);
    flagModule(state, 1); // Phase Shifter — all its instances down
    expect(malfunctioningModules(state)).toEqual([1]);
    state.hand = [{ cardId: 'card-ghost-shift', moduleIndex: 1, malfunctioning: true }];
    playCard(state, 0);
    expect(state.modifiers.dodgeChance).toBe(0); // Ghost Shift's effect did NOT run
    expect(state.ap).toBe(BASELINE_AP - MALFUNCTION_REPAIR_AP);
    // The played card returns to the discard pile in normal form...
    expect(ids(state.discardPile)).toEqual(['card-ghost-shift']);
    expect(isCardMalfunctioning(state.discardPile[0])).toBe(false);
    // ...but the module's other instances (in the draw pile) are still flagged.
    expect(malfunctioningModules(state)).toEqual([1]);
  });

  it('a module is operational again only once all its instances are repaired', () => {
    const state = createCombat(scoutRun(), PARASITE);
    flagModule(state, 1); // Phase Shifter contributes 3 cards
    const flagged = [state.drawPile, state.hand]
      .flat()
      .filter((c) => c.moduleIndex === 1 && c.malfunctioning);
    expect(flagged.length).toBe(3);
    // Repair each in turn; the module stays malfunctioning until the last clears.
    for (let i = 0; i < flagged.length; i++) {
      expect(malfunctioningModules(state)).toEqual([1]);
      flagged[i].malfunctioning = false;
    }
    expect(malfunctioningModules(state)).toEqual([]);
  });

  it('only the hit module flips — its twin keeps its cards', () => {
    const flipped: CombatCard = { cardId: 'card-burn', moduleIndex: 2, malfunctioning: true };
    const twin: CombatCard = { cardId: 'card-burn', moduleIndex: 3, malfunctioning: false };
    expect(isCardMalfunctioning(flipped)).toBe(true);
    expect(isCardMalfunctioning(twin)).toBe(false);
  });

  it('an already-flipped module cannot flip twice — the hunt moves on', () => {
    const state = createCombat(scoutRun(), PARASITE);
    flagModule(state, 1);
    endTurn(state); // Burrow: next-best operational module is the first Thruster
    expect(malfunctioningModules(state)).toEqual([1, 2]);
  });

  it('with every module down, a module hit is plain hull damage', () => {
    const state = createCombat(scoutRun(), PARASITE);
    for (const index of [0, 1, 2, 3, 4]) {
      flagModule(state, index);
    }
    endTurn(state);
    expect(state.hullHp).toBe(97);
    expect(malfunctioningModules(state)).toEqual([0, 1, 2, 3, 4]);
  });

  it('repair-all-modules (Repair Clone) clears every malfunction at once', () => {
    const state = createCombat(scoutRun(), PARASITE);
    for (const index of [1, 2, 3]) {
      flagModule(state, index);
    }
    state.hand = hand('card-repair-clone');
    playCard(state, 0);
    expect(malfunctioningModules(state)).toEqual([]);
    expect(state.ap).toBe(BASELINE_AP - 2);
  });
});

describe('hull innate abilities (GDD §4.1)', () => {
  it('Point-Defense: 1 AP, 2 damage, once per turn, resets next turn', () => {
    const state = createCombat(gunshipRun(), LAMPREY);
    expect(canUseInnate(state)).toBe(true);
    activateInnate(state);
    expect(state.ap).toBe(BASELINE_AP - 1);
    expect(state.enemyHp).toBe(getEnemy(LAMPREY).maxHp - 2);
    expect(canUseInnate(state)).toBe(false);
    expect(() => activateInnate(state)).toThrow('already used this turn');
    endTurn(state);
    expect(canUseInnate(state)).toBe(true);
  });

  it('Point-Defense throws when unaffordable and skips ship attack buffs', () => {
    const state = createCombat(gunshipRun(), LAMPREY);
    state.ap = 0;
    expect(canUseInnate(state)).toBe(false);
    expect(() => activateInnate(state)).toThrow('cannot afford');
    state.ap = 1;
    state.shipStatuses.push({ id: 'status-charged', magnitude: 3 });
    state.coreStatuses.push({ id: 'status-marked', magnitude: 2 });
    activateInnate(state);
    // Marked applies per hit; a saved-up Charged is NOT eaten by the innate.
    expect(state.enemyHp).toBe(getEnemy(LAMPREY).maxHp - 4);
    expect(state.shipStatuses).toEqual([{ id: 'status-charged', magnitude: 3 }]);
  });

  it('Point-Defense can land the killing blow', () => {
    const state = createCombat(gunshipRun(), LAMPREY);
    state.enemyHp = 2;
    activateInnate(state);
    expect(state.enemyHp).toBe(0);
    expect(state.outcome).toBe('victory');
  });

  it('Slipstream discards the chosen card and draws a replacement, free', () => {
    const state = createCombat(scoutRun(), LAMPREY);
    const discarded = state.hand[2];
    activateInnate(state, 2);
    expect(state.ap).toBe(BASELINE_AP);
    expect(state.hand.length).toBe(HAND_SIZE);
    expect(state.discardPile).toContainEqual(discarded);
    expect(() => activateInnate(state, 0)).toThrow('already used this turn');
  });

  it('Slipstream requires a valid hand index', () => {
    const state = createCombat(scoutRun(), LAMPREY);
    expect(() => activateInnate(state)).toThrow('hand index');
    expect(() => activateInnate(state, 99)).toThrow('hand index');
  });

  it('Auxiliary Router grants AP once per combat — no per-turn reset', () => {
    const state = createCombat(createRunState('combat-test', 'hull-tactical'), LAMPREY);
    activateInnate(state);
    expect(state.ap).toBe(BASELINE_AP + 1);
    expect(() => activateInnate(state)).toThrow('already used this combat');
    endTurn(state);
    expect(canUseInnate(state)).toBe(false);
    expect(() => activateInnate(state)).toThrow('already used this combat');
  });

  it('passive innates (Salvage Rig) cannot be activated', () => {
    const state = createCombat(createRunState('combat-test', 'hull-freighter'), LAMPREY);
    expect(canUseInnate(state)).toBe(false);
    expect(() => activateInnate(state)).toThrow('passive');
  });

  it('throws after the fight ended', () => {
    const state = createCombat(gunshipRun(), LAMPREY);
    state.outcome = 'victory';
    expect(canUseInnate(state)).toBe(false);
    expect(() => activateInnate(state)).toThrow('already ended');
  });
});

describe('shields and the enemy phase', () => {
  it('layers absorb one hit each — a two-hit attack spends two layers', () => {
    const state = createCombat(gunshipRun(), LAMPREY);
    endTurn(state); // Feeding Frenzy: 4 dmg × 2 hits
    expect(state.hullHp).toBe(100);
    expect(state.shields.map((l) => l.turnsUntilUp)).toEqual([2, 2]);
  });

  it('piercing attacks bypass active layers entirely', () => {
    const state = createCombat(gunshipRun(), LAMPREY);
    state.intentIndex = 2; // Rend: 9 dmg, piercing
    endTurn(state);
    expect(state.hullHp).toBe(91);
    expect(state.shields.map((l) => l.turnsUntilUp)).toEqual([0, 0]);
  });

  it('spent layers recharge after rechargeTurns full enemy phases', () => {
    const state = createCombat(gunshipRun(), LAMPREY);
    endTurn(state); // T1 Frenzy: both layers spent, no tick the phase they were spent
    expect(state.shields.map((l) => l.turnsUntilUp)).toEqual([2, 2]);
    endTurn(state); // T2 Lash 7: layers down → hull damage; tick
    expect(state.hullHp).toBe(93);
    expect(state.shields.map((l) => l.turnsUntilUp)).toEqual([1, 1]);
    endTurn(state); // T3 Rend 9 piercing; tick → layers back up
    expect(state.hullHp).toBe(84);
    expect(state.shields.map((l) => l.turnsUntilUp)).toEqual([0, 0]);
    endTurn(state); // T4 Frenzy again: absorbed by the recharged layers
    expect(state.hullHp).toBe(84);
  });

  it('restore-shield-layer brings a recharging layer back up', () => {
    const state = createCombat(gunshipRun(), LAMPREY);
    endTurn(state);
    state.hand = hand('card-reinforce');
    playCard(state, 0);
    expect(state.shields.map((l) => l.turnsUntilUp).sort()).toEqual([0, 2]);
  });

  it('temp layers absorb before regular layers and never recharge', () => {
    const state = createCombat(gunshipRun(), LAMPREY);
    state.hand = hand('card-emergency-barrier');
    playCard(state, 0);
    endTurn(state); // Frenzy: hit 1 → temp layer, hit 2 → one regular layer
    expect(state.tempShieldLayers).toBe(0);
    expect(state.hullHp).toBe(100);
    expect(state.shields.map((l) => l.turnsUntilUp).sort()).toEqual([0, 2]);
  });

  it('dodge rolls the combat stream per incoming hit, then expires', () => {
    const state = createCombat(scoutRun('dodge-seed'), LAMPREY);
    state.hand = hand('card-ghost-shift');
    playCard(state, 0);
    expect(state.modifiers.dodgeChance).toBe(0.5);

    // Predict the dodge rolls from the serialized stream — first draws of the phase.
    const preview = restoreRng(state.rng);
    const missed = [preview.next() < 0.5, preview.next() < 0.5];
    const expected = 100 - missed.filter((m) => !m).length * 4;
    endTurn(state); // Feeding Frenzy: 4 dmg × 2 hits, scout has no shields
    expect(state.hullHp).toBe(expected);
    expect(state.modifiers.dodgeChance).toBe(0);
  });

  it('untargetable blanks the enemy phase, then ticks away', () => {
    const state = createCombat(scoutRun(), LAMPREY);
    state.hand = hand('card-phase-walk');
    playCard(state, 0);
    endTurn(state);
    expect(state.hullHp).toBe(100);
    expect(state.modifiers.untargetableTurns).toBe(0);
    endTurn(state); // Lash 7 lands now
    expect(state.hullHp).toBe(93);
  });

  it('cycle enemies advance their telegraphed intent each turn', () => {
    const state = createCombat(gunshipRun(), LAMPREY);
    const intents = getEnemy(LAMPREY).intents;
    expect(currentIntent(state)).toEqual(intents[0]);
    endTurn(state);
    expect(currentIntent(state)).toEqual(intents[1]);
    endTurn(state);
    expect(currentIntent(state)).toEqual(intents[2]);
    endTurn(state);
    expect(currentIntent(state)).toEqual(intents[0]);
  });
});

describe('turn structure (GDD §5.5)', () => {
  it('discards unplayed cards and redraws to 5 — but keeps Retain cards in hand', () => {
    const state = createCombat(gunshipRun(), LAMPREY);
    const unplayed = state.hand.map((c) => c.cardId);
    const retained = state.hand
      .filter((c) => getCard(c.cardId).retain === true)
      .map((c) => c.cardId);
    endTurn(state);
    expect(state.hand.length).toBe(HAND_SIZE);
    expect(state.turn).toBe(2);
    expect(state.ap).toBe(BASELINE_AP);
    for (const cardId of unplayed) {
      if (retained.includes(cardId)) {
        expect(ids(state.hand)).toContain(cardId); // Retain (e.g. Reinforce) stayed
      } else {
        expect(ids(state.discardPile)).toContain(cardId);
      }
    }
  });

  it('a Retain card survives the discard step; non-retain cards discard', () => {
    const state = createCombat(gunshipRun(), LAMPREY);
    // Desync Hull declares `retain`; the rest do not.
    state.hand = hand('card-missile-salvo', 'card-desync-hull', 'card-flak-volley');
    const retained = state.hand[1];
    endTurn(state);
    expect(state.hand).toContain(retained);
    expect(state.hand.length).toBe(HAND_SIZE);
    expect(ids(state.discardPile)).toContain('card-missile-salvo');
    expect(ids(state.discardPile)).toContain('card-flak-volley');
    expect(ids(state.discardPile)).not.toContain('card-desync-hull');
  });

  it('a malfunctioning instance never retains, even of a Retain card', () => {
    const state = createCombat(gunshipRun(), LAMPREY);
    const flagged: CombatCard = {
      cardId: 'card-desync-hull',
      moduleIndex: 0,
      malfunctioning: true,
    };
    state.hand = [flagged];
    endTurn(state);
    expect(state.discardPile).toContain(flagged);
  });

  it('reshuffles the discard pile when the draw pile empties; exhaust stays out', () => {
    const state = createCombat(gunshipRun(), LAMPREY);
    state.hand = [];
    state.drawPile = [];
    state.discardPile = hand('card-burn', 'card-burn');
    state.exhaustPile = hand('card-emergency-barrier');
    endTurn(state);
    expect(ids(state.hand).sort()).toEqual(['card-burn', 'card-burn']);
    expect(state.discardPile).toEqual([]);
    expect(ids(state.exhaustPile)).toEqual(['card-emergency-barrier']);
  });

  it('a deck too small for a full hand deals a short hand without error', () => {
    const run = scoutRun('tiny');
    run.modules = moduleIds(['mod-standard-print-matrix']);
    const state = createCombat(run, LAMPREY);
    expect(ids(state.hand)).toEqual(['card-telemetry-sync']);
    playCard(state, 0); // its draw effect finds no cards anywhere — a quiet no-op
    expect(state.hand).toEqual([]);
  });
});

describe('win / lose', () => {
  it('a passive scout is eventually shredded — defeat at hull 0', () => {
    const state = createCombat(scoutRun('defeat'), LAMPREY);
    for (let i = 0; i < 20 && state.outcome === 'ongoing'; i++) {
      endTurn(state);
    }
    expect(state.outcome).toBe('defeat');
    expect(state.hullHp).toBe(0);
    expect(() => endTurn(state)).toThrow('already ended');
  });

  it('a gunship racing the Lamprey wins inside a few turns', () => {
    const state = createCombat(gunshipRun('victory'), LAMPREY);
    autoplay(state);
    expect(state.outcome).toBe('victory');
    expect(state.enemyHp).toBe(0);
    expect(state.turn).toBeLessThanOrEqual(4);
    expect(state.hullHp).toBeGreaterThan(0);
  });
});

describe('applyCombatResult', () => {
  it('throws while the combat is still ongoing', () => {
    const run = gunshipRun();
    const state = createCombat(run, LAMPREY);
    expect(() => applyCombatResult(run, state)).toThrow('still ongoing');
  });

  it('commits rng, hull HP, and scrap back to the RunState', () => {
    const run = gunshipRun('commit-back');
    const state = createCombat(run, LAMPREY);
    autoplay(state);
    expect(state.outcome).toBe('victory');
    state.scrapGained = 3;
    applyCombatResult(run, state);
    expect(run.rng.combat).toEqual(state.rng);
    expect(run.hullHp).toBe(state.hullHp);
    expect(run.resources.scrap).toBe(3);
  });

  it('Salvage Rig adds its scrap after a won encounter — and only a won one', () => {
    const run = createRunState('salvage', 'hull-freighter');
    const won = createCombat(run, LAMPREY);
    won.outcome = 'victory';
    won.scrapGained = 1;
    applyCombatResult(run, won);
    expect(run.resources.scrap).toBe(3);

    const lost = createCombat(run, LAMPREY);
    lost.outcome = 'defeat';
    applyCombatResult(run, lost);
    expect(run.resources.scrap).toBe(3);
  });

  it('consecutive fights continue the combat stream instead of replaying it', () => {
    const run = gunshipRun('stream');
    const first = createCombat(run, LAMPREY);
    const firstOpening = ids([...first.hand, ...first.drawPile]);
    autoplay(first);
    applyCombatResult(run, first);
    const second = createCombat(run, LAMPREY);
    const secondOpening = ids([...second.hand, ...second.drawPile]);
    expect(secondOpening).not.toEqual(firstOpening);
    expect([...secondOpening].sort()).toEqual([...firstOpening].sort());
  });
});

describe('rollVictoryScrap (GDD §6.4)', () => {
  it('rolls a reward within the enemy scrapReward band', () => {
    const run = gunshipRun('scrap-drop');
    const state = createCombat(run, LAMPREY);
    autoplay(state);
    expect(state.outcome).toBe('victory');
    const before = state.scrapGained;
    rollVictoryScrap(state);
    const reward = getEnemy(LAMPREY).scrapReward;
    expect(state.scrapGained - before).toBeGreaterThanOrEqual(reward.min);
    expect(state.scrapGained - before).toBeLessThanOrEqual(reward.max);
  });

  it('result is deterministic (same seed = same drop)', () => {
    const run1 = gunshipRun('deterministic');
    const s1 = createCombat(run1, LAMPREY);
    autoplay(s1);
    rollVictoryScrap(s1);

    const run2 = gunshipRun('deterministic');
    const s2 = createCombat(run2, LAMPREY);
    autoplay(s2);
    rollVictoryScrap(s2);

    expect(s1.scrapGained).toBe(s2.scrapGained);
  });

  it('applyCombatResult folds the rolled scrap into the run', () => {
    const run = gunshipRun('fold');
    const state = createCombat(run, LAMPREY);
    autoplay(state);
    rollVictoryScrap(state);
    const drop = state.scrapGained;
    applyCombatResult(run, state);
    expect(run.resources.scrap).toBe(drop);
  });
});

describe('lanes and travel', () => {
  function laneCtx(
    distance: number,
    progressAtStart = 0,
    malfunctioning: number[] = [],
  ): LaneContext {
    return { distance, progressAtStart, malfunctioning };
  }

  it('carries the lane snapshot and earlier malfunctions into the fight', () => {
    const state = createCombat(gunshipRun(), LAMPREY, laneCtx(9, 2, [1]));
    expect(state.lane).toEqual({ distance: 9, progressAtStart: 2 });
    expect(malfunctioningModules(state)).toEqual([1]);
  });

  it('a survived full turn is a turn of travel', () => {
    const state = createCombat(gunshipRun(), LAMPREY, laneCtx(9));
    endTurn(state);
    expect(state.travelProgress).toBe(1);
  });

  it('fights outside a lane never tick travel or escape', () => {
    const state = createCombat(gunshipRun(), LAMPREY);
    endTurn(state);
    expect(state.travelProgress).toBe(0);
    expect(state.lane).toBeNull();
  });

  it('an engine card reaching the destination escapes mid-turn — the enemy never acts', () => {
    const state = createCombat(gunshipRun(), LAMPREY, laneCtx(8, 4));
    state.hand = hand('card-afterburner');
    playCard(state, 0);
    expect(state.outcome).toBe('escaped');
    expect(state.hullHp).toBe(100);
    expect(() => endTurn(state)).toThrow('already ended');
  });

  it('the passive tick can arrive too — after the enemy phase', () => {
    const state = createCombat(gunshipRun(), LAMPREY, laneCtx(5, 4));
    const turnBefore = state.turn;
    endTurn(state);
    expect(state.outcome).toBe('escaped');
    expect(state.turn).toBe(turnBefore);
  });

  it('an anchor enemy halts the passive tick and travel effects while it lives', () => {
    const state = createCombat(gunshipRun(), ANCHORMAW, laneCtx(9));
    expect(isTravelAnchored(state)).toBe(true);
    state.hand = hand('card-burn');
    playCard(state, 0);
    expect(state.travelProgress).toBe(0);
    endTurn(state);
    expect(state.travelProgress).toBe(0);
    state.enemyHp = 0;
    expect(isTravelAnchored(state)).toBe(false);
  });

  it('paying the toll escapes and lands as a negative scrap delta', () => {
    const run = gunshipRun();
    run.resources.scrap = 7;
    const state = createCombat(run, ANCHORMAW, laneCtx(9));
    expect(state.scrapAtStart).toBe(7);
    expect(canPayToll(state)).toBe(true);
    payToll(state);
    expect(state.outcome).toBe('escaped');
    expect(state.scrapGained).toBe(-5);
    applyCombatResult(run, state);
    expect(run.resources.scrap).toBe(2);
  });

  it('toll affordability counts scrap gained during the fight', () => {
    const run = gunshipRun();
    run.resources.scrap = 4;
    const state = createCombat(run, ANCHORMAW, laneCtx(9));
    expect(canPayToll(state)).toBe(false);
    expect(() => payToll(state)).toThrow('cannot afford');
    state.scrapGained = 1;
    expect(canPayToll(state)).toBe(true);
  });

  it('payToll throws against an enemy that does not anchor the lane', () => {
    const state = createCombat(gunshipRun(), LAMPREY, laneCtx(9));
    expect(canPayToll(state)).toBe(false);
    expect(() => payToll(state)).toThrow('does not anchor');
  });

  it('escape grants no victory rewards — Salvage Rig stays silent', () => {
    const run = createRunState('escape-no-reward', 'hull-freighter');
    const state = createCombat(run, LAMPREY, laneCtx(1));
    endTurn(state);
    expect(state.outcome).toBe('escaped');
    applyCombatResult(run, state);
    expect(run.resources.scrap).toBe(0);
  });

  it('a lane fight survives a JSON round-trip', () => {
    let state = createCombat(gunshipRun(), ANCHORMAW, laneCtx(9, 3, [0]));
    state = JSON.parse(JSON.stringify(state)) as CombatState;
    expect(state.lane).toEqual({ distance: 9, progressAtStart: 3 });
    expect(malfunctioningModules(state)).toEqual([0]);
    expect(isTravelAnchored(state)).toBe(true);
    endTurn(state);
    expect(state.travelProgress).toBe(0);
  });
});

describe('Carapace armor (GDD §5.7)', () => {
  function carapaceFight(cards: string[], ap = BASELINE_AP): CombatState {
    const state = createCombat(gunshipRun(), CARAPACE);
    state.hand = hand(...cards);
    state.ap = ap;
    return state;
  }

  it('starts with the armor pool up; unarmored enemies start at 0', () => {
    expect(carapaceFight([]).enemyArmor).toBe(5);
    expect(createCombat(gunshipRun(), LAMPREY).enemyArmor).toBe(0);
  });

  it('damage fully absorbed by armor leaves HP untouched', () => {
    const state = carapaceFight(['card-laser-burst']);
    playCard(state, 0); // 4 into armor 5
    expect(state.enemyArmor).toBe(1);
    expect(state.enemyHp).toBe(getEnemy(CARAPACE).maxHp);
  });

  it('sustained damage within one turn breaks through the pool', () => {
    const state = carapaceFight(['card-missile-salvo', 'card-laser-burst']);
    playCard(state, 0); // 8: armor 5 absorbs, 3 reaches HP
    expect(state.enemyArmor).toBe(0);
    playCard(state, 0); // armor already down — full 4 lands
    expect(state.enemyHp).toBe(getEnemy(CARAPACE).maxHp - 7);
  });

  it('piercing bypasses armor entirely', () => {
    const state = carapaceFight(['card-flak-volley']);
    playCard(state, 0); // 6 piercing
    expect(state.enemyArmor).toBe(5);
    expect(state.enemyHp).toBe(getEnemy(CARAPACE).maxHp - 6);
  });

  it('strip-armor zeroes the pool so follow-up damage lands clean', () => {
    const state = carapaceFight(['card-kinetic-shred', 'card-missile-salvo']);
    playCard(state, 0);
    expect(state.enemyArmor).toBe(0);
    playCard(state, 0);
    expect(state.enemyHp).toBe(getEnemy(CARAPACE).maxHp - 8);
  });

  it('armor regrows after the enemy phase, capped at its max', () => {
    const state = carapaceFight(['card-missile-salvo']);
    playCard(state, 0);
    expect(state.enemyArmor).toBe(0);
    endTurn(state);
    expect(state.enemyArmor).toBe(2);
    endTurn(state);
    endTurn(state); // 2 → 4 → capped at 5
    expect(state.enemyArmor).toBe(5);
  });

  it('the damage innate respects armor too', () => {
    const state = createCombat(gunshipRun(), CARAPACE);
    activateInnate(state); // Point-Defense: 2 damage
    expect(state.enemyArmor).toBe(3);
    expect(state.enemyHp).toBe(getEnemy(CARAPACE).maxHp);
  });

  it('vulnerable is added to the printed total before armor absorbs', () => {
    const state = carapaceFight(['card-tracer-lock', 'card-missile-salvo']);
    playCard(state, 0); // +2 per hit
    playCard(state, 0); // 8 + 2 = 10: armor eats 5, HP takes 5
    expect(state.enemyHp).toBe(getEnemy(CARAPACE).maxHp - 5);
  });
});

describe('Infestations (GDD §5.6)', () => {
  const SPORE = 'card-spore-cluster';

  function sporeCard(): CombatCard {
    return { cardId: SPORE, moduleIndex: null, malfunctioning: false };
  }

  it('inject inserts the cards into the draw pile with no module', () => {
    const state = createCombat(gunshipRun(), SPORECASTER);
    expect(currentIntent(state).kind).toBe('inject');
    endTurn(state); // Spore Burst ×2
    const everywhere = [...state.drawPile, ...state.hand, ...state.discardPile];
    const spores = everywhere.filter((card) => card.cardId === SPORE);
    expect(spores.length).toBe(2);
    for (const spore of spores) {
      expect(spore.moduleIndex).toBeNull();
    }
  });

  it('injection is deterministic — same seed, same positions', () => {
    const a = createCombat(gunshipRun('spore-seed'), SPORECASTER);
    const b = createCombat(gunshipRun('spore-seed'), SPORECASTER);
    endTurn(a);
    endTurn(b);
    expect(ids(a.drawPile)).toEqual(ids(b.drawPile));
    expect(ids(a.hand)).toEqual(ids(b.hand));
  });

  it('a mid-fight JSON round-trip preserves infestations and continues identically', () => {
    const state = createCombat(gunshipRun(), SPORECASTER);
    endTurn(state);
    const copy = JSON.parse(JSON.stringify(state)) as CombatState;
    endTurn(state);
    endTurn(copy);
    expect(ids(copy.drawPile)).toEqual(ids(state.drawPile));
    expect(ids(copy.hand)).toEqual(ids(state.hand));
  });

  it('unplayable cards throw on play', () => {
    const state = createCombat(gunshipRun(), SPORECASTER);
    state.hand = [sporeCard()];
    expect(isCardPlayable(sporeCard())).toBe(false);
    expect(() => playCard(state, 0)).toThrow('unplayable');
  });

  it('an injected card can never present as a Malfunction', () => {
    // An injected card carries moduleIndex null and is never flagged, so even if every
    // real module is down it can't present as a Malfunction.
    expect(isCardMalfunctioning(sporeCard())).toBe(false);
  });

  it('Spore Cluster drops a shield layer as it is drawn — mid-card draws included', () => {
    const state = createCombat(gunshipRun(), SPORECASTER);
    state.drawPile.unshift(sporeCard());
    state.hand = hand('card-telemetry-sync');
    playCard(state, 0); // draw 1 → the spore enters the hand
    expect(ids(state.hand)).toEqual([SPORE]);
    expect(state.shields.filter((layer) => layer.turnsUntilUp > 0).length).toBe(1);
  });

  it('on-draw eats temp layers first; no shields at all means no effect', () => {
    const state = createCombat(gunshipRun(), SPORECASTER);
    state.tempShieldLayers = 1;
    state.drawPile.unshift(sporeCard());
    state.hand = hand('card-telemetry-sync');
    playCard(state, 0);
    expect(state.tempShieldLayers).toBe(0);
    expect(state.shields.every((layer) => layer.turnsUntilUp === 0)).toBe(true);

    const scout = createCombat(scoutRun(), SPORECASTER); // no shield module
    scout.drawPile.unshift(sporeCard());
    scout.hand = hand('card-telemetry-sync');
    expect(() => playCard(scout, 0)).not.toThrow();
  });
});

const GATEMAW = 'enemy-gatemaw';

describe('boss phases (GDD §7.5)', () => {
  it('starts in base phase (phaseIndex -1)', () => {
    const state = createCombat(gunshipRun(), GATEMAW);
    expect(state.phaseIndex).toBe(-1);
  });

  it('phase transition switches intent table and resets intent index', () => {
    const run = gunshipRun();
    const s = createCombat(run, GATEMAW);
    const enemy = getEnemy(GATEMAW);
    s.enemyHp = Math.floor(enemy.maxHp * enemy.phases![0].belowHpFraction) + 1;
    s.enemyArmor = 0;
    expect(s.phaseIndex).toBe(-1);
    s.hand = hand('card-laser-burst');
    playCard(s, 0);
    expect(s.phaseIndex).toBe(0);
    expect(s.intentIndex).toBe(0);
    expect(currentIntent(s).name).toBe(enemy.phases![0].intents[0].name);
  });

  it('phase 2 sheds armor (Gatemaw: armor goes to 0)', () => {
    const run = gunshipRun();
    const state = createCombat(run, GATEMAW);
    const enemy = getEnemy(GATEMAW);
    expect(state.enemyArmor).toBe(enemy.armor!.amount);
    // Trigger phase transition
    state.enemyHp = Math.floor(enemy.maxHp * enemy.phases![0].belowHpFraction) + 1;
    state.enemyArmor = 0;
    state.hand = hand('card-laser-burst');
    playCard(state, 0);
    expect(state.phaseIndex).toBe(0);
    // Phase 2 armor is { amount: 0, regen: 0 }
    expect(state.enemyArmor).toBe(0);
    // After endTurn, armor stays at 0 (phase 2 regen is 0)
    endTurn(state);
    expect(state.enemyArmor).toBe(0);
  });

  it('Gatemaw is an anchor with toll=999 (effectively unpayable)', () => {
    const run = gunshipRun();
    run.resources.scrap = 50;
    const state = createCombat(run, GATEMAW, {
      distance: 10,
      progressAtStart: 0,
      malfunctioning: [],
    });
    expect(isTravelAnchored(state)).toBe(true);
    expect(canPayToll(state)).toBe(false);
  });

  it('no-lane boss fight has no escape-by-arrival', () => {
    const state = createCombat(gunshipRun(), GATEMAW);
    expect(state.lane).toBeNull();
    endTurn(state);
    expect(state.travelProgress).toBe(0);
    expect(state.outcome).toBe('ongoing');
  });
});

describe('enemy organs (GDD §5.4)', () => {
  const spores = (state: CombatState): number =>
    [...state.drawPile, ...state.hand, ...state.discardPile].filter(
      (c) => c.cardId === 'card-spore-cluster',
    ).length;

  it('initializes organ HP from the enemy parts; non-organ enemies have none', () => {
    expect(createCombat(gunshipRun(), GATEMAW).partHp).toEqual([18, 22]);
    expect(createCombat(gunshipRun(), LAMPREY).partHp).toEqual([]);
  });

  it('the Spore-Sac injects a spore each enemy turn while alive', () => {
    const state = createCombat(gunshipRun('organs'), GATEMAW);
    endTurn(state);
    expect(spores(state)).toBe(1);
  });

  it('destroying the Spore-Sac stops injection and staggers the enemy', () => {
    const state = createCombat(gunshipRun('organs'), GATEMAW);
    state.partHp[0] = 4;
    selectTarget(state, 0);
    state.hand = hand('card-missile-salvo'); // 8 → kills the 4-HP sac
    playCard(state, 0);
    expect(state.partHp[0]).toBe(0);
    expect(state.staggered).toBe(true);
    const hullBefore = state.hullHp;
    endTurn(state); // staggered: no enemy attack; sac dead: no spore
    expect(state.hullHp).toBe(hullBefore);
    expect(spores(state)).toBe(0);
    expect(state.staggered).toBe(false);
  });

  it('armor regrows while the Armor-Node lives, and stops once it dies', () => {
    const state = createCombat(gunshipRun('organs'), GATEMAW);
    state.enemyArmor = 2;
    endTurn(state); // armor-node alive → +3 regrow (capped 8)
    expect(state.enemyArmor).toBe(5);

    state.partHp[1] = 5;
    selectTarget(state, 1);
    state.hand = hand('card-missile-salvo'); // 8 → kills the armor-node
    playCard(state, 0);
    expect(state.partHp[1]).toBe(0);
    expect(state.armorBroken).toBe(true);
    expect(state.enemyArmor).toBe(0); // break-armor zeroes it

    state.enemyArmor = 2;
    endTurn(state); // armor-node dead → no regrow
    expect(state.enemyArmor).toBe(2);
  });

  it('Cleave hits the core and every living organ at once', () => {
    const state = createCombat(gunshipRun('organs'), GATEMAW);
    const coreBefore = state.enemyHp;
    state.hand = hand('card-scatter-shell'); // 6 to all, piercing (bypasses armor)
    playCard(state, 0);
    expect(state.enemyHp).toBe(coreBefore - 6);
    expect(state.partHp).toEqual([12, 16]);
  });

  it('single-target fire hits only the selected organ; the default is the core', () => {
    const state = createCombat(gunshipRun('organs'), GATEMAW);
    expect(state.targetPart).toBeNull();
    const coreBefore = state.enemyHp;
    selectTarget(state, 1);
    state.hand = hand('card-missile-salvo'); // 8, organs have no armor
    playCard(state, 0);
    expect(state.partHp[1]).toBe(22 - 8);
    expect(state.partHp[0]).toBe(18);
    expect(state.enemyHp).toBe(coreBefore);
  });

  it('the core can be killed with organs still alive (organs are pressure, not a gate)', () => {
    const state = createCombat(gunshipRun('organs'), GATEMAW);
    state.enemyHp = 5;
    state.enemyArmor = 0;
    state.hand = hand('card-missile-salvo'); // 8 → core dies
    playCard(state, 0);
    expect(state.enemyHp).toBe(0);
    expect(state.outcome).toBe('victory');
    expect(state.partHp[0]).toBeGreaterThan(0);
  });

  it('selectTarget ignores a dead organ', () => {
    const state = createCombat(gunshipRun('organs'), GATEMAW);
    state.partHp[0] = 0;
    selectTarget(state, 0);
    expect(state.targetPart).toBeNull();
  });

  it('Tracer Lock marks the focused organ, not the core or other organs', () => {
    const state = createCombat(gunshipRun('organs'), GATEMAW);
    selectTarget(state, 1);
    state.hand = hand('card-tracer-lock');
    playCard(state, 0);
    expect(state.partStatuses[1]).toEqual([{ id: 'status-marked', magnitude: 2 }]);
    expect(state.partStatuses[0]).toEqual([]);
    expect(state.coreStatuses).toEqual([]);
    // A hit on the marked organ takes the +2; the core (unmarked) does not.
    state.hand = hand('card-missile-salvo'); // 8
    playCard(state, 0);
    expect(state.partHp[1]).toBe(22 - 10); // 8 + 2 marked
  });

  it('a mark on one organ does not help hits against the core', () => {
    const state = createCombat(gunshipRun('organs'), GATEMAW);
    state.coreStatuses.push({ id: 'status-marked', magnitude: 2 });
    const coreBefore = state.enemyHp;
    state.enemyArmor = 0;
    selectTarget(state, 0);
    state.hand = hand('card-missile-salvo'); // 8 → organ 0, which is unmarked
    playCard(state, 0);
    expect(state.partHp[0]).toBe(18 - 8); // no mark bonus on this organ
    expect(state.enemyHp).toBe(coreBefore); // core untouched
  });
});
