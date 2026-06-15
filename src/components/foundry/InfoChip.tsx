'use client';

import { useState } from 'react';

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
 * A status/keyword chip that explains itself. No hover on touch (GDD §5.10) — a tap
 * toggles an inline tooltip bubble; tapping again (or another chip) dismisses it.
 */
export default function InfoChip({ label, value, description, tone }: InfoChipProps) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`pointer-events-auto touch-manipulation inline-flex items-center gap-0.5 border px-1 py-0.5 font-label uppercase text-[7px] sm:text-[9px] leading-none ${TONE_STYLES[tone]}`}
      >
        <span>{label}</span>
        {value !== undefined && value !== '' && <span className="font-readout">{value}</span>}
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute bottom-full left-0 z-30 mb-1 block w-40 sm:w-48 border border-fd-steel bg-fd-plate px-2 py-1.5 font-readout text-[11px] sm:text-[13px] normal-case text-fd-ink shadow-lg"
        >
          <span className={`mb-0.5 block font-label uppercase text-[8px] ${TONE_STYLES[tone]}`}>
            {label}
            {value !== undefined && value !== '' ? ` ${value}` : ''}
          </span>
          {description}
        </span>
      )}
    </span>
  );
}
