'use client';

import { useEffect, useRef } from 'react';

import { initGame } from '@/game/main';
import type { CombatView, GameHandle, GamePhase, MapView, SurfaceView } from '@/game/main';

interface GameCanvasProps {
  onCombatUpdate: (view: CombatView) => void;
  onReady: (handle: GameHandle) => void;
  onScaleChange?: (zoom: number) => void;
  onPhaseChange?: (phase: GamePhase) => void;
  onSurfaceUpdate?: (view: SurfaceView) => void;
  onMapUpdate?: (view: MapView) => void;
}

/**
 * Thin lifecycle wrapper around initGame/destroy. StrictMode double-mount safe: the
 * async init races against unmount via the `cancelled` flag — if the effect is cleaned
 * up before init resolves, the handle is destroyed instead of surfaced, so there is
 * never a duplicate canvas or a leaked WebGL context.
 */
export default function GameCanvas({
  onCombatUpdate,
  onReady,
  onScaleChange,
  onPhaseChange,
  onSurfaceUpdate,
  onMapUpdate,
}: GameCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const callbacksRef = useRef({
    onCombatUpdate,
    onReady,
    onScaleChange,
    onPhaseChange,
    onSurfaceUpdate,
    onMapUpdate,
  });

  useEffect(() => {
    callbacksRef.current = {
      onCombatUpdate,
      onReady,
      onScaleChange,
      onPhaseChange,
      onSurfaceUpdate,
      onMapUpdate,
    };
  }, [onCombatUpdate, onReady, onScaleChange, onPhaseChange, onSurfaceUpdate, onMapUpdate]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let cancelled = false;
    let handle: GameHandle | null = null;

    (async () => {
      const candidate = await initGame(host, {
        onCombatUpdate: (view) => callbacksRef.current.onCombatUpdate(view),
        onScaleChange: (zoom) => callbacksRef.current.onScaleChange?.(zoom),
        onPhaseChange: (phase) => callbacksRef.current.onPhaseChange?.(phase),
        onSurfaceUpdate: (view) => callbacksRef.current.onSurfaceUpdate?.(view),
        onMapUpdate: (view) => callbacksRef.current.onMapUpdate?.(view),
      });
      if (cancelled) {
        candidate.destroy();
        return;
      }
      handle = candidate;
      callbacksRef.current.onReady(handle);
    })();

    return () => {
      cancelled = true;
      handle?.destroy();
      handle = null;
    };
  }, []);

  return <div ref={hostRef} className="flex h-full w-full items-center justify-center" />;
}
