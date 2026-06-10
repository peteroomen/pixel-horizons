import { Application, TextureSource } from 'pixi.js';

import { computeScale, VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from '@/renderer/pixel-scale';
import { createSpaceRenderer } from '@/renderer/space-renderer';
import type { SpaceRenderer } from '@/renderer/space-renderer';
import { buildCombatView } from './combat-view';
import type { CombatView } from './combat-view';
import { getCard } from './data';
import { applyCombatResult, createCombat, endTurn, playCard } from './sim/combat';
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

export type { CardView, CombatView, RevealedIntent, ShieldLayerView } from './combat-view';

export interface GameCallbacks {
  onCombatUpdate(view: CombatView): void;
  onScaleChange?(zoom: number): void;
}

export interface GameHandle {
  readonly seed: string;
  playCard(handIndex: number): void;
  endTurn(): void;
  /** Victory only: commits the result to the run (hull damage persists, RNG stream advances) and starts the next fight. */
  nextFight(): void;
  /** Fresh run from the same seed — the post-defeat restart. */
  restartRun(): void;
  destroy(): void;
}

const FIRST_ENEMY = 'enemy-lamprey';
/** Weapon-rich starting deck — the winnable first playable fight. Hull select is Phase 5. */
const DEFAULT_HULL = 'hull-gunship';

/**
 * The session seed: a valid `?seed=` in the URL wins; otherwise a fresh seed is
 * generated from platform entropy and written back into the URL so every run is
 * shareable/reproducible. Entropy is allowed here at the edge — inside the sim all
 * randomness stays on the seeded streams.
 */
function resolveSeed(): string {
  const fromUrl = parseSeedParam(window.location.search);
  const seed = fromUrl ?? generateSeed();
  window.history.replaceState(null, '', seedToSearchParam(seed));
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

  let run: RunState = createRunState(seed, DEFAULT_HULL);
  let combat: CombatState = createCombat(run, FIRST_ENEMY);

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
      const cardId = combat.hand[handIndex];
      if (cardId === undefined || getCard(cardId).apCost > combat.ap) return;
      playCard(combat, handIndex);
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
      combat = createCombat(run, FIRST_ENEMY);
      emit();
    },
    restartRun(): void {
      if (combat.outcome !== 'defeat') return;
      run = createRunState(seed, DEFAULT_HULL);
      combat = createCombat(run, FIRST_ENEMY);
      emit();
    },
    destroy(): void {
      observer.disconnect();
      renderer.destroy();
      app.destroy(true, { children: true, texture: true });
    },
  };
}
