import { getCard, getEnemy, getHull, getModule, MALFUNCTION_REPAIR_AP } from './data';
import type { CardDef, CardEffect, EnemyIntentDef, ModuleTargeting, OnDrawEffect } from './data';
import type { CombatOutcome, CombatState } from './sim/combat';
import {
  canPayToll,
  canUseInnate,
  cardPlayCost,
  currentIntent,
  isCardMalfunctioning,
  isModuleMalfunctioning,
} from './sim/combat';
import { STARTING_HULL_HP } from './sim/run-state';

/**
 * Projects a CombatState into a render-ready view. Lives one level above sim/ (like
 * save.ts): pure and unit-testable, but presentational — the sim never depends on it.
 * React components receive CombatView through main.ts callbacks and never touch
 * CombatState directly.
 */

export interface CardView {
  /** Unique within the hand (duplicates share a CardId) — stable enough for React keys. */
  key: string;
  id: string;
  name: string;
  apCost: number;
  text: string;
  exhaust: boolean;
  affordable: boolean;
  /** Flipped to its Malfunction form — playing it field-repairs the module (GDD §5.6). */
  malfunction: boolean;
  /** Infestation hand-clog (GDD §5.6) — renders inert, tapping does nothing. */
  unplayable: boolean;
  /** Bloom infestation card — green frame, no AP chip. Set by a future Bloom slice. */
  infested?: boolean;
}

export interface ShieldLayerView {
  up: boolean;
  /** Enemy phases until the layer is back up; 0 while up. */
  turnsUntilUp: number;
}

export interface ModuleView {
  name: string;
  malfunctioning: boolean;
}

export interface InnateView {
  name: string;
  description: string;
  /** 0 for innates that cost no AP (Slipstream, Auxiliary Router). */
  apCost: number;
  usable: boolean;
  /** Discard-to-draw needs a card picked — the UI arms the innate, then takes a card tap. */
  requiresCardTarget: boolean;
  /** Passive innates (Salvage Rig) render as a label, never a button. */
  passive: boolean;
}

/** Exact numbers behind Deep Scan — discriminated per intent kind. */
export type IntentDetail =
  | { kind: 'attack'; amount: number; hits: number; piercing: boolean }
  | { kind: 'attack-module'; amount: number; piercing: boolean; targeting: ModuleTargeting }
  | { kind: 'inject'; cardName: string; count: number };

/**
 * The telegraphed next enemy action (2.5 design call): the *shape* — kind and name —
 * is always visible, StS-style; `detail` carries the numbers and is non-null only
 * while Deep Scan's reveal is active. Free numbers would dead-card Deep Scan.
 */
export interface IntentView {
  kind: EnemyIntentDef['kind'];
  name: string;
  detail: IntentDetail | null;
}

export interface CombatView {
  turn: number;
  ap: number;
  apPerTurn: number;
  hullHp: number;
  hullMaxHp: number;
  shields: ShieldLayerView[];
  tempShieldLayers: number;
  modules: ModuleView[];
  innate: InnateView;
  enemyName: string;
  enemyHp: number;
  enemyMaxHp: number;
  /** Bulwark armor pool currently up (GDD §5.7); 0 for unarmored enemies. */
  enemyArmor: number;
  intent: IntentView;
  hand: CardView[];
  drawCount: number;
  discardCount: number;
  /** Lane-absolute progress so the display doesn't reset per fight; null outside a lane. */
  travel: { progress: number; distance: number } | null;
  /**
   * Non-null while an anchor enemy holds the lane (GDD §5.7). Always visible — the
   * latch is archetype state, not intent info; a halt you can't see is a stat drain.
   */
  anchor: { tollScrap: number; payable: boolean } | null;
  /** Run scrap as of right now (start-of-fight stock plus this fight's gains). */
  scrap: number;
  scrapGained: number;
  outcome: CombatOutcome;
  /** True for multi-phase boss enemies — drives scaled rendering and boss HUD plate. */
  boss: boolean;
  /** Current boss phase (-1 = base); null for non-boss enemies. */
  bossPhase: number | null;
}

