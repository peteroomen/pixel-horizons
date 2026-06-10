import { describe, expect, it } from 'vitest';

import { buildCombatView } from './combat-view';
import { getEnemy, MALFUNCTION_REPAIR_AP } from './data';
import type { CombatCard } from './sim/deck';
import { activateInnate, createCombat, endTurn, playCard } from './sim/combat';
import { createRunState, STARTING_HULL_HP } from './sim/run-state';

const LAMPREY = 'enemy-lamprey';
const PARASITE = 'enemy-parasite';

function gunshipCombat(seed = 'view-test') {
  return createCombat(createRunState(seed, 'hull-gunship'), LAMPREY);
}

/** Fabricates hand instances for scripted tests; module 0 unless a test flips it. */
function hand(...cardIds: string[]): CombatCard[] {
  return cardIds.map((cardId) => ({ cardId, moduleIndex: 0 }));
}

describe('buildCombatView', () => {
  it('mirrors the combat state for the HUD', () => {
    const state = gunshipCombat();
    const view = buildCombatView(state);
    expect(view.turn).toBe(1);
    expect(view.ap).toBe(state.ap);
    expect(view.hullHp).toBe(STARTING_HULL_HP);
    expect(view.hullMaxHp).toBe(STARTING_HULL_HP);
    expect(view.enemyName).toBe('Lamprey');
    expect(view.enemyMaxHp).toBe(getEnemy(LAMPREY).maxHp);
    expect(view.shields).toEqual([
      { up: true, turnsUntilUp: 0 },
      { up: true, turnsUntilUp: 0 },
    ]);
    expect(view.hand.length).toBe(state.hand.length);
    expect(view.drawCount).toBe(state.drawPile.length);
    expect(view.discardCount).toBe(0);
    expect(view.outcome).toBe('ongoing');
  });

  it('derives card text from effect data', () => {
    const state = gunshipCombat();
    state.hand = hand('card-cannon-burst', 'card-flak-volley', 'card-emergency-barrier');
    const [burst, flak, barrier] = buildCombatView(state).hand;
    expect(burst.text).toBe('Deal 3 · Deal 3');
    expect(flak.text).toBe('Deal 6 piercing');
    expect(barrier.text).toBe('+1 temp shield layer');
    expect(barrier.exhaust).toBe(true);
    expect(burst.exhaust).toBe(false);
  });

  it('gives duplicate cards distinct keys', () => {
    const state = gunshipCombat();
    state.hand = hand('card-cannon-burst', 'card-cannon-burst');
    const keys = buildCombatView(state).hand.map((c) => c.key);
    expect(new Set(keys).size).toBe(2);
  });

  it('flags unaffordable cards, and every card once the fight ends', () => {
    const state = gunshipCombat();
    state.hand = hand('card-lock-on', 'card-missile-salvo');
    state.ap = 1;
    const view = buildCombatView(state);
    expect(view.hand.map((c) => c.affordable)).toEqual([true, false]);

    state.outcome = 'victory';
    const ended = buildCombatView(state);
    expect(ended.hand.every((c) => !c.affordable)).toBe(true);
  });

  it('presents a flipped card as its Malfunction form (GDD §5.6)', () => {
    const state = gunshipCombat();
    state.malfunctioning = [0]; // Flak Array
    state.hand = [
      { cardId: 'card-flak-volley', moduleIndex: 0 },
      { cardId: 'card-missile-salvo', moduleIndex: 1 },
    ];
    const [damaged, normal] = buildCombatView(state).hand;
    expect(damaged.malfunction).toBe(true);
    expect(damaged.name).toBe('Damaged Flak Array');
    expect(damaged.text).toBe('Field-repair');
    expect(damaged.apCost).toBe(MALFUNCTION_REPAIR_AP);
    expect(damaged.exhaust).toBe(false);
    expect(damaged.affordable).toBe(true);
    expect(normal.malfunction).toBe(false);
    expect(normal.name).toBe('Missile Salvo');
  });

  it('lists modules with their malfunction status', () => {
    const state = gunshipCombat();
    state.malfunctioning = [1];
    const view = buildCombatView(state);
    expect(view.modules.map((m) => m.name)).toEqual([
      'Flak Array',
      'Missile Pod',
      'Autocannon',
      'Shield Generator',
      'Standard Print Matrix',
    ]);
    expect(view.modules.map((m) => m.malfunctioning)).toEqual([false, true, false, false, false]);
  });

  it('projects the hull innate with its usability', () => {
    const state = gunshipCombat();
    const view = buildCombatView(state);
    expect(view.innate.name).toBe('Point-Defense');
    expect(view.innate.apCost).toBe(1);
    expect(view.innate.usable).toBe(true);
    expect(view.innate.requiresCardTarget).toBe(false);
    expect(view.innate.passive).toBe(false);

    activateInnate(state);
    expect(buildCombatView(state).innate.usable).toBe(false);
  });

  it('marks card-targeted and passive innates for the UI', () => {
    const scout = createCombat(createRunState('view-test', 'hull-scout'), LAMPREY);
    expect(buildCombatView(scout).innate.requiresCardTarget).toBe(true);

    const freighter = createCombat(createRunState('view-test', 'hull-freighter'), LAMPREY);
    const innate = buildCombatView(freighter).innate;
    expect(innate.passive).toBe(true);
    expect(innate.usable).toBe(false);
  });

  it('hides the intent until Deep Scan reveals it', () => {
    const state = gunshipCombat();
    expect(buildCombatView(state).intent).toBeNull();
    state.modifiers.intentRevealed = true;
    expect(buildCombatView(state).intent).toEqual({
      name: 'Feeding Frenzy',
      amount: 4,
      hits: 2,
      piercing: false,
      targetsModule: null,
    });
  });

  it('reveals module-hunting intents with their targeting', () => {
    const state = createCombat(createRunState('view-test', 'hull-gunship'), PARASITE);
    state.modifiers.intentRevealed = true;
    expect(buildCombatView(state).intent).toEqual({
      name: 'Burrow',
      amount: 3,
      hits: 1,
      piercing: false,
      targetsModule: 'highest-value',
    });
  });

  it('reflects shield recharge after a layer absorbs a hit', () => {
    const state = gunshipCombat();
    endTurn(state); // Feeding Frenzy: 2 hits, both eaten by the two layers
    const view = buildCombatView(state);
    expect(view.shields.filter((layer) => !layer.up).length).toBe(2);
    expect(view.shields[0].turnsUntilUp).toBeGreaterThan(0);
    expect(view.hullHp).toBe(STARTING_HULL_HP);
  });

  it('tracks AP and piles as cards are played', () => {
    const state = gunshipCombat();
    state.hand = hand('card-missile-salvo');
    playCard(state, 0);
    const view = buildCombatView(state);
    expect(view.ap).toBe(1);
    expect(view.hand).toEqual([]);
    expect(view.discardCount).toBe(1);
  });
});
