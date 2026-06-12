import { POD_HEIGHT, POD_WIDTH } from '@/game/data/surface';
import type { Resources } from '@/game/sim/run-state';
import type { CloneState } from './clone';
import type { Body } from './physics';
import type { Tilemap } from './tilemap';

/**
 * The drop pod (GDD §6.2): base camp on a sim-time launch window. Deposited
 * resources are safe no matter what; the backpack is only safe once deposited.
 * The pod is an entity, not tiles — the clone walks through it.
 */
export interface PodState {
  /** World-space AABB, anchored at the 'D' marker's top-left tile corner. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Total launch window (ms, sim time) — kept for HUD progress display. */
  windowMs: number;
  /** Sim-time remaining until auto-launch. Clamped at 0. */
  remainingMs: number;
  /** Resources banked in the pod — safe no matter what (GDD §6.2). */
  deposited: Resources;
  launched: boolean;
}

/** Build the pod from the level's 'D' marker, or null if the level has none. */
export function createPod(map: Tilemap, windowMs: number): PodState | null {
  if (map.podX === null || map.podY === null) return null;
  return {
    x: map.podX,
    y: map.podY,
    w: POD_WIDTH,
    h: POD_HEIGHT,
    windowMs,
    remainingMs: windowMs,
    deposited: { scrap: 0, biominerals: 0, coreCrystals: 0, blueprints: 0 },
    launched: false,
  };
}

/** Strict AABB intersection between pod and clone body (flush edges don't overlap). */
export function podOverlapsClone(pod: PodState, body: Body): boolean {
  return (
    body.x < pod.x + pod.w &&
    body.x + body.w > pod.x &&
    body.y < pod.y + pod.h &&
    body.y + body.h > pod.y
  );
}

/**
 * Move the entire backpack into pod.deposited and zero the backpack.
 * Returns true if anything moved (future SFX/event hook).
 */
export function depositBackpack(clone: CloneState, pod: PodState): boolean {
  const { backpack } = clone;
  const total = backpack.scrap + backpack.biominerals + backpack.coreCrystals + backpack.blueprints;
  if (total === 0) return false;
  pod.deposited.scrap += backpack.scrap;
  pod.deposited.biominerals += backpack.biominerals;
  pod.deposited.coreCrystals += backpack.coreCrystals;
  pod.deposited.blueprints += backpack.blueprints;
  backpack.scrap = 0;
  backpack.biominerals = 0;
  backpack.coreCrystals = 0;
  backpack.blueprints = 0;
  return true;
}

/**
 * Tick the countdown by dtMs of sim time. Returns true on exactly the step
 * where remainingMs reaches 0 (the launch step); further ticks return false.
 */
export function tickPod(pod: PodState, dtMs: number): boolean {
  if (pod.launched) return false;
  pod.remainingMs = Math.max(0, pod.remainingMs - dtMs);
  if (pod.remainingMs > 0) return false;
  pod.launched = true;
  return true;
}