export function buildCombatView(state: CombatState): CombatView {
  const enemy = getEnemy(state.enemyId);
  const intent = currentIntent(state);
  const innate = getHull(state.hullId).innateAbility;
  return {
    turn: state.turn,
    ap: state.ap,
    apPerTurn: state.apPerTurn,
    hullHp: state.hullHp,
    hullMaxHp: STARTING_HULL_HP,
    shields: state.shields.map((layer) => ({
      up: layer.turnsUntilUp === 0,
      turnsUntilUp: layer.turnsUntilUp,
    })),
    tempShieldLayers: state.tempShieldLayers,
    modules: state.modules.map((moduleId, index) => ({
      name: getModule(moduleId).name,
      malfunctioning: isModuleMalfunctioning(state, index),
    })),
    innate: {
      name: innate.name,
      description: innate.description,
      apCost: innate.effect.kind === 'damage' ? innate.effect.apCost : 0,
      usable: canUseInnate(state),
      requiresCardTarget: innate.effect.kind === 'discard-to-draw',
      passive: innate.uses === 'passive',
    },
    enemyName: enemy.name,
    enemyHp: state.enemyHp,
    enemyMaxHp: enemy.maxHp,
    enemyArmor: state.enemyArmor,
    intent: {
      kind: intent.kind,
      name: intent.name,
      detail: state.modifiers.intentRevealed ? describeIntentDetail(intent) : null,
    },
    hand: state.hand.map((instance, index) => {
      // A null moduleIndex (injected Infestation) can never present as malfunctioning.
      if (isCardMalfunctioning(instance) && instance.moduleIndex !== null) {
        const moduleDef = getModule(state.modules[instance.moduleIndex]);
        return {
          key: `${instance.cardId}@${index}`,
          id: instance.cardId,
          name: `Damaged ${moduleDef.name}`,
          apCost: MALFUNCTION_REPAIR_AP,
          // The name already says which module — short text keeps flipped cards from
          // growing taller than the rest of the hand on phone widths.
          text: 'Field-repair',
          exhaust: false,
          affordable: state.outcome === 'ongoing' && MALFUNCTION_REPAIR_AP <= state.ap,
          malfunction: true,
          unplayable: false,
        };
      }
      const card = getCard(instance.cardId);
      const unplayable = card.unplayable === true;
      return {
        key: `${instance.cardId}@${index}`,
        id: instance.cardId,
        name: card.name,
        apCost: card.apCost,
        text: describeCardText(card),
        exhaust: card.exhaust === true,
        affordable:
          !unplayable && state.outcome === 'ongoing' && cardPlayCost(state, instance) <= state.ap,
        malfunction: false,
        unplayable,
      };
    }),
    drawCount: state.drawPile.length,
    discardCount: state.discardPile.length,
    travel:
      state.lane === null
        ? null
        : {
            progress: Math.min(
              state.lane.distance,
              state.lane.progressAtStart + state.travelProgress,
            ),
            distance: state.lane.distance,
          },
    anchor:
      enemy.anchor !== undefined && state.enemyHp > 0
        ? { tollScrap: enemy.anchor.tollScrap, payable: canPayToll(state) }
        : null,
    scrap: state.scrapAtStart + state.scrapGained,
    scrapGained: state.scrapGained,
    outcome: state.outcome,
    boss: enemy.phases !== undefined && enemy.phases.length > 0,
    bossPhase: enemy.phases !== undefined && enemy.phases.length > 0 ? state.phaseIndex : null,
  };
}

function describeIntentDetail(intent: EnemyIntentDef): IntentDetail {
  switch (intent.kind) {
    case 'attack':
      return {
        kind: 'attack',
        amount: intent.amount,
        hits: intent.hits ?? 1,
        piercing: intent.piercing === true,
      };
    case 'attack-module':
      return {
        kind: 'attack-module',
        amount: intent.amount,
        piercing: intent.piercing === true,
        targeting: intent.targeting,
      };
    case 'inject':
      return { kind: 'inject', cardName: getCard(intent.cardId).name, count: intent.count };
    default: {
      const exhaustive: never = intent;
      throw new Error(`unhandled enemy intent: ${JSON.stringify(exhaustive)}`);
    }
  }
}

function describeCardText(card: CardDef): string {
  const parts = card.unplayable === true ? ['Unplayable'] : [];
  parts.push(...(card.onDraw ?? []).map(describeOnDraw), ...card.effects.map(describeEffect));
  return parts.join(' · ');
}

function describeOnDraw(effect: OnDrawEffect): string {
  switch (effect.kind) {
    case 'lose-shield-layer':
      return effect.count === 1
        ? 'Drawn: −1 shield layer'
        : `Drawn: −${effect.count} shield layers`;
    case 'gain-temp-shield':
      return effect.count === 1
        ? 'Drawn: +1 temp shield layer'
        : `Drawn: +${effect.count} temp shield layers`;
    default: {
      const exhaustive: never = effect;
      throw new Error(`unhandled on-draw effect: ${JSON.stringify(exhaustive)}`);
    }
  }
}

function describeEffect(effect: CardEffect): string {
  switch (effect.kind) {
    case 'damage': {
      const all = effect.target === 'all' ? ' to all' : '';
      const pierce = effect.piercing === true ? ' piercing' : '';
      return `Deal ${effect.amount}${all}${pierce}`;
    }
    case 'travel':
      return `+${effect.amount} travel`;
    case 'restore-shield-layer':
      return effect.count === 1
        ? 'Restore a shield layer'
        : `Restore ${effect.count} shield layers`;
    case 'temp-shield-layer':
      return effect.count === 1 ? '+1 temp shield layer' : `+${effect.count} temp shield layers`;
    case 'dodge-chance':
      return `${Math.round(effect.chance * 100)}% dodge this turn`;
    case 'untargetable':
      return effect.turns === 1 ? 'Untargetable 1 turn' : `Untargetable ${effect.turns} turns`;
    case 'buff-next-attack':
      return `Next attack +${effect.bonus}`;
    case 'amplify-next-attack':
      return `Next attack ×${effect.multiplier}`;
    case 'debuff-target-vulnerable':
      return `Enemy takes +${effect.amount} from every hit`;
    case 'reveal-intent':
      return 'Reveal enemy intent';
    case 'draw':
      return effect.count === 1 ? 'Draw a card' : `Draw ${effect.count} cards`;
    case 'gain-scrap':
      return `+${effect.amount} Scrap`;
    case 'strip-armor':
      return 'Strip armor';
    case 'repair-all-modules':
      return 'Repair all modules';
    default: {
      const exhaustive: never = effect;
      throw new Error(`unhandled card effect: ${JSON.stringify(exhaustive)}`);
    }
  }
}
