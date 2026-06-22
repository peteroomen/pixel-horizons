import type { Application } from 'pixi.js';

import { createSpaceRenderer } from '@/renderer/space-renderer';
import type { SpaceRenderer } from '@/renderer/space-renderer';
import { buildCombatView } from '../combat-view';
import type { CombatView } from '../combat-view';
import { ENEMY_DEFS, getHull } from '../data';
import type { EnemyId } from '../data';
import {
  activateInnate,
  applyCombatResult,
  canUseInnate,
  cardDiscardCost,
  cardPlayCost,
  createCombat,
  endTurn,
  isCardJettisonable,
  isCardPlayable,
  jettisonCard,
  malfunctioningModules,
  playCard,
  rollVictoryScrap,
  selectTarget,
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
  /** Null for no-lane combat (boss fights) — no travel, one forced encounter. */
  lane: LaneParams | null;
  enemyPool?: readonly EnemyId[];
  /** Virtual canvas dimensions — space-renderer sizes itself to match the portrait stage. */
  virtW: number;
  virtH: number;
}

export interface CombatMode {
  playCard(handIndex: number, discardIndices?: readonly number[]): void;
  jettisonCard(handIndex: number): void;
  selectTarget(target: number | null): void;
  useInnate(handIndex?: number): void;
  endTurn(): void;
  continueTravel(): void;
  destroy(): void;
}

export function startCombatMode(
  app: Application,
  options: CombatModeOptions,
  callbacks: CombatModeCallbacks,
): CombatMode {
  const { run, enemyPool, virtW, virtH } = options;
  const renderer: SpaceRenderer = createSpaceRenderer(app, virtW, virtH);

  // No-lane combat (boss fights): a single forced encounter with no travel.
  const lane: LaneState | null =
    options.lane !== null ? createLane(run, options.lane, enemyPool) : null;

  const nextEncounter = (): CombatState | null => {
    if (lane === null) return null;
    const step = advanceLane(lane);
    if (step.kind === 'arrived') return null;
    return createCombat(run, step.enemyId, {
      distance: lane.distance,
      progressAtStart: lane.progress,
      malfunctioning: lane.malfunctioning,
    });
  };

  let combat: CombatState | null;
  if (lane === null) {
    // Boss fight: single encounter, no lane context
    const pool = enemyPool ?? ENEMY_DEFS.map((e) => e.id);
    combat = createCombat(run, pool[0]);
  } else {
    combat = nextEncounter();
    if (combat === null) {
      throw new Error('combat-mode: lane opened with no encounters');
    }
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
    playCard(handIndex: number, discardIndices: readonly number[] = []): void {
      if (combat === null || combat.outcome !== 'ongoing') return;
      const c = combat;
      const card = c.hand[handIndex];
      if (card === undefined || !isCardPlayable(card) || cardPlayCost(c, card) > c.ap) return;
      // Guard the discard selection here too — a stale tap mustn't throw in the sim.
      if (discardIndices.length !== cardDiscardCost(card)) return;
      if (discardIndices.some((i) => i === handIndex || c.hand[i] === undefined)) return;
      playCard(c, handIndex, discardIndices);
      emit();
    },
    jettisonCard(handIndex: number): void {
      if (combat === null || combat.outcome !== 'ongoing') return;
      const card = combat.hand[handIndex];
      if (card === undefined || !isCardJettisonable(card)) return;
      jettisonCard(combat, handIndex);
      emit();
    },
    selectTarget(target: number | null): void {
      if (combat === null || combat.outcome !== 'ongoing') return;
      selectTarget(combat, target);
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
    continueTravel(): void {
      if (combat === null) return;
      if (combat.outcome !== 'victory' && combat.outcome !== 'escaped') return;
      if (combat.outcome === 'victory') {
        rollVictoryScrap(combat);
      }
      applyCombatResult(run, combat);
      if (lane === null) {
        // No-lane combat (boss fight) — single encounter, arrival on victory.
        combat = null;
        callbacks.onArrival();
        return;
      }
      lane.progress = Math.min(lane.distance, lane.progress + combat.travelProgress);
      lane.malfunctioning = malfunctioningModules(combat);
      combat = nextEncounter();
      if (combat === null) {
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
