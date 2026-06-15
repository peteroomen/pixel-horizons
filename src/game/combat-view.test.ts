import { describe, expect, it } from 'vitest';

import { buildCombatView } from './combat-view';
import { getEnemy, MALFUNCTION_REPAIR_AP } from './data';
import type { CombatCard } from './sim/deck';
import { activateInnate, createCombat, endTurn, playCard } from './sim/combat';
import type { CombatState } from './sim/combat';
import { createRunState, STARTING_HULL_HP } from './sim/run-state';

const LAMPREY = 'enemy-lamprey';
const PARASITE = 'enemy-parasite';
const SPORECASTER = 'enemy-sporecaster';

function gunshipCombat(seed = 'view-test') {
  return createCombat(createRunState(seed, 'hull-gunship'), LAMPREY);
}

/** Fabricates hand instances for scripted tests; module 0 unless a test flips it. */
function hand(...cardIds: string[]): CombatCard[] {
  return cardIds.map((cardId) => ({ cardId, moduleIndex: 0, malfunctioning: false }));
}

/** Flags every card instance of a module across all of a state's piles (GDD §5.6). */
function flagModule(state: CombatState, moduleIndex: number): void {
  for (const pile of [state.drawPile, state.hand, state.discardPile, state.exhaustPile]) {
    for (const card of pile) {
      if (card.moduleIndex === moduleIndex) {
        card.malfunctioning = true;
      }
    }
  }
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
    state.hand = [
      { cardId: 'card-flak-volley', moduleIndex: 0, malfunctioning: true }, // Flak Array down
      { cardId: 'card-missile-salvo', moduleIndex: 1, malfunctioning: false },
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
    flagModule(state, 1);
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

  it('always telegraphs the intent kind and name; numbers wait for Deep Scan', () => {
    const state = gunshipCombat();
    expect(buildCombatView(state).intent).toEqual({
      kind: 'attack',
      name: 'Feeding Frenzy',
      detail: null,
    });
    state.modifiers.intentRevealed = true;
    expect(buildCombatView(state).intent.detail).toEqual({
      kind: 'attack',
      amount: 4,
      hits: 2,
      piercing: false,
    });
  });

  it('reveals module-hunting intents with their targeting', () => {
    const state = createCombat(createRunState('view-test', 'hull-gunship'), PARASITE);
    expect(buildCombatView(state).intent.kind).toBe('attack-module');
    state.modifiers.intentRevealed = true;
    expect(buildCombatView(state).intent.detail).toEqual({
      kind: 'attack-module',
      amount: 3,
      piercing: false,
      targeting: 'highest-value',
    });
  });

  it('reveals inject intents with the card name and count', () => {
    const state = createCombat(createRunState('view-test', 'hull-gunship'), SPORECASTER);
    expect(buildCombatView(state).intent).toEqual({
      kind: 'inject',
      name: 'Spore Burst',
      detail: null,
    });
    state.modifiers.intentRevealed = true;
    expect(buildCombatView(state).intent.detail).toEqual({
      kind: 'inject',
      cardName: 'Spore Cluster',
      count: 2,
    });
  });

  it('projects the enemy armor pool', () => {
    const carapace = createCombat(createRunState('view-test', 'hull-gunship'), 'enemy-carapace');
    expect(buildCombatView(carapace).enemyArmor).toBe(5);
    expect(buildCombatView(gunshipCombat()).enemyArmor).toBe(0);
  });

  it('renders injected Infestations as unplayable', () => {
    const state = createCombat(createRunState('view-test', 'hull-gunship'), SPORECASTER);
    state.hand = [{ cardId: 'card-spore-cluster', moduleIndex: null, malfunctioning: false }];
    const [card] = buildCombatView(state).hand;
    expect(card.name).toBe('Spore Cluster');
    expect(card.unplayable).toBe(true);
    expect(card.affordable).toBe(false);
    expect(card.malfunction).toBe(false);
    // Jettison is the escape valve for the clog (GDD §5.6) — it reads on the card.
    expect(card.text).toBe('Unplayable · Drawn: −1 shield layer · Jettison to clear');
    expect(card.jettisonable).toBe(true);
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

describe('lane and anchor projection', () => {
  it('shows lane-absolute travel and null outside a lane', () => {
    const bare = buildCombatView(gunshipCombat());
    expect(bare.travel).toBeNull();

    const state = createCombat(createRunState('lane-view', 'hull-gunship'), LAMPREY, {
      distance: 9,
      progressAtStart: 2,
      malfunctioning: [],
    });
    endTurn(state);
    const view = buildCombatView(state);
    expect(view.travel).toEqual({ progress: 3, distance: 9 });
  });

  it('surfaces the anchor with toll cost and affordability', () => {
    const run = createRunState('anchor-view', 'hull-gunship');
    const state = createCombat(run, 'enemy-anchormaw', {
      distance: 9,
      progressAtStart: 0,
      malfunctioning: [],
    });
    const broke = buildCombatView(state);
    expect(broke.anchor).toEqual({ tollScrap: 5, payable: false });

    state.scrapGained = 6;
    const funded = buildCombatView(state);
    expect(funded.anchor).toEqual({ tollScrap: 5, payable: true });
    expect(funded.scrap).toBe(6);

    state.enemyHp = 0;
    expect(buildCombatView(state).anchor).toBeNull();
  });

  it('non-anchor enemies project no anchor', () => {
    expect(buildCombatView(gunshipCombat()).anchor).toBeNull();
  });
});
