import { getCard, getEnemy, getHull, getModule, MALFUNCTION_REPAIR_AP } from './data';
import type { CardEffect, ModuleTargeting } from './data';
import type { CombatOutcome, CombatState } from './sim/combat';
import { canUseInnate, cardPlayCost, currentIntent, isCardMalfunctioning } from './sim/combat';
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

export interface RevealedIntent {
  name: string;
  amount: number;
  hits: number;
  piercing: boolean;
  /** Non-null when the hit also hunts a module (GDD §5.6). */
  targetsModule: ModuleTargeting | null;
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
  /** Null until Deep Scan reveals it — showing intents for free would dead-card Deep Scan. */
  intent: RevealedIntent | null;
  hand: CardView[];
  drawCount: number;
  discardCount: number;
  travelProgress: number;
  scrapGained: number;
  outcome: CombatOutcome;
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
      malfunctioning: state.malfunctioning.includes(index),
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
    intent: state.modifiers.intentRevealed
      ? {
          name: intent.name,
          amount: intent.amount,
          hits: intent.kind === 'attack' ? (intent.hits ?? 1) : 1,
          piercing: intent.piercing === true,
          targetsModule: intent.kind === 'attack-module' ? intent.targeting : null,
        }
      : null,
    hand: state.hand.map((instance, index) => {
      if (isCardMalfunctioning(state, instance)) {
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
        };
      }
      const card = getCard(instance.cardId);
      return {
        key: `${instance.cardId}@${index}`,
        id: instance.cardId,
        name: card.name,
        apCost: card.apCost,
        text: card.effects.map(describeEffect).join(' · '),
        exhaust: card.exhaust === true,
        affordable: state.outcome === 'ongoing' && cardPlayCost(state, instance) <= state.ap,
        malfunction: false,
      };
    }),
    drawCount: state.drawPile.length,
    discardCount: state.discardPile.length,
    travelProgress: state.travelProgress,
    scrapGained: state.scrapGained,
    outcome: state.outcome,
  };
}

function describeEffect(effect: CardEffect): string {
  switch (effect.kind) {
    case 'damage':
      return effect.piercing === true ? `Deal ${effect.amount} piercing` : `Deal ${effect.amount}`;
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
    case 'retain-cards':
      return effect.count === 1 ? 'Retain a card' : `Retain ${effect.count} cards`;
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
