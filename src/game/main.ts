import { Application, TextureSource } from 'pixi.js';

import { computeScale, VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from '@/renderer/pixel-scale';
import { createSpaceRenderer } from '@/renderer/space-renderer';
import type { SpaceRenderer } from '@/renderer/space-renderer';
import { buildCombatView } from './combat-view';
import type { CombatView } from './combat-view';
import { ENEMY_DEFS, getHull } from './data';
import {
  applyCombatResult,
  canUseInnate,
  cardPlayCost,
  createCombat,
  endTurn,
  playCard,
  activateInnate,
} from './sim/combat';
import type { CombatState } from './sim/combat';
import { createRunState } from './sim/run-state';
import type { RunState } from './sim/run-state';
import { parseSeedParam, seedToSearchParam } from './sim/seed-url';

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
  ModuleView,
  RevealedIntent,
  ShieldLayerView,
} from './combat-view';

export interface GameCallbacks {
  onCombatUpdate(view: CombatView): void;
  onScaleChange?(zoom: number): void;
}

export interface GameHandle {
  readonly seed: string;
  playCard(handIndex: number): void;
  /** Hull innate ability; handIndex only for card-targeted innates (Slipstream). */
  useInnate(handIndex?: number): void;
  endTurn(): void;
  /** Victory only: commits the result to the run (hull damage persists, RNG stream advances) and starts the next fight. */
  nextFight(): void;
  /** Fresh run from the same seed — the post-defeat restart. */
  restartRun(): void;
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

  const renderer: SpaceRenderer = createSpaceRenderer(app);

  const hullId = resolveHull();
  // Placeholder encounter order until lanes/map-gen pick enemies (2.4): fights walk
  // the roster so every enemy is reachable in the browser.
  let enemyIndex = 0;
  let run: RunState = createRunState(seed, hullId);
  let combat: CombatState = createCombat(run, ENEMY_DEFS[enemyIndex].id);

  const emit = (): void => {
    const view = buildCombatView(combat);
    renderer.sync(view);
    callbacks.onCombatUpdate(view);
  };

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

  emit();

  return {
    seed,
    playCard(handIndex: number): void {
      if (combat.outcome !== 'ongoing') return;
      const card = combat.hand[handIndex];
      if (card === undefined || cardPlayCost(combat, card) > combat.ap) return;
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
    nextFight(): void {
      if (combat.outcome !== 'victory') return;
      applyCombatResult(run, combat);
      enemyIndex = (enemyIndex + 1) % ENEMY_DEFS.length;
      combat = createCombat(run, ENEMY_DEFS[enemyIndex].id);
      emit();
    },
    restartRun(): void {
      if (combat.outcome !== 'defeat') return;
      enemyIndex = 0;
      run = createRunState(seed, hullId);
      combat = createCombat(run, ENEMY_DEFS[enemyIndex].id);
      emit();
    },
    destroy(): void {
      observer.disconnect();
      renderer.destroy();
      app.destroy(true, { children: true, texture: true });
    },
  };
}
