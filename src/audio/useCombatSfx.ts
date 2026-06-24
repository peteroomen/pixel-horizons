'use client';

import { useEffect, useRef } from 'react';

import type { CombatView } from '@/game/main';
import { apSpend, cardDraw, enemyHit, hullHit, shieldBreak, shieldUp, victory } from './sounds';

/**
 * Diffs successive CombatView snapshots and fires sounds on relevant transitions.
 * Mirrors the useHitFlash pattern — stores prev in a ref, runs in useEffect.
 * The first view after mount is recorded but never triggers sounds (no "was").
 * Called once in page.tsx; fires are side-effects only, returns nothing.
 */
export function useCombatSfx(view: CombatView | null): void {
  const prev = useRef<CombatView | null>(null);

  useEffect(() => {
    if (view === null) {
      prev.current = null;
      return;
    }

    const p = prev.current;
    prev.current = view;

    // First snapshot after mount — record but don't fire anything.
    if (p === null) return;

    // Hull hit
    if (view.hullHp < p.hullHp) hullHit();

    // Enemy hit
    if (view.enemyHp < p.enemyHp) enemyHit();

    // Shield transitions (per layer)
    view.shields.forEach((layer, i) => {
      const was = p.shields[i];
      if (!was) return;
      if (!was.up && layer.up) shieldUp();
      if (was.up && !layer.up) shieldBreak();
    });

    // AP spend (any decrease, ignoring end-of-turn refill)
    if (view.ap < p.ap) apSpend();

    // Card drawn (hand grew)
    if (view.hand.length > p.hand.length) cardDraw();

    // Victory
    if (view.outcome !== null && p.outcome === null) victory();
  }, [view]);
}
