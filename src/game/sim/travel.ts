import { ENEMY_DEFS, LANE_DISTANCE_MAX, LANE_DISTANCE_MIN, LANE_ENCOUNTER_COUNT } from '../data';
import type { EnemyId } from '../data';
import { restoreRng } from './rng';
import type { RunState } from './run-state';

/**
 * Hyperspace lanes (GDD §5.1): a lane has a distance measured in turns, encounters at
 * rolled points along it, and ends on arrival — which clears all malfunctions (§5.6,
 * "arrival in realspace = systems reset").
 *
 * LaneState is plain JSON, owned by the orchestrator (main.ts) next to the RunState —
 * not inside it: ADR 003 saves at node boundaries, and a lane is the space *between*
 * nodes. Lane composition rolls on the map-gen RNG stream (lane structure is map
 * content — the 4.1 sector generator replaces `createLane`) and commits the stream
 * back, same contract as combat.
 *
 * Travel progress accumulated mid-combat carries between encounters, and encounter
 * points overshot during a fight are skipped — that is "faster traversal = fewer
 * encounter triggers" (§5.1), settling its open question in favor of carrying.
 */

export interface LaneEncounter {
  /** Lane position (in turns of travel) where this encounter triggers. */
  at: number;
  enemyId: EnemyId;
}

export interface LaneState {
  /** Total lane length in turns of travel. */
  distance: number;
  /** Turns of travel completed so far. */
  progress: number;
  /** Rolled at lane creation, ordered by position. */
  encounters: LaneEncounter[];
  /** Index of the first encounter not yet triggered or skipped. */
  nextEncounter: number;
  /** Module indices still malfunctioning from earlier fights in this lane (GDD §5.6). */
  malfunctioning: number[];
}

const DEFAULT_ENEMY_POOL: readonly EnemyId[] = ENEMY_DEFS.map((enemy) => enemy.id);

/**
 * Rolls a lane on the run's map-gen stream and commits the stream back. Encounter
 * positions partition [1, distance-1] into equal segments — always strictly increasing,
 * never at the lane mouth or the destination. Enemy picks are uniform over the pool
 * (danger weighting is 4.1's lane-modifier work); `enemyPool` exists for the `?enemy=`
 * dev knob.
 */
export function createLane(
  run: RunState,
  enemyPool: readonly EnemyId[] = DEFAULT_ENEMY_POOL,
): LaneState {
  const rng = restoreRng(run.rng['map-gen']);
  const distance = rng.int(LANE_DISTANCE_MIN, LANE_DISTANCE_MAX + 1);
  const usable = distance - 1;
  const encounters = Array.from({ length: LANE_ENCOUNTER_COUNT }, (_, i): LaneEncounter => {
    const lo = 1 + Math.floor((i * usable) / LANE_ENCOUNTER_COUNT);
    const hi = 1 + Math.floor(((i + 1) * usable) / LANE_ENCOUNTER_COUNT);
    return { at: rng.int(lo, hi), enemyId: rng.pick(enemyPool) };
  });
  run.rng['map-gen'] = rng.getState();
  return { distance, progress: 0, encounters, nextEncounter: 0, malfunctioning: [] };
}

export type LaneAdvance = { kind: 'encounter'; enemyId: EnemyId } | { kind: 'arrived' };

/**
 * Travels to the next encounter still ahead of `progress`, or to the destination.
 * Encounters at or behind the current position were overshot mid-combat and are
 * skipped. Out-of-combat travel is instant — there are no decisions to make in an
 * empty stretch of lane.
 */
export function advanceLane(lane: LaneState): LaneAdvance {
  while (lane.nextEncounter < lane.encounters.length) {
    const encounter = lane.encounters[lane.nextEncounter];
    lane.nextEncounter += 1;
    if (encounter.at > lane.progress) {
      lane.progress = encounter.at;
      return { kind: 'encounter', enemyId: encounter.enemyId };
    }
  }
  lane.progress = lane.distance;
  return { kind: 'arrived' };
}
