import {
  CONTACT_DAMAGE,
  CORPSE_PICKUP_RADIUS,
  ITEM_MAGNET_RADIUS,
  POD_WINDOW_MS,
} from '@/game/data/surface';
import type { Resources } from '@/game/sim/run-state';
import { createClone, damageClone, respawnClone, updateClone } from './clone';
import type { CloneState, InputState } from './clone';
import { createEnemies, updateEnemies } from './enemies';
import type { EnemyState } from './enemies';
import { collectWorldItems, transferToBackpack } from './drops';
import type { WorldItem } from './drops';
import {
  VENT_CYCLE_MS,
  brambleContact,
  createCrumbleTiles,
  updateCrumbling,
  ventPush,
} from './hazards';
import type { CrumbleTile } from './hazards';
import { baselineLoadout } from './items';
import type { SurfaceLoadout } from './items';
import { addYield, scaleYield, tileYield } from './mining';
import { createPod, depositBackpack, podOverlapsClone, tickPod } from './pod';
import type { PodState } from './pod';
import { parseLevel } from './tilemap';
import type { Tilemap } from './tilemap';

/**
 * How a surface run ended (GDD §6.2/§6.4): 'aboard' — clone was on the pod at
 * launch, everything banked; 'stranded' — pod left without the clone, backpack
 * lost, deposited resources safe, consciousness snaps to orbit; 'abandoned' —
 * the player recalled the clone early (escape valve for soft-locks), same
 * consequences as stranded.
 */
export type SurfaceOutcome = 'ongoing' | 'aboard' | 'stranded' | 'abandoned';

/** A dropped backpack resting at a death point, recoverable by a corpse run (GDD §6.10). */
export interface Corpse {
  resources: Resources;
  x: number;
  y: number;
}

export interface SurfaceState {
  map: Tilemap;
  clone: CloneState;
  pod: PodState | null;
  /** Items projected from the ship's modules (GDD §6.3) — fixed for the drop. */
  loadout: SurfaceLoadout;
  outcome: SurfaceOutcome;
  /** Snapshot of the backpack lost at a stranded launch; null otherwise. */
  lostBackpack: Resources | null;
  /** Live surface enemies (GDD §6.7). */
  enemies: EnemyState[];
  /** Floor-bounced enemy drops awaiting pickup (GDD §6.5). */
  worldItems: WorldItem[];
  /** Crumbling Sandstone tiles' live state (GDD §6.8). */
  crumbles: CrumbleTile[];
  /** Sandstorm Vent cycle clock (ms), wrapped to one cycle. */
  ventPhaseMs: number;
  /** Single dropped-backpack corpse, or null (GDD §6.10 single-instance rule). */
  corpse: Corpse | null;
  /** Re-prints used this planet visit — drives the free-first economy in main.ts. */
  reprintsUsed: number;
}

export interface CreateSurfaceOptions {
  /** Override the base pod window (dev knob / tests). Defaults to POD_WINDOW_MS. */
  podWindowMs?: number;
  /** Module-projected items. Defaults to the bare clone. */
  loadout?: SurfaceLoadout;
}

const ZERO: Resources = { scrap: 0, biominerals: 0, coreCrystals: 0, blueprints: 0 };

/** Build a SurfaceState from ASCII level rows. */
export function createSurface(rows: string[], options?: CreateSurfaceOptions): SurfaceState {
  const map = parseLevel(rows);
  const loadout = options?.loadout ?? baselineLoadout();
  const clone = createClone(map, loadout.capabilities, loadout.shieldBubble?.cooldownMs ?? null);
  // Engine quality extends the launch window on top of the base (GDD §6.2)
  const pod = createPod(map, (options?.podWindowMs ?? POD_WINDOW_MS) + loadout.podWindowBonusMs);
  return {
    map,
    clone,
    pod,
    loadout,
    outcome: 'ongoing',
    lostBackpack: null,
    enemies: createEnemies(map),
    worldItems: [],
    crumbles: createCrumbleTiles(map),
    ventPhaseMs: 0,
    corpse: null,
    reprintsUsed: 0,
  };
}

/** Snapshot the backpack onto a fresh corpse and empty the pack (single-instance). */
function dropCorpse(state: SurfaceState): void {
  const { clone } = state;
  state.corpse = {
    resources: { ...clone.backpack },
    x: clone.body.x,
    y: clone.body.y,
  };
  clone.backpack = { ...ZERO };
}

/** Route an enemy drop into the backpack, overflow to a floor world item. */
function awardDrop(state: SurfaceState, resources: Resources, x: number, y: number): void {
  const bundle = { ...resources };
  const emptied = transferToBackpack(bundle, state.clone.backpack, state.loadout.backpackCapacity);
  if (!emptied) {
    state.worldItems.push({ resources: bundle, x, y });
  }
}

/**
 * Advance the surface simulation one fixed timestep.
 * Called by main.ts's fixed-timestep accumulator loop.
 *
 * While the clone is dead, only the death fade and the pod countdown advance —
 * the world freezes until a re-print or abandon. The deposit-before-tick order
 * is preserved so a clone on the pod at expiry banks everything that same step.
 */
