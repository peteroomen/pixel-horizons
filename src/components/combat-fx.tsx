'use client';

import { motion, useAnimationControls, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

import { hpDrop } from './combat-fx-core';

/**
 * The React side of the combat juice layer (Slice 6.6). Bar flashes and pip pops are
 * driven off the change in a single HP / pip value between renders — combat pushes a
 * fresh `CombatView` once per event (never per frame), so a value falling between two
 * renders *is* a hit. The eye-catching part — floating damage numbers — lives in the
 * Pixi world over the ship/enemy sprites (`space-renderer.ts`), not here, so it shares a
 * layer with the future weapon effects. All motion respects `prefers-reduced-motion`.
 */

const FLASH_MS = 280;

/**
 * Watches a single HP value and returns a key that bumps each time it drops, so the
 * decorated bar can flash/shake (see `HitFlash`). The first reading never counts as a hit.
 */
export function useHitFlash(hp: number): number {
  const prev = useRef<number | null>(null);
  const [hitKey, setHitKey] = useState(0);

  useEffect(() => {
    const drop = hpDrop(prev.current, hp);
    prev.current = hp;
    if (drop !== null) setHitKey((k) => k + 1);
  }, [hp]);

  return hitKey;
}

/**
 * Wraps an element and gives it a brightness flash + micro-shake whenever `hitKey`
 * changes (the first render is skipped, so mounting doesn't flash). Reduced motion keeps
 * the brightness pop and drops the translation.
 */
export function HitFlash({
  hitKey,
  className,
  children,
}: {
  hitKey: number;
  className?: string;
  children: React.ReactNode;
}) {
  const reduced = useReducedMotion() ?? false;
  const controls = useAnimationControls();
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    controls.start(
      reduced
        ? { filter: ['brightness(2.4)', 'brightness(1)'] }
        : { x: [0, -3, 3, -2, 2, 0], filter: ['brightness(2.4)', 'brightness(1)'] },
      { duration: FLASH_MS / 1000, ease: 'easeOut' },
    );
  }, [hitKey, controls, reduced]);

  return (
    <motion.div animate={controls} className={className}>
      {children}
    </motion.div>
  );
}

/**
 * A status pip (AP / shield layer) that pops in when it lights up and flashes red when
 * it drops — the per-pip feedback the HUD was missing. `on` is the lit state; the rest
 * is styling passed straight through. Reduced motion keeps the colour change only.
 */
export function PopPip({
  on,
  className,
  litClassName,
  offClassName,
  children,
}: {
  on: boolean;
  className: string;
  litClassName: string;
  offClassName: string;
  children?: React.ReactNode;
}) {
  const reduced = useReducedMotion() ?? false;
  const controls = useAnimationControls();
  const flash = useAnimationControls();
  const prev = useRef(on);

  useEffect(() => {
    if (on === prev.current) return;
    if (!reduced) {
      // Lit → a quick scale pop; dropped → a scale recoil + a one-shot red flash overlay.
      controls.start(on ? { scale: [1.7, 1] } : { scale: [1.4, 1] }, {
        duration: 0.32,
        ease: 'easeOut',
      });
      if (!on) {
        flash.start({ opacity: [1, 0] }, { duration: 0.32, ease: 'easeOut' });
      }
    }
    prev.current = on;
  }, [on, controls, flash, reduced]);

  return (
    <motion.span
      animate={controls}
      className={`relative ${className} ${on ? litClassName : offClassName}`}
    >
      {/* The red drop-flash is a separate overlay, NOT the pip's own backgroundColor: animating
          the pip background leaves a stuck inline value that hides the lit/off colour even after
          the shield recharges (the vanishing-shield-square bug). */}
      <motion.span
        aria-hidden
        animate={flash}
        initial={{ opacity: 0 }}
        className="pointer-events-none absolute inset-0"
        style={{ backgroundColor: '#ff4757' }}
      />
      {children}
    </motion.span>
  );
}

/** True when the OS asks for reduced motion — for callers that branch on it directly. */
export function usePrefersReducedMotion(): boolean {
  return (useReducedMotion() ?? false) as boolean;
}
