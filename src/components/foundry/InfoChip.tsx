'use client';

import {
  createContext,
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

interface InfoChipProps {
  label: string;
  /** Optional value shown after the label (e.g. `+3`, `×2`). */
  value?: string;
  description: string;
  tone: 'buff' | 'debuff' | 'neutral';
}

const TONE_STYLES: Record<InfoChipProps['tone'], string> = {
  buff: 'border-fd-cyan text-fd-cyan',
  debuff: 'border-fd-amber text-fd-amber',
  neutral: 'border-fd-steel text-fd-muted',
};

/**
 * Coordinates which chip's tooltip is open so only one shows at a time. Wrap the
 * combat HUD in <InfoChipProvider>; chips outside a provider fall back to local state.
 */
const InfoChipContext = createContext<{
  openId: string | null;
  setOpenId: (id: string | null) => void;
} | null>(null);

export function InfoChipProvider({ children }: { children: React.ReactNode }) {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <InfoChipContext.Provider value={{ openId, setOpenId }}>{children}</InfoChipContext.Provider>
  );
}

/**
 * A status/keyword chip that explains itself. No hover on touch (GDD §5.10) — a tap
 * toggles a tooltip; tapping another chip dismisses the first (single-open). The bubble
 * renders in a portal with fixed positioning so the plate's `clip-path` chamfer can't
 * clip it, and it flips below / clamps to stay on-screen at the top of a phone viewport.
 */
export default function InfoChip({ label, value, description, tone }: InfoChipProps) {
  const id = useId();
  const ctx = useContext(InfoChipContext);
  const [localOpen, setLocalOpen] = useState(false);
  const open = ctx !== null ? ctx.openId === id : localOpen;

  const setOpen = useCallback(
    (next: boolean) => {
      if (ctx !== null) ctx.setOpenId(next ? id : null);
      else setLocalOpen(next);
    },
    [ctx, id],
  );

  const anchorRef = useRef<HTMLButtonElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);

  // Measure after the tip mounts (still before paint) and place it imperatively, so the
  // plate's clip-path can't clip it and it stays on-screen. Imperative (not setState)
  // avoids an extra render and the set-state-in-effect trap; React resets the inline
  // style to hidden on each re-render and this effect re-runs to reposition.
  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    const tip = tipRef.current;
    if (!open || anchor === null || tip === null) return;
    const a = anchor.getBoundingClientRect();
    const t = tip.getBoundingClientRect();
    const margin = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Prefer above; flip below when there isn't room; clamp if neither fits.
    let top = a.top - t.height - margin;
    if (top < margin) top = a.bottom + margin;
    if (top + t.height > vh - margin) top = Math.max(margin, vh - margin - t.height);

    let left = a.left;
    if (left + t.width > vw - margin) left = vw - margin - t.width;
    if (left < margin) left = margin;

    tip.style.top = `${top}px`;
    tip.style.left = `${left}px`;
    tip.style.visibility = 'visible';
  }, [open, label, value, description]);

  const valueText = value !== undefined && value !== '' ? value : '';

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={() => setOpen(!open)}
        className={`pointer-events-auto touch-manipulation inline-flex items-center gap-0.5 border px-1 py-0.5 font-label uppercase text-[7px] sm:text-[9px] leading-none ${TONE_STYLES[tone]}`}
      >
        <span>{label}</span>
        {valueText !== '' && <span className="font-readout">{valueText}</span>}
      </button>
      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <span
            ref={tipRef}
            role="tooltip"
            // Starts hidden at the origin; the layout effect measures and places it
            // before paint, so there's no flash at the wrong position.
            style={{ position: 'fixed', top: 0, left: 0, visibility: 'hidden' }}
            className="z-50 block w-40 sm:w-48 border border-fd-steel bg-fd-plate px-2 py-1.5 font-readout text-[11px] sm:text-[13px] normal-case text-fd-ink shadow-lg"
          >
            <span className={`mb-0.5 block font-label uppercase text-[8px] ${TONE_STYLES[tone]}`}>
              {label}
              {valueText !== '' ? ` ${valueText}` : ''}
            </span>
            {description}
          </span>,
          document.body,
        )}
    </>
  );
}
