import { Application, TextureSource } from 'pixi.js';

import { ROCKY_TEST_LEVEL } from '@/game/data/levels';
import { FIXED_DT_MS, MAX_FRAME_MS, POD_WINDOW_MS } from '@/game/data/surface';
import { computeScale, VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from '@/renderer/pixel-scale';
import { createSpaceRenderer } from '@/renderer/space-renderer';
import type { SpaceRenderer } from '@/renderer/space-renderer';
import { createSurfaceRenderer } from '@/renderer/surface-renderer';
import type { SurfaceRenderer } from '@/renderer/surface-renderer';
import { buildCombatView } from './combat-view';
import type { CombatView } from './combat-view';
import { getEnemy, getHull } from './data';
import type { EnemyId } from './data';
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
} from './sim/combat';
import type { CombatState } from './sim/combat';
import { createRunState } from './sim/run-state';
import type { RunState } from './sim/run-state';
import { parseSeedParam, seedToSearchParam } from './sim/seed-url';
import { advanceLane, createLane } from './sim/travel';
import type { LaneState } from './sim/travel';
import type { InputState } from './surface/clone';
import { createSurface, updateSurface } from './surface/surface';
import type { SurfaceState } from './surface/surface';
import { buildSurfaceView, surfaceViewEquals } from './surface-view';
import type { SurfaceView } from './surface-view';

/**
 * The React↔game boundary (ADR 001). React components import this module and nothing
 * else from src/game/: commands flow in through the GameHandle, state flows out as
 * CombatView snapshots through onCombatUpdate — once per event, never per frame.
 *
 * Command methods guard instead of throwing: the sim's loud-failure policy is for
 * programming errors, but a double-tap racing a state update is normal pointer input
 * and must be a quiet no-op.
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
export type { SurfaceView } from './surface-view';

export interface GameCallbacks {
  onCombatUpdate(view: CombatView): void;
  onScaleChange?(zoom: number): void;
  /** Fired once after init with the resolved game mode. */
  onModeChange?(mode: 'combat' | 'surface'): void;
  /**
   * Surface mode only: fired once per discrete change (pod second tick,
   * mining, deposit, launch) — never per frame.
   */
  onSurfaceUpdate?(view: SurfaceView): void;
}

export interface GameHandle {
  readonly seed: string;
  /** Which mode was resolved at init time. */
  readonly mode: 'combat' | 'surface';
  playCard(handIndex: number): void;
  /** Hull innate ability; handIndex only for card-targeted innates (Slipstream). */
  useInnate(handIndex?: number): void;
  endTurn(): void;
  /** Pays the anchor enemy's Scrap toll — the blockade lets you pass (GDD §5.7). */
  payToll(): void;
  /**
   * After victory or escape: commits the result to the run, carries malfunctions and
   * travel progress into the lane, and travels on — next encounter, or arrival and a
   * fresh lane (systems reset).
   */
  continueTravel(): void;
  /** Fresh run from the same seed — the post-defeat restart. */
  restartRun(): void;
  /**
   * Surface mode input: called by TouchControls on pointer events.
   * No-op in combat mode.
   */
  surfaceInput(action: 'left' | 'right' | 'jump' | 'attack' | 'dash', pressed: boolean): void;
  destroy(): void;
}

/** Weapon-rich starting deck — the winnable first playable fight. Hull select is Phase 5. */
const DEFAULT_HULL = 'hull-gunship';

/**
 * Dev/test knob until hull select lands (Phase 5): `?hull=hull-scout` etc. exercises
 * the other innate abilities in the browser. Unknown values fall back quietly.
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
 * Dev/test knob until the sector map drives encounters (4.1): `?enemy=enemy-anchormaw`
 * forces every lane encounter to one enemy — lane picks are random, and each enemy
 * must be reachable on demand for manual testing. Unknown values fall back quietly.
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
 * Dev/test knob until the sector map drives mode entry (4.1): `?mode=surface`
 * activates the platformer. Unknown values fall back to 'combat'.
 */
function resolveMode(): 'combat' | 'surface' {
  const param = new URLSearchParams(window.location.search).get('mode');
  return param === 'surface' ? 'surface' : 'combat';
}

