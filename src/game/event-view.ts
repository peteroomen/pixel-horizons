import { getModifier, getModule } from './data';
import type { EventDef, EventOutcome, ResourceKind } from './data';
import type { RunState } from './sim/run-state';

/**
 * Projects an EventDef + RunState into a render-ready view (like combat-view / map-view):
 * pure and presentational, the sim never depends on it. Carries per-choice affordability
 * so the screen can disable a choice the player can't pay for.
 */

export interface EventChoiceView {
  label: string;
  description: string;
  outcomes: string[];
  requiresModuleTarget: boolean;
  affordable: boolean;
}

export interface EventView {
  eventId: string;
  title: string;
  body: string;
  choices: EventChoiceView[];
}

const RESOURCE_LABELS: Record<ResourceKind, string> = {
  scrap: 'Scrap',
  biominerals: 'Bio',
  coreCrystals: 'Cores',
  blueprints: 'Blueprints',
};

export function buildEventView(run: RunState, event: EventDef): EventView {
  return {
    eventId: event.id,
    title: event.title,
    body: event.body,
    choices: event.choices.map((choice) => ({
      label: choice.label,
      description: choice.description,
      outcomes: choice.outcomes.map(describeOutcome),
      requiresModuleTarget: choice.requiresModuleTarget === true,
      affordable: choice.outcomes.every((o) => canAfford(run, o)),
    })),
  };
}

function canAfford(run: RunState, outcome: EventOutcome): boolean {
  return outcome.kind !== 'lose-resources' || run.resources[outcome.resource] >= outcome.amount;
}

function describeOutcome(outcome: EventOutcome): string {
  switch (outcome.kind) {
    case 'gain-resources':
      return `+${outcome.amount} ${RESOURCE_LABELS[outcome.resource]}`;
    case 'lose-resources':
      return `−${outcome.amount} ${RESOURCE_LABELS[outcome.resource]}`;
    case 'gain-module-to-cargo':
      return `Gain ${getModule(outcome.moduleId).name}`;
    case 'repair-hull':
      return `Repair ${outcome.amount} hull`;
    case 'damage-hull':
      return `−${outcome.amount} hull`;
    case 'attach-modifier':
      return `Attach ${getModifier(outcome.modifierId).name}`;
    case 'nothing':
      return 'Nothing';
    default: {
      const exhaustive: never = outcome;
      throw new Error(`unhandled event outcome: ${JSON.stringify(exhaustive)}`);
    }
  }
}
