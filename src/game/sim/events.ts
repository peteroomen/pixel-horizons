import { EVENT_DEFS, getEvent } from '../data';
import type { EventDef, EventOutcome } from '../data';
import { deriveRng } from './rng';
import { STARTING_HULL_HP } from './run-state';
import type { RunState } from './run-state';

/**
 * Event resolution (GDD §4.4). Like the sector map (ADR 005), an event is a PURE
 * FUNCTION of (seed, sector, nodeId) on its own derived stream — never serialized, so a
 * resumed run lands on the same event at the same node. `applyEventChoice` mutates the
 * RunState, validating its inputs with the same loud-failure policy as economy.ts.
 */

/** The event a given node presents — deterministic per (seed, sector, nodeId). */
export function pickEvent(seed: string, sector: number, nodeId: string): EventDef {
  const rng = deriveRng(seed, `event-${sector}-${nodeId}`);
  return rng.pick(EVENT_DEFS);
}

/** Whether the choice at `choiceIndex` needs the player to pick an installed module. */
export function eventChoiceNeedsModule(eventId: string, choiceIndex: number): boolean {
  const choice = getEvent(eventId).choices[choiceIndex];
  if (choice === undefined) {
    throw new Error(`no choice ${choiceIndex} on event ${eventId}`);
  }
  return choice.requiresModuleTarget === true;
}

/**
 * Applies an event choice to the run, in place. `moduleIndex` is required when the choice
 * attaches a modifier (GDD §6.6); resource costs are clamped at 0, hull at [0, max].
 */
export function applyEventChoice(
  run: RunState,
  eventId: string,
  choiceIndex: number,
  moduleIndex?: number,
): void {
  const choice = getEvent(eventId).choices[choiceIndex];
  if (choice === undefined) {
    throw new Error(`no choice ${choiceIndex} on event ${eventId}`);
  }
  if (choice.requiresModuleTarget === true) {
    if (
      moduleIndex === undefined ||
      !Number.isInteger(moduleIndex) ||
      moduleIndex < 0 ||
      moduleIndex >= run.modules.length
    ) {
      throw new Error(`choice ${choiceIndex} on ${eventId} needs a valid module target`);
    }
  }
  for (const outcome of choice.outcomes) {
    applyOutcome(run, outcome, moduleIndex);
  }
}

function applyOutcome(run: RunState, outcome: EventOutcome, moduleIndex?: number): void {
  switch (outcome.kind) {
    case 'gain-resources':
      run.resources[outcome.resource] += outcome.amount;
      break;
    case 'lose-resources':
      run.resources[outcome.resource] = Math.max(
        0,
        run.resources[outcome.resource] - outcome.amount,
      );
      break;
    case 'gain-module-to-cargo':
      run.cargo.push({ id: outcome.moduleId, tier: 1 });
      break;
    case 'repair-hull':
      run.hullHp = Math.min(STARTING_HULL_HP, run.hullHp + outcome.amount);
      break;
    case 'damage-hull':
      run.hullHp = Math.max(0, run.hullHp - outcome.amount);
      break;
    case 'attach-modifier': {
      // moduleIndex is validated by applyEventChoice for module-target choices.
      const target = run.modules[moduleIndex as number];
      const modifiers = target.modifiers ?? [];
      if (!modifiers.includes(outcome.modifierId)) {
        target.modifiers = [...modifiers, outcome.modifierId];
      }
      break;
    }
    case 'nothing':
      break;
    default: {
      const exhaustive: never = outcome;
      throw new Error(`unhandled event outcome: ${JSON.stringify(exhaustive)}`);
    }
  }
}
