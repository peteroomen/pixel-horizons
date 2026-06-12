import { Application, TextureSource } from 'pixi.js';

import { ROCKY_TEST_LEVEL } from '@/game/data/levels';
import { POD_WINDOW_MS } from '@/game/data/surface';
import { computeScale, VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from '@/renderer/pixel-scale';
import type { CombatView } from './combat-view';
import { BASELINE_AP, NODE_COMBAT_LANE, getEnemy, getHull } from './data';
import type { EnemyId } from './data';
import { buildMapView } from './map-view';
import type { MapView } from './map-view';
import { startCombatMode } from './modes/combat-mode';
import type { CombatMode } from './modes/combat-mode';
import { startSurfaceMode } from './modes/surface-mode';
import type { SurfaceAction, SurfaceMode } from './modes/surface-mode';
import { createSaveStore } from './save';
import { generateSectorMap, getNode, edgesFrom } from './sim/map-gen';
import type { LaneParams, SectorMap } from './sim/map-gen';
import { createRunState } from './sim/run-state';
import type { Resources, RunState } from './sim/run-state';
import { parseSeedParam, seedToSearchParam } from './sim/seed-url';
import { projectLoadout } from './surface/items';
import type { SurfaceView } from './surface-view';

/**
 * The React↔game boundary (ADR 001) and the run-loop orchestrator (ADR 005).
 * React components import this module and nothing else from src/game/: commands
 * flow in through the GameHandle, state flows out as view snapshots — once per
 * event, never per frame.
 *
 * main.ts owns the phase machine; the modes/ controllers own their renderer and
 * loop for the duration of one phase:
 *
 *   title ──new/resume──▶ map ──selectNode──▶ lane ──onArrival──▶ node entry
 *   node entry: cache → map · combat → forced-encounter lane → map ·
 *               planet → surface ──continueFromNode──▶ map · gate → sector-complete
 *   lane ──onDefeat──▶ run-over · run-over/sector-complete ──newRun──▶ map
 *
 * Command methods guard instead of throwing: a double-tap racing a phase change
 * is normal pointer input and must be a quiet no-op.
 */

export type {
  CardView,
  CombatView,
  InnateView,
  IntentDetail,
  IntentView,
  ModuleView,
  ShieldLayerView,
} from './combat-view';
export type { SurfaceItemView, SurfaceView } from './surface-view';
export type { MapEdgeView, MapNodeView, MapView } from './map-view';

export type GamePhase = 'title' | 'map' | 'lane' | 'surface' | 'run-over' | 'sector-complete';

export interface GameCallbacks {
  onCombatUpdate(view: CombatView): void;
  onScaleChange?(zoom: number): void;
  /** Fired on every phase transition, after the phase's data callbacks. */
  onPhaseChange?(phase: GamePhase): void;
  /**
   * Surface phase only: fired once per discrete change (pod second tick,
   * mining, deposit, launch) — never per frame.
   */
  onSurfaceUpdate?(view: SurfaceView): void;
  /** Fired on map entry and at run end states (the end screens read run totals from it). */
  onMapUpdate?(view: MapView): void;
}

export interface GameHandle {
  /** Seed of the active run (the resumed seed after RESUME RUN). */
  readonly seed: string;
  playCard(handIndex: number): void;
  /** Hull innate ability; handIndex only for card-targeted innates (Slipstream). */
  useInnate(handIndex?: number): void;
  endTurn(): void;
  /** Pays the anchor enemy's Scrap toll — the blockade lets you pass (GDD §5.7). */
  payToll(): void;
  /**
   * After victory or escape: commits the result to the run, carries malfunctions
   * and travel progress into the lane, and travels on — next encounter, or
   * arrival at the destination node.
   */
  continueTravel(): void;
  /** Map phase: travel to a node one lane-hop away. */
  selectNode(nodeId: string): void;
  /** Surface result screen: bank pod deposits into the run and return to the map. */
  continueFromNode(): void;
  /** Title screen: continue the saved run. */
  resumeRun(): void;
  /** Title/run-over/sector-complete: discard any save and start fresh from the URL seed. */
  newRun(): void;
  /** Surface phase input: called by TouchControls on pointer events. */
  surfaceInput(action: SurfaceAction, pressed: boolean): void;
  destroy(): void;
}

/** Weapon-rich starting deck — the winnable first playable fight. Hull select is Phase 5. */
const DEFAULT_HULL = 'hull-gunship';

/**
 * Dev/test knob until hull select lands (Phase 5): `?hull=hull-scout` etc.
 * exercises the other hulls in the browser. Unknown values fall back quietly.
 */
function resolveHull(): string {
  const param = new URLSearchParams(window.location.search).get('hull');
  if (param === null) {
    return DEFAULT_HULL;
  }
  try {
    return getHull(param).id;
  } catch {
    return DEFAULT_HULL;
  }
}

/**
 * Dev/test knob: `?enemy=enemy-anchormaw` forces every lane encounter to one
 * enemy — each enemy must be reachable on demand for manual testing. Unknown
 * values fall back quietly.
 */
function resolveEnemyPool(): readonly EnemyId[] | undefined {
  const param = new URLSearchParams(window.location.search).get('enemy');
  if (param === null) {
    return undefined;
  }
  try {
    return [getEnemy(param).id];
  } catch {
    return undefined;
  }
}

/**
 * Dev/test knob: `?mode=surface` skips the run loop and drops straight onto the
 * test planet with the resolved hull's loadout — per-hull item checks shouldn't
 * require traversing a map first. No save interaction.
 */
function resolveDevSurface(): boolean {
  return new URLSearchParams(window.location.search).get('mode') === 'surface';
}

/**
 * Dev/test knob: `?pod=20` sets the base launch window in seconds — manual
 * testing shouldn't take 5 real minutes. Engine bonuses still apply on top.
 * Invalid values fall back to POD_WINDOW_MS.
 */
function resolvePodWindowMs(): number {
  const param = new URLSearchParams(window.location.search).get('pod');
  if (param === null) return POD_WINDOW_MS;
  const seconds = Number.parseInt(param, 10);
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : POD_WINDOW_MS;
}

/**
 * The session seed: a valid `?seed=` in the URL wins; otherwise a fresh seed is
 * generated from platform entropy and written back into the URL so every run is
 * shareable/reproducible. Entropy is allowed here at the edge — inside the sim
 * all randomness stays on the seeded streams.
 */
function resolveSeed(): string {
  const fromUrl = parseSeedParam(window.location.search);
  const seed = fromUrl ?? generateSeed();
  window.history.replaceState(null, '', seedToSearchParam(seed, window.location.search));
  return seed;
}

function generateSeed(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, '0')).join('');
}

