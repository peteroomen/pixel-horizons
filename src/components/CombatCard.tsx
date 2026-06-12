'use client';

import type { CardView } from '@/game/main';

type CardState = 'normal' | 'malfunction' | 'infested' | 'discard';

interface CombatCardProps {
  card: CardView;
  state: CardState;
  disabled: boolean;
  onClick: () => void;
}

const STATE_STYLES: Record<
  CardState,
  {
    frame: string;
    fill: string;
    header: string;
    name: string;
    body: string;
  }
> = {
  normal: {
    frame: 'bg-fd-steel',
    fill: 'bg-fd-card',
    header: 'bg-fd-strip',
    name: 'text-fd-ink',
    body: 'text-fd-card-body',
  },
  malfunction: {
    frame: 'bg-fd-amber',
    fill: 'bg-fd-card-amber',
    header: 'bg-fd-card-amber-header',
    name: 'text-fd-amber',
    body: 'text-fd-card-amber-body',
  },
  infested: {
    frame: 'bg-fd-green',
    fill: 'bg-fd-card-green',
    header: 'bg-fd-card-green-header',
    name: 'text-fd-green',
    body: 'text-fd-card-green-body',
  },
  discard: {
    frame: 'bg-fd-cyan',
    fill: 'bg-fd-card-cyan',
    header: 'bg-fd-card-cyan-header',
    name: 'text-fd-ink',
    body: 'text-fd-card-body',
  },
};

export default function CombatCard({ card, state, disabled, onClick }: CombatCardProps) {
  const s = STATE_STYLES[state];
  const selectable = !disabled;

  const tags: { label: string; color: string }[] = [];
  if (state === 'discard') {
    tags.push({ label: 'TAP TO DISCARD', color: 'text-fd-cyan' });
  }
  if (state === 'malfunction') {
    tags.push({ label: 'MALFUNCTION', color: 'text-fd-amber' });
  }
  if (state === 'infested') {
    tags.push({ label: 'INFESTED', color: 'text-fd-green' });
  }
  if (card.exhaust && tags.length < 2) {
    tags.push({ label: 'EXHAUST', color: 'text-fd-muted' });
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`chamfer chamfer-5 sm:chamfer-8 ${s.frame} p-[2px] flex-1 basis-0 min-w-0 h-[142px] sm:w-[200px] sm:h-[210px] sm:flex-none ${
        selectable ? 'cursor-pointer hover:-translate-y-2 active:-translate-y-1' : ''
      } transition-transform ${!card.affordable && state !== 'discard' ? 'opacity-40' : ''}`}
    >
      <div className={`chamfer chamfer-5 sm:chamfer-8 ${s.fill} flex h-full flex-col`}>
        {/* Header strip */}
        <div
          className={`${s.header} flex items-start justify-between gap-1 px-1.5 py-1 sm:px-2 sm:py-1.5`}
        >
          <span
            className={`${s.name} font-label uppercase text-[6px] sm:text-[10px] min-w-0 [overflow-wrap:anywhere] leading-tight`}
          >
            {card.name}
          </span>
          {state !== 'infested' && (
            <span className="shrink-0 size-4 sm:size-6 bg-fd-orange text-fd-ink-dark font-readout text-[12px] sm:text-[18px] text-center leading-4 sm:leading-6">
              {card.apCost}
            </span>
          )}
        </div>

        {/* Body */}
        <div
          className={`${s.body} font-readout text-[12px] sm:text-fd-body p-1.5 sm:p-2 text-left`}
        >
          {card.text}
        </div>

        {/* Footer tags */}
        {tags.length > 0 && (
          <div className="mt-auto flex gap-1 px-1.5 pb-1 sm:px-2 sm:pb-1.5">
            {tags.map((tag) => (
              <span
                key={tag.label}
                className={`${tag.color} font-label uppercase text-[6px] sm:text-[10px]`}
              >
                {tag.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}
