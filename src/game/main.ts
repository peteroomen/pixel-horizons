import { Application, TextureSource } from 'pixi.js';

import { ROCKY_TEST_LEVEL } from '@/game/data/levels';
import { POD_WINDOW_MS } from '@/game/data/surface';
import { surfaceRampFor } from '@/renderer/palette';
import { computeScale, VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from '@/renderer/pixel-scale';
import type { CombatView } from './combat-view';
import { getEnemy, getHull, getModule } from './data';
import type { EnemyId, EventDef, ModuleInstance } from './data';
import { buildEventView } from './event-view';
import type { EventView } from './event-view';
import { buildMapView } from './map-view';
import type { MapView } from './map-view';
import { startCombatMode } from './modes/combat-mode';
import type { CombatMode } from './modes/combat-mode';
import { startOrbitMode } from './modes/orbit-mode';
import type { OrbitMode } from './modes/orbit-mode';
import { startSurfaceMode } from './modes/surface-mode';
import type { SurfaceAction, SurfaceMode } from './modes/surface-mode';
import { PLANET_TYPES } from './data/planets';
import { planetForNode } from './sim/planet';
import type { PlanetDescriptor } from './sim/planet';
import { createSaveStore } from './save';
import {
  buyModule,
  craftModule,
  installModule,
  repairHull,
  sellBiominerals,
  uninstallModule,
  upgradeModule,
  upgradeReactor,
} from './sim/economy';
import { applyEventChoice, pickEvent } from './sim/events';
import { generateSectorMap, getNode, edgesFrom } from './sim/map-gen';
import type { LaneParams, SectorMap } from './sim/map-gen';
import { createRunState } from './sim/run-state';
import type { Resources, RunState } from './sim/run-state';
import { deriveRng } from './sim/rng';
import { parseSeedParam, seedToSearchParam } from './sim/seed-url';
import { generateShopOffers, shopOfferKey } from './sim/shop-inventory';
import { buildShipView } from './ship-view';
import type { ShipView } from './ship-view';
import { buildMerchantView, buildEngineerView } from './station-view';
import type { StationView } from './station-view';
import { projectLoadout } from './surface/items';
import type { SurfaceView } from './surface-view';
import { REPRINT_SCRAP_COST } from './data/surface';

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
 *   node entry: cache → map · planet → surface ──continueFromNode──▶ map ·
 *               shop → shop ──leaveStation──▶ map ·
 *               engineer → engineer ──leaveStation──▶ map ·
 *               gate → boss fight (lane:null) ──victory──▶ boss-reward
 *                  ──chooseBossReward──▶ sector-complete
 *   lane ──onDefeat──▶ run-over · run-over/sector-complete ──newRun──▶ map
 *
 *   Combat lives in the lanes and only the lanes (GDD §2/§5.1): nodes are
 *   realspace, where the Bloom can't follow — arrival always resolves straight
 *   to the node's screen. The gate is the exception: the Gatemaw is a no-lane
 *   combat (lane:null — no escape-by-arrival).
 *
 * Command methods guard instead of throwing: a double-tap racing a phase change
 * is normal pointer input and must be a quiet no-op.
 */

export type {
  CardView,
  CombatView,
  EnemyPartView,
  InnateView,
  IntentDetail,
  IntentView,
  ModuleCardView,
  ModuleView,
  ShieldLayerView,
} from './combat-view';
export type { SurfaceItemView, SurfaceView } from './surface-view';
export type { MapEdgeView, MapNodeView, MapView } from './map-view';
export type { EventChoiceView, EventView } from './event-view';
export type { ShipModuleView, CargoModuleView, ShipView } from './ship-view';
export type { ModuleSlot } from './data';
export type { SlotUsage } from './sim/economy';
export type {
  OfferBlock,
  ShopOfferView,
  UpgradeOfferView,
  MerchantView,
  EngineerView,
  StationView,
} from './station-view';

export type BossRewardOption = 'core-crystal' | 'mk2-module' | 'blueprint-cache';

export type GamePhase =
  | 'title'
  | 'map'
  | 'lane'
  | 'orbit'
  | 'surface'
  | 'shop'
  | 'engineer'
  | 'event'
  | 'boss-reward'
  | 'run-over'
  | 'sector-complete';

/** What the orbit screen shows about the planet the run just reached (6.1). */
export interface OrbitView {
  name: string;
  type: string;
}

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
  /** Fired on orbit phase entry — the orbit screen reads the planet's name/type from it (6.1). */
  onOrbitUpdate?(view: OrbitView): void;
  /** Fired on map entry and at run end states (the end screens read run totals from it). */
  onMapUpdate?(view: MapView): void;
  /** Fired once per economy transaction — workbench/station screens read this. */
  onShipUpdate?(view: ShipView): void;
  /** Fired on shop/engineer phase entry and after each station transaction. */
  onStationUpdate?(view: StationView): void;
  /** Fired on event phase entry — the EventScreen reads this (GDD §4.4). */
  onEventUpdate?(view: EventView): void;
}

