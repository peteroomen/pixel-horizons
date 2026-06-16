'use client';

import { motion, useAnimationControls, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { hpDrop } from './combat-fx-core';

/**
 * The React side of the combat juice layer (Slice 6.6). Every effect is driven off the
 * change in a single HP / pip value between renders — combat pushes a fresh `CombatView`
 * once per event (never per frame), so a value falling between two renders *is* a hit.
 * These primitives keep that derivation co-located with the element it decorates, so a
 * floating number always lands on the exact bar that took the damage (no global
 * coordinate math). All motion respects `prefers-reduced-motion`.
 */

const FLOATER_RISE_PX = 26;
const FLOATER_MS = 750;
const FLASH_MS = 280;

export type FxTone = 'enemy' | 'ship';

interface Floater {
  id: number;
  amount: number;
}

/**
 * Watches a single HP value. Each time it drops, queues a floating damage number and
 * bumps `hitKey` (so the decorated element can flash/shake). Floaters self-expire once
 * their animation completes — removal is keyed by id, never by the effect cleanup, so
 * two hits in quick succession don't cancel each other's pruning.
 */
export function useDamageFloaters(hp: number): {
  floaters: Floater[];
  hitKey: number;
  remove: (id: number) => void;
} {
  const prev = useRef<number | null>(null);
  const nextId = useRef(0);
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const [hitKey, setHitKey] = useState(0);

  useEffect(() => {
    const drop = hpDrop(prev.current, hp);
    prev.current = hp;
    if (drop === null) return;
    const id = (nextId.current += 1);
    setFloaters((current) => [...current, { id, amount: drop }]);
    setHitKey((k) => k + 1);
  }, [hp]);

  const remove = useCallback((id: number) => {
    setFloaters((current) => current.filter((f) => f.id !== id));
  }, []);

  return { floaters, hitKey, remove };
}

const TONE_CLASS: Record<FxTone, string> = {
  enemy: 'text-fd-red',
  ship: 'text-fd-orange',
};

/**
 * Renders the rising `−N` numbers from `useDamageFloaters`. Absolutely positioned so it
 * never shifts the plate layout; anchor it inside a `relative` element next to the HP
 * readout it belongs to. `pointer-events-none` so it can never eat a card/target tap.
 */
export function DamageFloaters({
  floaters,
  onDone,
  tone = 'enemy',
}: {
  floaters: Floater[];
  onDone: (id: number) => void;
  tone?: FxTone;
}) {
  const reduced = useReducedMotion() ?? false;
  return (
    <span className="pointer-events-none absolute -top-1 right-0 z-20 block" aria-hidden>
      {floaters.map((f) => (
        <motion.span
          key={f.id}
          className={`absolute right-0 top-0 font-readout text-[15px] sm:text-fd-numeral ${TONE_CLASS[tone]} drop-shadow-[0_1px_0_rgba(0,0,0,0.6)]`}
          initial={{ opacity: 0, y: 0, scale: reduced ? 1 : 1.35 }}
          animate={{ opacity: [0, 1, 1, 0], y: reduced ? 0 : -FLOATER_RISE_PX, scale: 1 }}
          transition={{ duration: FLOATER_MS / 1000, times: [0, 0.12, 0.7, 1], ease: 'easeOut' }}
          onAnimationComplete={() => onDone(f.id)}
        >
          −{f.amount}
        </motion.span>
      ))}
    </span>
  );
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
  const prev = useRef(on);

  useEffect(() => {
    if (on === prev.current) return;
    if (!reduced) {
      // Lit → a quick scale pop; dropped → a red recoil flash.
      controls.start(
        on
          ? { scale: [1.7, 1] }
          : { backgroundColor: ['#ff4757', 'rgba(0,0,0,0)'], scale: [1.4, 1] },
        { duration: 0.32, ease: 'easeOut' },
      );
    }
    prev.current = on;
  }, [on, controls, reduced]);

  return (
    <motion.span animate={controls} className={`${className} ${on ? litClassName : offClassName}`}>
      {children}
    </motion.span>
  );
}

/** True when the OS asks for reduced motion — for callers that branch on it directly. */
export function usePrefersReducedMotion(): boolean {
  return (useReducedMotion() ?? false) as boolean;
}