/**
 * Dev/test knob: `?pod=20` sets the launch window in seconds — manual testing
 * shouldn't take 5 real minutes. Invalid values fall back to POD_WINDOW_MS.
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
 * shareable/reproducible. Entropy is allowed here at the edge — inside the sim all
 * randomness stays on the seeded streams.
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

export async function initGame(host: HTMLElement, callbacks: GameCallbacks): Promise<GameHandle> {
  const seed = resolveSeed();
  const gameMode = resolveMode();

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

  // ── Surface mode ──────────────────────────────────────────────────────────
  if (gameMode === 'surface') {
    const podWindowMs = resolvePodWindowMs();
    let surfaceState: SurfaceState = createSurface(ROCKY_TEST_LEVEL, { podWindowMs });
    const surfaceRenderer: SurfaceRenderer = createSurfaceRenderer(app);

    // Held-key snapshot owned by main.ts; rising-edge detection is in clone.ts
    const input: InputState = {
      left: false,
      right: false,
      jump: false,
      attack: false,
      dash: false,
    };

    // Emit a SurfaceView only when it differs from the last one — once per
    // discrete change (timer second, mining, deposit, launch), never per frame.
    let lastView: SurfaceView | null = null;
    const emitSurface = (): void => {
      const view = buildSurfaceView(surfaceState);
      if (lastView === null || !surfaceViewEquals(lastView, view)) {
        lastView = view;
        callbacks.onSurfaceUpdate?.(view);
      }
    };

    // Keyboard listeners — removed in destroy()
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.repeat) return;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') input.left = true;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') input.right = true;
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') input.jump = true;
      if (e.code === 'KeyX' || e.code === 'KeyJ') input.attack = true;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyK') input.dash = true;
    };
    const onKeyUp = (e: KeyboardEvent): void => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') input.left = false;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') input.right = false;
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') input.jump = false;
      if (e.code === 'KeyX' || e.code === 'KeyJ') input.attack = false;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyK')
        input.dash = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // Fixed-timestep accumulator loop (ADR 004)
    let acc = 0;
    const tickFn = (ticker: { deltaMS: number }): void => {
      acc += Math.min(ticker.deltaMS, MAX_FRAME_MS);
      while (acc >= FIXED_DT_MS) {
        updateSurface(surfaceState, input, FIXED_DT_MS);
        acc -= FIXED_DT_MS;
      }
      surfaceRenderer.sync(surfaceState);
      emitSurface();
    };
    app.ticker.add(tickFn);

    // Notify React once so it switches to surface UI, then seed the HUD
    callbacks.onModeChange?.('surface');
    emitSurface();

    return {
      seed,
      mode: 'surface',
      // Combat commands are no-ops in surface mode
      playCard(): void {},
      useInnate(): void {},
      endTurn(): void {},
      payToll(): void {},
      continueTravel(): void {},
      restartRun(): void {
        // Fresh drop on the same level — the post-launch "Drop Again" button
        if (surfaceState.outcome === 'ongoing') return;
        surfaceState = createSurface(ROCKY_TEST_LEVEL, { podWindowMs });
        lastView = null;
        emitSurface();
      },
      surfaceInput(action, pressed): void {
        input[action] = pressed;
      },
      destroy(): void {
        app.ticker.remove(tickFn);
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        observer.disconnect();
        surfaceRenderer.destroy();
        app.destroy(true, { children: true, texture: true });
      },
    };
  }

  // ── Combat mode ───────────────────────────────────────────────────────────
  const renderer: SpaceRenderer = createSpaceRenderer(app);

  const hullId = resolveHull();
  const enemyPool = resolveEnemyPool();
  let run: RunState = createRunState(seed, hullId);
  let lane: LaneState = createLane(run, enemyPool);

  // Travels to the next fight; on arrival the lane ends — systems reset (malfunctions
  // gone with it) — and a fresh lane begins. A new lane always has an encounter ahead,
  // so the loop terminates. Real arrival lands on a map node in 4.1; until then lanes
  // chain directly.
  const nextEncounter = (): CombatState => {
    for (;;) {
      const step = advanceLane(lane);
      if (step.kind === 'encounter') {
        return createCombat(run, step.enemyId, {
          distance: lane.distance,
          progressAtStart: lane.progress,
          malfunctioning: lane.malfunctioning,
        });
      }
      lane = createLane(run, enemyPool);
    }
  };

  let combat: CombatState = nextEncounter();

  const emit = (): void => {
    const view = buildCombatView(combat);
    renderer.sync(view);
    callbacks.onCombatUpdate(view);
  };

  emit();
  callbacks.onModeChange?.('combat');

  return {
    seed,
    mode: 'combat',
    playCard(handIndex: number): void {
      if (combat.outcome !== 'ongoing') return;
      const card = combat.hand[handIndex];
      if (card === undefined || !isCardPlayable(card) || cardPlayCost(combat, card) > combat.ap)
        return;
      playCard(combat, handIndex);
      emit();
    },
    useInnate(handIndex?: number): void {
      if (!canUseInnate(combat)) return;
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
      if (combat.outcome !== 'ongoing') return;
      endTurn(combat);
      emit();
    },
    payToll(): void {
      if (!canPayToll(combat)) return;
      payToll(combat);
      emit();
    },
    continueTravel(): void {
      if (combat.outcome !== 'victory' && combat.outcome !== 'escaped') return;
      applyCombatResult(run, combat);
      lane.progress = Math.min(lane.distance, lane.progress + combat.travelProgress);
      lane.malfunctioning = [...combat.malfunctioning];
      combat = nextEncounter();
      emit();
    },
    restartRun(): void {
      if (combat.outcome !== 'defeat') return;
      run = createRunState(seed, hullId);
      lane = createLane(run, enemyPool);
      combat = nextEncounter();
      emit();
    },
    surfaceInput(): void {
      // No-op in combat mode
    },
    destroy(): void {
      observer.disconnect();
      renderer.destroy();
      app.destroy(true, { children: true, texture: true });
    },
  };
}
