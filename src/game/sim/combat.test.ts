import { describe, expect, it } from 'vitest';

import { BASELINE_AP, getCard, getEnemy, HAND_SIZE } from '../data';
import type { CombatState } from './combat';
import { applyCombatResult, createCombat, currentIntent, endTurn, playCard } from './combat';
import { generateDeck } from './deck';
import { restoreRng } from './rng';
import { createRunState } from './run-state';
import type { RunState } from './run-state';

const LAMPREY = 'enemy-lamprey';

function gunshipRun(seed = 'combat-test'): RunState {
  return createRunState(seed, 'hull-gunship');
}

function scoutRun(seed = 'combat-test'): RunState {
  return createRunState(seed, 'hull-scout');
}

function findInHand(state: CombatState, cardId: string): number {
  const index = state.hand.indexOf(cardId);
  if (index === -1) {
    throw new Error(`${cardId} not in hand: ${state.hand.join(', ')}`);
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
        const index = state.hand.indexOf(cardId);
        if (index !== -1 && getCard(cardId).apCost <= state.ap) {
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
    expect([...state.hand, ...state.drawPile].sort()).toEqual([...deck].sort());
    expect([...state.hand, ...state.drawPile]).not.toEqual(deck);
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

  it('different seeds shuffle differently', () => {
    const a = createCombat(gunshipRun('seed-a'), LAMPREY);
    const b = createCombat(gunshipRun('seed-b'), LAMPREY);
    expect([...a.hand, ...a.drawPile]).not.toEqual([...b.hand, ...b.drawPile]);
  });
});

describe('playCard', () => {
  it('pays AP, applies damage, and discards the card', () => {
    const state = createCombat(gunshipRun(), LAMPREY);
    state.hand = ['card-missile-salvo'];
    playCard(state, 0);
    expect(state.ap).toBe(BASELINE_AP - 2);
    expect(state.enemyHp).toBe(getEnemy(LAMPREY).maxHp - 8);
    expect(state.hand).toEqual([]);
    expect(state.discardPile).toContain('card-missile-salvo');
  });

  it('exhausted cards go to the exhaust pile, not the discard pile', () => {
    const state = createCombat(gunshipRun(), LAMPREY);
    state.hand = ['card-emergency-barrier'];
    playCard(state, 0);
    expect(state.tempShieldLayers).toBe(1);
    expect(state.exhaustPile).toEqual(['card-emergency-barrier']);
    expect(state.discardPile).not.toContain('card-emergency-barrier');
  });

  it('throws on insufficient AP, bad index, and after the fight ended', () => {
    const state = createCombat(gunshipRun(), LAMPREY);
    state.hand = ['card-missile-salvo'];
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
    state.hand = ['card-lock-on', 'card-overcharge', 'card-missile-salvo'];
    playCard(state, findInHand(state, 'card-lock-on'));
    playCard(state, findInHand(state, 'card-overcharge'));
    playCard(state, findInHand(state, 'card-missile-salvo'));
    expect(state.enemyHp).toBe(0);
    expect(state.outcome).toBe('victory');
  });
});

describe('card effects', () => {
  function fresh(cards: string[], ap = BASELINE_AP): CombatState {
    const state = createCombat(gunshipRun(), LAMPREY);
    state.hand = [...cards];
    state.ap = ap;
    return state;
  }

  it('buff-next-attack is flat and consumed by the next damage effect', () => {
    const state = fresh(['card-lock-on', 'card-missile-salvo']);
    playCard(state, 0);
    expect(state.modifiers.nextAttackBonus).toBe(3);
    playCard(state, 0);
    expect(state.enemyHp).toBe(getEnemy(LAMPREY).maxHp - 11);
    expect(state.modifiers.nextAttackBonus).toBe(0);
  });

  it('amplify-next-attack multiplies and is consumed', () => {
    const state = fresh(['card-overcharge', 'card-cannon-burst']);
    playCard(state, 0);
    // First hit doubled (3 × 2), second hit plain — modifiers are per-hit, not per-card.
    playCard(state, 0);
    expect(state.enemyHp).toBe(getEnemy(LAMPREY).maxHp - 9);
    expect(state.modifiers.nextAttackMultiplier).toBe(1);
  });

  it('vulnerable adds to every hit for the rest of the fight', () => {
    const state = fresh(['card-tracer-lock', 'card-cannon-burst']);
    playCard(state, 0);
    playCard(state, 0);
    expect(state.enemyHp).toBe(getEnemy(LAMPREY).maxHp - 10);
    expect(state.modifiers.enemyVulnerable).toBe(2);
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
    expect(state.exhaustPile).toEqual(['card-resource-ping']);
  });

  it('reveal-intent flags the telegraphed intent until end of turn', () => {
    const state = fresh(['card-deep-scan']);
    playCard(state, 0);
    expect(state.modifiers.intentRevealed).toBe(true);
    endTurn(state);
    expect(state.modifiers.intentRevealed).toBe(false);
  });

  it('out-of-slice effects throw loudly with their target slice', () => {
    expect(() => playCard(fresh(['card-kinetic-shred']), 0)).toThrow('2.5');
    expect(() => playCard(fresh(['card-repair-clone']), 0)).toThrow('2.3');
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
    state.hand = ['card-reinforce'];
    playCard(state, 0);
    expect(state.shields.map((l) => l.turnsUntilUp).sort()).toEqual([0, 2]);
  });

  it('temp layers absorb before regular layers and never recharge', () => {
    const state = createCombat(gunshipRun(), LAMPREY);
    state.hand = ['card-emergency-barrier'];
    playCard(state, 0);
    endTurn(state); // Frenzy: hit 1 → temp layer, hit 2 → one regular layer
    expect(state.tempShieldLayers).toBe(0);
    expect(state.hullHp).toBe(100);
    expect(state.shields.map((l) => l.turnsUntilUp).sort()).toEqual([0, 2]);
  });

  it('dodge rolls the combat stream per incoming hit, then expires', () => {
    const state = createCombat(scoutRun('dodge-seed'), LAMPREY);
    state.hand = ['card-ghost-shift'];
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
    state.hand = ['card-phase-walk'];
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
  it('discards unplayed cards and redraws to 5', () => {
    const state = createCombat(gunshipRun(), LAMPREY);
    const unplayed = [...state.hand];
    endTurn(state);
    expect(state.hand.length).toBe(HAND_SIZE);
    expect(state.turn).toBe(2);
    expect(state.ap).toBe(BASELINE_AP);
    for (const cardId of unplayed) {
      expect(state.discardPile).toContain(cardId);
    }
  });

  it('retain keeps the leftmost cards through the discard step', () => {
    const state = createCombat(gunshipRun(), LAMPREY);
    state.hand = [
      'card-desync-hull',
      'card-missile-salvo',
      'card-flak-volley',
      'card-cannon-burst',
      'card-reinforce',
    ];
    playCard(state, 0); // Desync Hull: 0 AP, retain 1
    endTurn(state);
    expect(state.hand[0]).toBe('card-missile-salvo');
    expect(state.hand.length).toBe(HAND_SIZE);
    expect(state.modifiers.retainCount).toBe(0);
  });

  it('reshuffles the discard pile when the draw pile empties; exhaust stays out', () => {
    const state = createCombat(gunshipRun(), LAMPREY);
    state.hand = [];
    state.drawPile = [];
    state.discardPile = ['card-burn', 'card-burn'];
    state.exhaustPile = ['card-emergency-barrier'];
    endTurn(state);
    expect([...state.hand].sort()).toEqual(['card-burn', 'card-burn']);
    expect(state.discardPile).toEqual([]);
    expect(state.exhaustPile).toEqual(['card-emergency-barrier']);
  });

  it('a deck too small for a full hand deals a short hand without error', () => {
    const run = scoutRun('tiny');
    run.modules = ['mod-standard-print-matrix'];
    const state = createCombat(run, LAMPREY);
    expect(state.hand).toEqual(['card-telemetry-sync']);
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

  it('consecutive fights continue the combat stream instead of replaying it', () => {
    const run = gunshipRun('stream');
    const first = createCombat(run, LAMPREY);
    const firstOpening = [...first.hand, ...first.drawPile];
    autoplay(first);
    applyCombatResult(run, first);
    const second = createCombat(run, LAMPREY);
    const secondOpening = [...second.hand, ...second.drawPile];
    expect(secondOpening).not.toEqual(firstOpening);
    expect(secondOpening.sort()).toEqual(firstOpening.sort());
  });
});
