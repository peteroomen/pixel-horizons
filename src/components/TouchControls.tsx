'use client';

import type { PointerEvent } from 'react';

type SurfaceAction = 'left' | 'right' | 'jump' | 'attack' | 'dash';

interface TouchControlsProps {
  onInput: (action: SurfaceAction, pressed: boolean) => void;
  /** Render the DASH button only when the loadout projects a dash (GDD §6.3). */
  hasDash?: boolean;
}

/**
 * On-screen touch / pointer controls for surface mode.
 *
 * Layout:
 *   Bottom-left : ◀ ▶ (directional)
 *   Bottom-right: B (attack) | A (jump)
 *
 * All events are pointer events — no mouse- or touch-specific events — so they
 * work with mouse on desktop and touch on mobile by construction.
 *
 * Pointer-up/leave/cancel anywhere on a button releases it so buttons can't stick.
 */
export default function TouchControls({ onInput, hasDash = false }: TouchControlsProps) {
  function makeHandlers(action: SurfaceAction) {
    return {
      onPointerDown(e: PointerEvent<HTMLButtonElement>) {
        e.currentTarget.setPointerCapture(e.pointerId);
        onInput(action, true);
      },
      onPointerUp() {
        onInput(action, false);
      },
      onPointerLeave() {
        onInput(action, false);
      },
      onPointerCancel() {
        onInput(action, false);
      },
    };
  }

  const btnBase =
    'select-none touch-none flex items-center justify-center rounded ' +
    'border-2 border-[#4a4a6a] bg-[#1a1a2e]/80 text-[#c8d8e8] ' +
    'active:bg-[#2a2a4e]/90 text-xs font-mono font-bold';

  return (
    // Wrapper is pointer-events-none; individual buttons are pointer-events-auto
    <div className="pointer-events-none absolute inset-0">
      {/* D-pad — bottom-left */}
      <div className="pointer-events-none absolute bottom-6 left-4 flex gap-2">
        <button
          className={`${btnBase} pointer-events-auto h-12 w-12`}
          aria-label="Move left"
          {...makeHandlers('left')}
        >
          ◀
        </button>
        <button
          className={`${btnBase} pointer-events-auto h-12 w-12`}
          aria-label="Move right"
          {...makeHandlers('right')}
        >
          ▶
        </button>
      </div>

      {/* Action buttons — bottom-right */}
      <div className="pointer-events-none absolute bottom-6 right-4 flex gap-2">
        {hasDash && (
          <button
            className={`${btnBase} pointer-events-auto h-12 w-12`}
            aria-label="Dash"
            {...makeHandlers('dash')}
          >
            D
          </button>
        )}
        <button
          className={`${btnBase} pointer-events-auto h-12 w-12`}
          aria-label="Attack"
          {...makeHandlers('attack')}
        >
          B
        </button>
        <button
          className={`${btnBase} pointer-events-auto h-12 w-12`}
          aria-label="Jump"
          {...makeHandlers('jump')}
        >
          A
        </button>
      </div>
    </div>
  );
}