export interface GameHandle {
  /** Seed of the active run (the resumed seed after RESUME RUN). */
  readonly seed: string;
  /** Plays a card; `discardIndices` supplies targets for a Discard-keyword card (§5.9). */
  playCard(handIndex: number, discardIndices?: readonly number[]): void;
  /** Jettison a card for its benefit instead of playing it (GDD §5.9 / §5.4). */
  jettisonCard(handIndex: number): void;
  /** Focus single-target attacks on a boss organ (GDD §5.4); null = the core. */
  selectTarget(target: number | null): void;
  /** Hull innate ability; handIndex only for card-targeted innates (Slipstream). */
  useInnate(handIndex?: number): void;
  endTurn(): void;
  /**
   * After victory or escape: commits the result to the run, carries malfunctions
   * and travel progress into the lane, and travels on — next encounter, or
   * arrival at the destination node.
   */
  continueTravel(): void;
  /** Map phase: travel to a node one lane-hop away. */
  selectNode(nodeId: string): void;
  /** Orbit phase: drop the clone to the planet surface (6.1). */
  dropToSurface(): void;
  /** Surface phase: launch the pod early — no-op unless the clone is on the pod. */
  launchPod(): void;
  /** Surface phase: recall the clone to orbit (backpack lost, deposits safe). */
  abandonSurface(): void;
  /** Cloning Bay: re-print a dead clone (first per visit free, then costs Scrap). */
  reprintClone(): void;
  /** Surface result screen: bank pod deposits into the run and return to the map. */
  continueFromNode(): void;
  /** Title screen: continue the saved run. */
  resumeRun(): void;
  /** Title/run-over/sector-complete: discard any save and start fresh from the URL seed. */
  newRun(): void;
  /** Surface phase input: called by TouchControls on pointer events. */
  surfaceInput(action: SurfaceAction, pressed: boolean): void;
  /** Map phase: open the workbench overlay. */
  openWorkbench(): void;
  /** Map phase: close the workbench overlay. */
  closeWorkbench(): void;
  /** Workbench: move a cargo module into the installed list. */
  installModule(cargoIndex: number): void;
  /** Workbench: move an installed module to cargo. */
  uninstallModule(moduleIndex: number): void;
  /** Workbench: craft a new module from resources. */
  craftModule(moduleId: string): void;
  /** Workbench: spend a Core Crystal to raise the reactor level. */
  upgradeReactor(): void;
  /** Merchant: buy a module by shop offer index. */
  buyModule(offerIndex: number): void;
  /** Merchant: sell biominerals for scrap. */
  sellBiominerals(count: number): void;
  /** Engineer: repair hull in fixed chunks. */
  repairHull(): void;
  /** Engineer: upgrade an installed module to Mk II. */
  upgradeModule(moduleIndex: number): void;
  /** Shop/engineer: leave the station and return to the map. */
  leaveStation(): void;
  /**
   * Event phase: resolve a choice (GDD §4.4). `moduleIndex` is required for choices
   * that attach a modifier to an installed module; the run returns to the map.
   */
  chooseEventChoice(choiceIndex: number, moduleIndex?: number): void;
  /** Boss reward phase: pick one of the three options. */
  chooseBossReward(option: BossRewardOption): void;
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
 * Dev/test knob until the Workbench lands (4.2): `?modules=mining-laser,thruster`
 * overrides the hull's installed modules, so any item combination is testable
 * without module acquisition. The `mod-` prefix is optional; unknown entries are
 * dropped quietly (same fallback convention as the other knobs). The override is
 * the whole ship — the combat deck and the surface items both project from it.
 * An all-invalid or empty list falls back to the hull's defaults.
 */
function resolveModuleOverride(): ModuleInstance[] | null {
  const param = new URLSearchParams(window.location.search).get('modules');
  if (param === null) return null;
  const modules: ModuleInstance[] = [];
  for (const entry of param.split(',')) {
    const name = entry.trim();
    if (name === '') continue;
    const id = name.startsWith('mod-') ? name : `mod-${name}`;
    try {
      modules.push({ id: getModule(id).id, tier: 1 });
    } catch {
      // Unknown module id — skipped quietly
    }
  }
  return modules.length > 0 ? modules : null;
}

/**
 * Dev/test knob: `?reactor=4` overrides the reactor level on the RunState —
 * testing the cap shouldn't require Core Crystals. Null means "use the
 * RunState's actual reactorLevel" (the normal path).
 */
function resolveReactorOverride(): number | null {
  const param = new URLSearchParams(window.location.search).get('reactor');
  if (param === null) return null;
  const level = Number.parseInt(param, 10);
  return Number.isFinite(level) && level >= 0 ? level : null;
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
 * Dev/test knob: `?mode=orbit` skips the run loop and drops straight into the orbit screen
 * for a representative planet (6.1) — checking the generated planet + DROP without traversing
 * a lane first. DROP then proceeds into the normal surface flow.
 */
function resolveDevOrbit(): boolean {
  return new URLSearchParams(window.location.search).get('mode') === 'orbit';
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

function deriveRewardRng(run: RunState) {
  return deriveRng(run.seed, `boss-reward-${run.position.sector}`);
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
  const devOrbit = resolveDevOrbit();
  const moduleOverride = resolveModuleOverride();
  const reactorOverride = resolveReactorOverride();

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
  /** Fresh run from the URL knobs — `?modules=` replaces the hull's loadout. */
  const createRun = (): RunState => {
    const next = createRunState(urlSeed, hullId);
    if (moduleOverride !== null) {
      next.modules = [...moduleOverride];
    }
    if (reactorOverride !== null) {
      next.reactorLevel = reactorOverride;
    }
    return next;
  };

  let run: RunState = createRun();
  let map: SectorMap = generateSectorMap(urlSeed, run.position.sector);
  run.position.nodeId = map.startId;

  let phase: GamePhase = 'map';
  let combatMode: CombatMode | null = null;
  let surfaceMode: SurfaceMode | null = null;
  let orbitMode: OrbitMode | null = null;
  /** Node the active lane travels toward. */
  let laneDestination: string | null = null;
  // The planet most recently shown in orbit — carried into the surface drop so the ground
  // matches the orbit the player just saw (6.1 slice 2). Derived, never stored on RunState.
  let currentPlanet: PlanetDescriptor | null = null;
  /** Run loaded from storage, held until the title screen resolves. */
  let savedRun: RunState | null = null;
  /** The event presented at the current node, held while the player chooses (GDD §4.4). */
  let currentEvent: EventDef | null = null;

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
    orbitMode?.destroy();
    orbitMode = null;
  };

  /** Node arrival is the save point (ADR 003) — including the run's first node. */
  const enterMap = (): void => {
    store.save(run);
    emitMap();
    setPhase('map');
  };

  // Re-print affordability depends on the run's banked Scrap, which the surface
  // sim is deliberately blind to (3.2 invariant) — fill it in on the way out.
  const enrichSurfaceView = (view: SurfaceView): SurfaceView => {
    if (!view.cloneDead) return view;
    const canReprint = view.reprintScrapCost === 0 || run.resources.scrap >= view.reprintScrapCost;
    return { ...view, canReprint };
  };

  const enterSurface = (): void => {
    // Use the orbit's planet so ground and orbit agree; the `?mode=surface` dev path has no
    // orbit, so fall back to a descriptor derived from the current node (or a dev default).
    const descriptor =
      currentPlanet ?? planetForNode(run.seed, run.position.nodeId ?? 'dev-surface');
    surfaceMode = startSurfaceMode(
      app,
      {
        level: ROCKY_TEST_LEVEL,
        podWindowMs,
        loadout: projectLoadout(run.modules, run.reactorLevel),
        terrainRamp: surfaceRampFor(descriptor),
      },
      { onUpdate: (view) => callbacks.onSurfaceUpdate?.(enrichSurfaceView(view)) },
    );
    setPhase('surface');
  };

  // Planet arrival shows the generated planet in orbit before the drop (6.1). The descriptor
  // is derived from the run seed + node id (sim/planet), so the orbit and surface always agree.
  const enterOrbit = (nodeId: string): void => {
    const descriptor = planetForNode(run.seed, nodeId);
    currentPlanet = descriptor;
    const shipModules = run.modules.map((m) => getModule(m.id).name);
    orbitMode = startOrbitMode(app, descriptor, shipModules);
    callbacks.onOrbitUpdate?.({ name: PLANET_TYPES[descriptor.type].name, type: descriptor.type });
    setPhase('orbit');
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

  const enterShop = (): void => {
    store.save(run);
    callbacks.onStationUpdate?.(buildMerchantView(run));
    callbacks.onShipUpdate?.(buildShipView(run));
    setPhase('shop');
  };

  const enterEngineer = (): void => {
    store.save(run);
    callbacks.onStationUpdate?.(buildEngineerView(run));
    callbacks.onShipUpdate?.(buildShipView(run));
    setPhase('engineer');
  };

  const enterEvent = (): void => {
    const nodeId = run.position.nodeId;
    if (nodeId === null) return;
    // Deterministic per node (ADR 005) — resume lands on the same event.
    currentEvent = pickEvent(run.seed, run.position.sector, nodeId);
    store.save(run);
    callbacks.onEventUpdate?.(buildEventView(run, currentEvent));
    callbacks.onShipUpdate?.(buildShipView(run));
    setPhase('event');
  };

  const emitShipAndStation = (): void => {
    callbacks.onShipUpdate?.(buildShipView(run));
    if (phase === 'shop') {
      callbacks.onStationUpdate?.(buildMerchantView(run));
    } else if (phase === 'engineer') {
      callbacks.onStationUpdate?.(buildEngineerView(run));
    }
  };

  const startBossFight = (): void => {
    combatMode = startCombatMode(
      app,
      { run, lane: null, enemyPool: ['enemy-gatemaw'] },
      {
        onUpdate: (view) => callbacks.onCombatUpdate(view),
        onArrival: (): void => {
          // Boss fight is no-lane — arrival means victory
          destroyModes();
          store.save(run);
          emitMap();
          setPhase('boss-reward');
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
    laneDestination = null;
    if (node.type === 'cache') {
      run.resources.scrap += node.cacheScrap ?? 0;
    }
    if (node.type === 'planet') {
      enterOrbit(node.id);
      return;
    }
    if (node.type === 'shop') {
      enterShop();
      return;
    }
    if (node.type === 'engineer') {
      enterEngineer();
      return;
    }
    if (node.type === 'event') {
      enterEvent();
      return;
    }
    if (node.type === 'gate') {
      startBossFight();
      return;
    }
    enterMap();
  };

  // ── Boot ────────────────────────────────────────────────────────────────
  if (devSurface) {
    enterSurface();
  } else if (devOrbit) {
    enterOrbit('dev-orbit');
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
    playCard(handIndex: number, discardIndices?: readonly number[]): void {
      combatMode?.playCard(handIndex, discardIndices);
    },
    jettisonCard(handIndex: number): void {
      combatMode?.jettisonCard(handIndex);
    },
    selectTarget(target: number | null): void {
      combatMode?.selectTarget(target);
    },
    useInnate(handIndex?: number): void {
      combatMode?.useInnate(handIndex);
    },
    endTurn(): void {
      combatMode?.endTurn();
    },
    continueTravel(): void {
      combatMode?.continueTravel();
    },
    selectNode(nodeId: string): void {
      if (phase !== 'map' || run.position.nodeId === null) return;
      const edge = edgesFrom(map, run.position.nodeId).find((e) => e.to === nodeId);
      if (edge === undefined) return;
      laneDestination = nodeId;
      startLane(edge.lane);
    },
    dropToSurface(): void {
      if (phase !== 'orbit') return;
      orbitMode?.destroy();
      orbitMode = null;
      enterSurface();
    },
    launchPod(): void {
      surfaceMode?.launchPod();
    },
    abandonSurface(): void {
      surfaceMode?.abandon();
    },
    reprintClone(): void {
      if (phase !== 'surface' || surfaceMode === null) return;
      const state = surfaceMode.state();
      if (!state.clone.dead) return;
      // First re-print per visit is free; subsequent ones cost Scrap (GDD §6.4).
      if (state.reprintsUsed > 0) {
        if (run.resources.scrap < REPRINT_SCRAP_COST) return;
        run.resources.scrap -= REPRINT_SCRAP_COST;
      }
      surfaceMode.reprint();
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
      run = createRun();
      map = generateSectorMap(urlSeed, run.position.sector);
      run.position.nodeId = map.startId;
      enterMap();
    },
    surfaceInput(action: SurfaceAction, pressed: boolean): void {
      surfaceMode?.input(action, pressed);
    },
    openWorkbench(): void {
      // Reachable from the map and from station nodes (4.8) — install/uninstall
      // already accept those phases; this just re-emits the current ship view.
      if (phase !== 'map' && phase !== 'shop' && phase !== 'engineer') return;
      callbacks.onShipUpdate?.(buildShipView(run));
    },
    closeWorkbench(): void {
      // React controls its own overlay state — this is the sim-side hook.
      // No state to clear; the map phase continues.
    },
    installModule(cargoIndex: number): void {
      if (phase !== 'map' && phase !== 'shop' && phase !== 'engineer') return;
      const result = installModule(run, cargoIndex);
      if (!result.ok) return;
      store.save(run);
      emitShipAndStation();
    },
    uninstallModule(moduleIndex: number): void {
      if (phase !== 'map' && phase !== 'shop' && phase !== 'engineer') return;
      const result = uninstallModule(run, moduleIndex);
      if (!result.ok) return;
      store.save(run);
      emitShipAndStation();
    },
    craftModule(moduleId: string): void {
      if (phase !== 'map') return;
      const result = craftModule(run, moduleId);
      if (!result.ok) return;
      store.save(run);
      callbacks.onShipUpdate?.(buildShipView(run));
    },
    upgradeReactor(): void {
      if (phase !== 'map') return;
      const result = upgradeReactor(run);
      if (!result.ok) return;
      store.save(run);
      callbacks.onShipUpdate?.(buildShipView(run));
    },
    buyModule(offerIndex: number): void {
      if (phase !== 'shop') return;
      const { sector, nodeId } = run.position;
      // Pass purchased set so the index aligns with the filtered offer list (4.13).
      const offers = generateShopOffers(run.seed, sector, nodeId!, run.purchasedOffers);
      const offer = offers[offerIndex];
      if (offer === undefined) return;
      const result = buyModule(run, offer.moduleId);
      if (!result.ok) return;
      // Record the purchase so this offer is sold out on resume (4.13 — stock = 1).
      run.purchasedOffers.push(shopOfferKey(sector, nodeId!, offer.moduleId));
      store.save(run);
      emitShipAndStation();
    },
    sellBiominerals(count: number): void {
      if (phase !== 'shop') return;
      const result = sellBiominerals(run, count);
      if (!result.ok) return;
      store.save(run);
      emitShipAndStation();
    },
    repairHull(): void {
      if (phase !== 'engineer') return;
      const result = repairHull(run);
      if (!result.ok) return;
      store.save(run);
      emitShipAndStation();
    },
    upgradeModule(moduleIndex: number): void {
      if (phase !== 'engineer') return;
      const result = upgradeModule(run, moduleIndex);
      if (!result.ok) return;
      store.save(run);
      emitShipAndStation();
    },
    leaveStation(): void {
      if (phase !== 'shop' && phase !== 'engineer') return;
      enterMap();
    },
    chooseEventChoice(choiceIndex: number, moduleIndex?: number): void {
      if (phase !== 'event' || currentEvent === null) return;
      const choice = currentEvent.choices[choiceIndex];
      if (choice === undefined) return;
      // Guard a module-target choice before touching the sim — a stale tap is a no-op.
      if (choice.requiresModuleTarget === true) {
        if (
          moduleIndex === undefined ||
          !Number.isInteger(moduleIndex) ||
          moduleIndex < 0 ||
          moduleIndex >= run.modules.length
        ) {
          return;
        }
      }
      // A cost the player can't pay is a no-op (UI marks it unaffordable).
      for (const outcome of choice.outcomes) {
        if (outcome.kind === 'lose-resources' && run.resources[outcome.resource] < outcome.amount) {
          return;
        }
      }
      applyEventChoice(run, currentEvent.id, choiceIndex, moduleIndex);
      currentEvent = null;
      enterMap();
    },
    chooseBossReward(option: BossRewardOption): void {
      if (phase !== 'boss-reward') return;
      switch (option) {
        case 'core-crystal':
          run.resources.coreCrystals += 1;
          break;
        case 'mk2-module': {
          const rng = deriveRewardRng(run);
          const upgradeable = run.modules.filter(
            (m) => m.tier === 1 && getModule(m.id).tiers.mk2 !== undefined,
          );
          if (upgradeable.length > 0) {
            const pick = upgradeable[rng.int(0, upgradeable.length)];
            run.cargo.push({ id: pick.id, tier: 2 });
          } else {
            run.resources.coreCrystals += 1;
          }
          break;
        }
        case 'blueprint-cache':
          run.resources.blueprints += 2;
          run.resources.scrap += 15;
          break;
      }
      store.clear();
      emitMap();
      setPhase('sector-complete');
    },
    destroy(): void {
      destroyModes();
      observer.disconnect();
      app.destroy(true, { children: true, texture: true });
    },
  };
}
