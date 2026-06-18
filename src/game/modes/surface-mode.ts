import type { Application } from 'pixi.js';

import { FIXED_DT_MS, MAX_FRAME_MS } from '@/game/data/surface';
import type { Ramp } from '@/renderer/palette';
import { createSurfaceRenderer } from '@/renderer/surface-renderer';
import type { SurfaceRenderer } from '@/renderer/surface-renderer';
import type { InputState } from '../surface/clone';
import type { SurfaceLoadout } from '../surface/items';
import {
  abandonSurface,
  createSurface,
  launchPod,
  reprintClone,
  updateSurface,
} from '../surface/surface';
import type { SurfaceState } from '../surface/surface';
import { buildSurfaceView, surfaceViewEquals } from '../surface-view';
import type { SurfaceView } from '../surface-view';

/**
 * Surface mode controller: owns the surface renderer, keyboard listeners, and
 * the fixed-timestep accumulator loop (ADR 004) for the duration of one planet
 * drop. Created on phase entry, destroyed symmetrically on exit — main.ts only
 * orchestrates.
 */

export type SurfaceAction = keyof InputState;

export interface SurfaceModeOptions {
  level: string[];
  podWindowMs: number;
  loadout: SurfaceLoadout;
  /** Planet terrain ramp (6.1 slice 2) — recolours the rock tiles to match the orbit planet. */
  terrainRamp: Ramp;
}

export interface SurfaceModeCallbacks {
  /** Once per discrete change (pod second tick, mining, deposit, launch) — never per frame. */
  onUpdate(view: SurfaceView): void;
}

export interface SurfaceMode {
  input(action: SurfaceAction, pressed: boolean): void;
  /** Manual early launch — no-op unless the clone is on the pod. */
  launchPod(): void;
  /** Recall the clone to orbit — the always-available soft-lock escape valve. */
  abandon(): void;
  /** Re-print the clone after death (economy is gated by the orchestrator). */
  reprint(): void;
  /** Read-only access for the orchestrator (banking deposits, re-print economy). */
  state(): SurfaceState;
  destroy(): void;
}

export function startSurfaceMode(
  app: Application,
  options: SurfaceModeOptions,
  callbacks: SurfaceModeCallbacks,
): SurfaceMode {
  const surfaceState: SurfaceState = createSurface(options.level, {
    podWindowMs: options.podWindowMs,
    loadout: options.loadout,
  });
  const renderer: SurfaceRenderer = createSurfaceRenderer(app, options.terrainRamp);

  // Held-key snapshot owned by the mode; rising-edge detection is in clone.ts
  const input: InputState = { left: false, right: false, jump: false, attack: false, dash: false };

  // Emit a SurfaceView only when it differs from the last one
  let lastView: SurfaceView | null = null;
  const emit = (): void => {
    const view = buildSurfaceView(surfaceState);
    if (lastView === null || !surfaceViewEquals(lastView, view)) {
      lastView = view;
      callbacks.onUpdate(view);
    }
  };

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
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyK') input.dash = false;
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
    renderer.sync(surfaceState);
    emit();
  };
  app.ticker.add(tickFn);

  // Seed the HUD immediately
  emit();

  return {
    input(action, pressed): void {
      input[action] = pressed;
    },
    launchPod(): void {
      launchPod(surfaceState);
      emit();
    },
    abandon(): void {
      abandonSurface(surfaceState);
      emit();
    },
    reprint(): void {
      reprintClone(surfaceState);
      emit();
    },
    state(): SurfaceState {
      return surfaceState;
    },
    destroy(): void {
      app.ticker.remove(tickFn);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      renderer.destroy();
    },
  };
}
