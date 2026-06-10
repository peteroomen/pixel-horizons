import { getCard, getEnemy } from './data';
import type { CardEffect } from './data';
import type { CombatOutcome, CombatState } from './sim/combat';
import { currentIntent } from './sim/combat';
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
}

export interface ShieldLayerView {
  up: boolean;
  /** Enemy phases until the layer is back up; 0 while up. */
  turnsUntilUp: number;
}

export interface RevealedIntent {
  name: string;
  amount: number;
  hits: number;
  piercing: boolean;
}

export interface CombatView {
  turn: number;
  ap: number;
  apPerTurn: number;
  hullHp: number;
  hullMaxHp: number;
  shields: ShieldLayerView[];
  tempShieldLayers: number;
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
    enemyName: enemy.name,
    enemyHp: state.enemyHp,
    enemyMaxHp: enemy.maxHp,
    intent: state.modifiers.intentRevealed
      ? {
          name: intent.name,
          amount: intent.amount,
          hits: intent.hits ?? 1,
          piercing: intent.piercing === true,
        }
      : null,
    hand: state.hand.map((cardId, index) => {
      const card = getCard(cardId);
      return {
        key: `${cardId}@${index}`,
        id: cardId,
        name: card.name,
        apCost: card.apCost,
        text: card.effects.map(describeEffect).join(' · '),
        exhaust: card.exhaust === true,
        affordable: state.outcome === 'ongoing' && card.apCost <= state.ap,
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