export function updateSurface(state: SurfaceState, input: InputState, dtMs: number): void {
  if (state.outcome !== 'ongoing') return;

  const { clone, map, pod } = state;

  if (clone.dead) {
    clone.deathFadeMs = Math.max(0, clone.deathFadeMs - dtMs);
    if (pod !== null && tickPod(pod, dtMs)) strandClone(state, 'stranded');
    return;
  }

  // ── Hazards: vent impulse (advance phase), then move the clone with it ──
  state.ventPhaseMs = (state.ventPhaseMs + dtMs) % VENT_CYCLE_MS;
  const push = ventPush(map.vents, state.ventPhaseMs, clone.body);
  const { brokenTiles } = updateClone(clone, map, input, dtMs, push);

  for (const tile of brokenTiles) {
    const delta = tileYield(tile);
    if (delta !== null) {
      addYield(
        clone.backpack,
        scaleYield(delta, state.loadout.yieldMultiplier),
        state.loadout.backpackCapacity,
      );
    }
  }

  // ── Enemies (melee, AI, contact damage) → drops ──
  const drops = updateEnemies(state.enemies, clone, map, dtMs);
  for (const drop of drops) {
    awardDrop(state, drop.resources, drop.x, drop.y);
  }

  // ── Crumbling Sandstone state machines ──
  updateCrumbling(state.crumbles, map, clone.body, clone.grounded, dtMs);

  // ── Spike Bramble contact ──
  if (brambleContact(map, clone.body)) {
    damageClone(clone, CONTACT_DAMAGE, clone.body.x + clone.body.w / 2);
  }

  // ── A death this step drops the backpack as a corpse (single-instance:
  // dropCorpse overwrites any prior corpse, so its loot is permanently lost). ──
  if (clone.dead) {
    dropCorpse(state);
    return; // freeze the rest of the step; the Cloning Bay overlay takes over
  }

  // ── Pickups: corpse run + magnetised world items ──
  collectWorldItems(
    state.worldItems,
    clone.backpack,
    state.loadout.backpackCapacity,
    clone.body,
    ITEM_MAGNET_RADIUS,
  );
  if (state.corpse !== null) {
    if (
      distanceToCorpse(state) <= CORPSE_PICKUP_RADIUS &&
      transferToBackpack(state.corpse.resources, clone.backpack, state.loadout.backpackCapacity)
    ) {
      state.corpse = null;
    }
  }

  // ── Pod deposit + launch ──
  if (pod === null) return;
  const overlapping = podOverlapsClone(pod, clone.body);
  if (overlapping) depositBackpack(clone, pod);
  if (tickPod(pod, dtMs)) {
    if (overlapping) state.outcome = 'aboard';
    else strandClone(state, 'stranded');
  }
}

function distanceToCorpse(state: SurfaceState): number {
  const { corpse, clone } = state;
  if (corpse === null) return Infinity;
  const dx = clone.body.x + clone.body.w / 2 - (corpse.x + 0.5);
  const dy = clone.body.y + clone.body.h / 2 - (corpse.y + 0.5);
  return Math.hypot(dx, dy);
}

/** Backpack is lost, deposits stay safe, the sim freezes (GDD §6.2). */
function strandClone(state: SurfaceState, outcome: 'stranded' | 'abandoned'): void {
  state.outcome = outcome;
  // A corpse still on the surface is lost too — surface it on the result screen.
  const lost = state.corpse !== null ? state.corpse.resources : state.clone.backpack;
  state.lostBackpack = { ...lost };
  state.clone.backpack = { ...ZERO };
  state.corpse = null;
  if (state.pod !== null) {
    state.pod.launched = true;
  }
}

/** Whether a manual early launch is currently possible (clone standing on the pod). */
export function canLaunchPod(state: SurfaceState): boolean {
  return (
    state.outcome === 'ongoing' &&
    !state.clone.dead &&
    state.pod !== null &&
    !state.pod.launched &&
    podOverlapsClone(state.pod, state.clone.body)
  );
}

/**
 * Manual early launch (GDD §6.2 — the timer forces you out, but mining out the
 * map shouldn't force you to wait it out). Only fires with the clone on the
 * pod: the backpack deposits first, so 'aboard' banks everything, same as an
 * on-pod expiry. No-op otherwise — callers gate UI on canLaunchPod.
 */
export function launchPod(state: SurfaceState): void {
  const { pod } = state;
  if (pod === null || !canLaunchPod(state)) return;
  depositBackpack(state.clone, pod);
  pod.launched = true;
  state.outcome = 'aboard';
}

/**
 * Recall the clone to orbit immediately — the always-available escape valve
 * for soft-locks (unclimbable pits) and the "give up" choice from the Cloning
 * Bay. Same consequences as missing the launch window: backpack/corpse lost,
 * deposits safe.
 */
export function abandonSurface(state: SurfaceState): void {
  if (state.outcome !== 'ongoing') return;
  strandClone(state, 'abandoned');
}

/** Whether the Cloning Bay is awaiting a re-print decision (GDD §6.10). */
export function isAwaitingReprint(state: SurfaceState): boolean {
  return state.outcome === 'ongoing' && state.clone.dead;
}

/**
 * Re-print the clone at the pod (GDD §6.4). Resets the clone in place and counts
 * the re-print; the Scrap/free-first economy is gated by the orchestrator
 * (main.ts) — the surface sim stays economy-free (3.2 invariant).
 */
export function reprintClone(state: SurfaceState): void {
  if (!isAwaitingReprint(state)) return;
  respawnClone(state.clone, state.map.spawnX, state.map.spawnY);
  state.reprintsUsed += 1;
}
