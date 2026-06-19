'use client';

import { motion, useReducedMotion } from 'motion/react';

import type { CardType, CardView } from '@/game/main';

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

/** Card type chip colour (4.13 legibility pass). */
const TYPE_COLOR: Record<CardType, string> = {
  ATTACK: 'text-fd-red',
  POWER: 'text-fd-orange',
  SKILL: 'text-fd-cyan',
};

export default function CombatCard({ card, state, disabled, onClick }: CombatCardProps) {
  const s = STATE_STYLES[state];
  const selectable = !disabled;
  const reduced = useReducedMotion() ?? false;
  // Hover-lift + tap-punch sell that a card is grabbable and that playing it *launches*;
  // reduced motion drops the movement (the press still fires the play).
  const interactive = selectable && !reduced;

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
  if (card.exhaust && tags.length < 3) {
    tags.push({ label: 'EXHAUST', color: 'text-fd-muted' });
  }
  for (const keyword of card.keywords) {
    if (tags.length >= 3) break;
    tags.push({ label: keyword, color: 'text-fd-muted' });
  }

  // Card width: fills its hand slot (uniform within the row). On mobile the hand makes
  // every slot an equal flex share capped at 88px so any hand size fits a phone width;
  // on desktop the slot is a fixed 128px (4.13 legibility pass — quick mobile-fit fix).
  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={onClick}
      whileHover={interactive ? { y: -8 } : undefined}
      whileTap={interactive ? { y: -4, scale: 0.96 } : undefined}
      transition={{ type: 'spring', stiffness: 600, damping: 30 }}
      className={`chamfer chamfer-5 sm:chamfer-8 ${s.frame} p-[2px] w-full h-[142px] sm:h-[210px] ${
        selectable ? 'cursor-pointer' : ''
      } ${!card.affordable && state !== 'discard' ? 'opacity-40' : ''}`}
    >
      <div className={`chamfer chamfer-5 sm:chamfer-8 ${s.fill} flex h-full flex-col`}>
        {/* Header strip: louder title + AP cost (4.13 legibility pass) */}
        <div
          className={`${s.header} flex items-start justify-between gap-1 px-1.5 py-1 sm:px-2 sm:py-1.5`}
        >
          <span
            className={`${s.name} font-label uppercase text-[8px] sm:text-[12px] min-w-0 [overflow-wrap:anywhere] leading-tight font-bold`}
          >
            {card.name}
          </span>
          {state !== 'infested' && (
            <span className="shrink-0 size-4 sm:size-6 bg-fd-orange text-fd-ink-dark font-readout text-[12px] sm:text-[18px] text-center leading-4 sm:leading-6">
              {card.apCost}
            </span>
          )}
        </div>

        {/* Type chip + body (4.13 legibility pass) */}
        <div
          className={`${s.body} font-readout text-[11px] sm:text-fd-body p-1.5 sm:p-2 text-left flex flex-col gap-0.5`}
        >
          {state === 'normal' && (
            <span
              className={`font-label uppercase text-[6px] sm:text-[9px] ${TYPE_COLOR[card.cardType]}`}
            >
              {card.cardType}
            </span>
          )}
          <span>{card.text}</span>
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
    </motion.button>
  );
}