function addResources(target: Resources, delta: Resources): void {
  target.scrap += delta.scrap;
  target.biominerals += delta.biominerals;
  target.coreCrystals += delta.coreCrystals;
  target.blueprints += delta.blueprints;
}

export async function initGame(host: HTMLElement, callbacks: GameCallbacks): Promise<GameHandle> {
  const urlSeed = resolveSeed();
  const hullId = resolveHull();
  const enemyPool = resolveEnemyPool();
  const podWindowMs = resolvePodWindowMs();
  const devSurface = resolveDevSurface();

  TextureSource.defaultOptions.scaleMode = 'nearest';
  const app = new Application();
  await app.init({
    width: VIRTUAL_WIDTH,
    height: VIRTUAL_HEIGHT,
    background: 0x0f0f1a,
    antialias: false,
    roundPixels: true,
    resolution: 1,
    autoDensity: false,
  });
  host.appendChild(app.canvas);

  const applyScale = (): void => {
    const rect = host.getBoundingClientRect();
    const scale = computeScale(rect.width, rect.height, window.devicePixelRatio);
    app.renderer.resize(scale.backingWidth, scale.backingHeight);
    app.stage.scale.set(scale.zoom);
    app.canvas.style.width = `${scale.cssWidth}px`;
    app.canvas.style.height = `${scale.cssHeight}px`;
    callbacks.onScaleChange?.(scale.zoom);
  };
  applyScale();
  const observer = new ResizeObserver(applyScale);
  observer.observe(host);

  const store = createSaveStore(window.localStorage);

  // ── Run state ───────────────────────────────────────────────────────────
  let run: RunState = createRunState(urlSeed, hullId);
  let map: SectorMap = generateSectorMap(urlSeed, run.position.sector);
  run.position.nodeId = map.startId;

  let phase: GamePhase = 'map';
  let combatMode: CombatMode | null = null;
  let surfaceMode: SurfaceMode | null = null;
  /** Node the active lane travels toward. */
  let laneDestination: string | null = null;
  /** Combat-node arrivals owe one forced encounter before the node resolves. */
  let nodeFightPending = false;
  /** Run loaded from storage, held until the title screen resolves. */
  let savedRun: RunState | null = null;

  const setPhase = (next: GamePhase): void => {
    phase = next;
    callbacks.onPhaseChange?.(next);
  };

  const emitMap = (): void => {
    callbacks.onMapUpdate?.(buildMapView(map, run));
  };

  const destroyModes = (): void => {
    combatMode?.destroy();
    combatMode = null;
    surfaceMode?.destroy();
    surfaceMode = null;
  };

  /** Node arrival is the save point (ADR 003) — including the run's first node. */
  const enterMap = (): void => {
    store.save(run);
    emitMap();
    setPhase('map');
  };

  const enterSurface = (): void => {
    surfaceMode = startSurfaceMode(
      app,
      {
        level: ROCKY_TEST_LEVEL,
        podWindowMs,
        loadout: projectLoadout(run.modules, BASELINE_AP),
      },
      { onUpdate: (view) => callbacks.onSurfaceUpdate?.(view) },
    );
    setPhase('surface');
  };

  const startLane = (params: LaneParams): void => {
    combatMode = startCombatMode(
      app,
      { run, lane: params, enemyPool },
      {
        onUpdate: (view) => callbacks.onCombatUpdate(view),
        onArrival: (): void => {
          destroyModes();
          arriveAtNode();
        },
        onDefeat: (): void => {
          destroyModes();
          store.clear();
          emitMap();
          setPhase('run-over');
        },
      },
    );
    setPhase('lane');
  };

  const arriveAtNode = (): void => {
    if (laneDestination === null) return;
    const node = getNode(map, laneDestination);
    run.position.nodeId = node.id;
    if (node.type === 'combat' && nodeFightPending) {
      // The node's forced encounter (GDD §7.2) — a short lane of its own
      nodeFightPending = false;
      startLane(NODE_COMBAT_LANE);
      return;
    }
    laneDestination = null;
    if (node.type === 'cache') {
      run.resources.scrap += node.cacheScrap ?? 0;
    }
    if (node.type === 'planet') {
      enterSurface();
      return;
    }
    if (node.type === 'gate') {
      store.clear();
      emitMap();
      setPhase('sector-complete');
      return;
    }
    enterMap();
  };

  // ── Boot ────────────────────────────────────────────────────────────────
  if (devSurface) {
    enterSurface();
  } else {
    const saved = store.load();
    if (saved !== null && saved.position.nodeId !== null) {
      savedRun = saved;
      const savedMap = generateSectorMap(saved.seed, saved.position.sector);
      callbacks.onMapUpdate?.(buildMapView(savedMap, saved));
      setPhase('title');
    } else {
      enterMap();
    }
  }

  return {
    get seed(): string {
      return run.seed;
    },
    playCard(handIndex: number): void {
      combatMode?.playCard(handIndex);
    },
    useInnate(handIndex?: number): void {
      combatMode?.useInnate(handIndex);
    },
    endTurn(): void {
      combatMode?.endTurn();
    },
    payToll(): void {
      combatMode?.payToll();
    },
    continueTravel(): void {
      combatMode?.continueTravel();
    },
    selectNode(nodeId: string): void {
      if (phase !== 'map' || run.position.nodeId === null) return;
      const edge = edgesFrom(map, run.position.nodeId).find((e) => e.to === nodeId);
      if (edge === undefined) return;
      laneDestination = nodeId;
      nodeFightPending = getNode(map, nodeId).type === 'combat';
      startLane(edge.lane);
    },
    continueFromNode(): void {
      if (phase !== 'surface' || surfaceMode === null) return;
      const state = surfaceMode.state();
      if (state.outcome === 'ongoing') return;
      if (devSurface) {
        // Dev knob has no run loop — Drop Again instead
        destroyModes();
        enterSurface();
        return;
      }
      if (state.pod !== null) {
        addResources(run.resources, state.pod.deposited);
      }
      destroyModes();
      enterMap();
    },
    resumeRun(): void {
      if (phase !== 'title' || savedRun === null) return;
      run = savedRun;
      savedRun = null;
      map = generateSectorMap(run.seed, run.position.sector);
      window.history.replaceState(null, '', seedToSearchParam(run.seed, window.location.search));
      emitMap();
      setPhase('map');
    },
    newRun(): void {
      if (phase !== 'title' && phase !== 'run-over' && phase !== 'sector-complete') return;
      destroyModes();
      store.clear();
      savedRun = null;
      run = createRunState(urlSeed, hullId);
      map = generateSectorMap(urlSeed, run.position.sector);
      run.position.nodeId = map.startId;
      enterMap();
    },
    surfaceInput(action: SurfaceAction, pressed: boolean): void {
      surfaceMode?.input(action, pressed);
    },
    destroy(): void {
      destroyModes();
      observer.disconnect();
      app.destroy(true, { children: true, texture: true });
    },
  };
}
