import type { Application } from 'pixi.js';

import { createSpaceRenderer } from '@/renderer/space-renderer';
import type { SpaceRenderer } from '@/renderer/space-renderer';
import { buildCombatView } from '../combat-view';
import type { CombatView } from '../combat-view';
import { getHull } from '../data';
import type { EnemyId } from '../data';
import {
  activateInnate,
  applyCombatResult,
  canPayToll,
  canUseInnate,
  cardPlayCost,
  createCombat,
  endTurn,
  isCardPlayable,
  payToll,
  playCard,
} from '../sim/combat';
import type { CombatState } from '../sim/combat';
import type { LaneParams } from '../sim/map-gen';
import type { RunState } from '../sim/run-state';
import { advanceLane, createLane } from '../sim/travel';
import type { LaneState } from '../sim/travel';

/**
 * Combat (lane) mode controller: owns the space renderer and one hyperspace
 * lane — encounters chain via continueTravel until arrival, which hands
 * control back to the orchestrator (the lane is the space BETWEEN map nodes).
 *
 * Command methods guard instead of throwing: the sim's loud-failure policy is
 * for programming errors, but a double-tap racing a state update is normal
 * pointer input and must be a quiet no-op.
 */

export interface CombatModeCallbacks {
  onUpdate(view: CombatView): void;
  /** The lane is finished — the ship dropped into realspace at the destination. */
  onArrival(): void;
  /** Hull reached 0 — ship destroyed, run over (GDD §6.4). */
  onDefeat(): void;
}

export interface CombatModeOptions {
  run: RunState;
  lane: LaneParams;
  enemyPool?: readonly EnemyId[];
}

export interface CombatMode {
  playCard(handIndex: number): void;
  useInnate(handIndex?: number): void;
  endTurn(): void;
  payToll(): void;
  continueTravel(): void;
  destroy(): void;
}

export function startCombatMode(
  app: Application,
  options: CombatModeOptions,
  callbacks: CombatModeCallbacks,
): CombatMode {
  const { run, enemyPool } = options;
  const renderer: SpaceRenderer = createSpaceRenderer(app);
  const lane: LaneState = createLane(run, options.lane, enemyPool);

  const nextEncounter = (): CombatState | null => {
    const step = advanceLane(lane);
    if (step.kind === 'arrived') return null;
    return createCombat(run, step.enemyId, {
      distance: lane.distance,
      progressAtStart: lane.progress,
      malfunctioning: lane.malfunctioning,
    });
  };

  // Encounter positions are rolled strictly inside the lane, so a fresh lane
  // can never open on an arrival.
  let combat: CombatState | null = nextEncounter();
  if (combat === null) {
    throw new Error('combat-mode: lane opened with no encounters');
  }

  const emit = (): void => {
    if (combat === null) return;
    const view = buildCombatView(combat);
    renderer.sync(view);
    callbacks.onUpdate(view);
    if (combat.outcome === 'defeat') {
      callbacks.onDefeat();
    }
  };

  emit();

  return {
    playCard(handIndex: number): void {
      if (combat === null || combat.outcome !== 'ongoing') return;
      const card = combat.hand[handIndex];
      if (card === undefined || !isCardPlayable(card) || cardPlayCost(combat, card) > combat.ap)
        return;
      playCard(combat, handIndex);
      emit();
    },
    useInnate(handIndex?: number): void {
      if (combat === null || !canUseInnate(combat)) return;
      const innate = getHull(combat.hullId).innateAbility;
      if (innate.effect.kind === 'discard-to-draw') {
        if (handIndex === undefined || combat.hand[handIndex] === undefined) return;
        activateInnate(combat, handIndex);
      } else {
        activateInnate(combat);
      }
      emit();
    },
    endTurn(): void {
      if (combat === null || combat.outcome !== 'ongoing') return;
      endTurn(combat);
      emit();
    },
    payToll(): void {
      if (combat === null || !canPayToll(combat)) return;
      payToll(combat);
      emit();
    },
    continueTravel(): void {
      if (combat === null) return;
      if (combat.outcome !== 'victory' && combat.outcome !== 'escaped') return;
      applyCombatResult(run, combat);
      lane.progress = Math.min(lane.distance, lane.progress + combat.travelProgress);
      lane.malfunctioning = [...combat.malfunctioning];
      combat = nextEncounter();
      if (combat === null) {
        // Arrival in realspace — systems reset; the orchestrator takes over.
        callbacks.onArrival();
        return;
      }
      emit();
    },
    destroy(): void {
      renderer.destroy();
    },
  };
}
