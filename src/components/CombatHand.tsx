'use client';

import type { CardView } from '@/game/main';

interface CombatHandProps {
  cards: CardView[];
  onPlay: (handIndex: number) => void;
}

/**
 * DOM card hand (ADR 001). Tap/click a card to play it; unaffordable cards are
 * disabled. Five cards share the row on any viewport width — phones included — so
 * everything stays reachable without scrolling. Hover-lift is CSS-only cosmetics;
 * nothing depends on hover.
 */
export default function CombatHand({ cards, onPlay }: CombatHandProps) {
  return (
    <div className="pointer-events-auto flex w-full max-w-2xl items-end justify-center gap-1 px-1 sm:gap-2 sm:px-2">
      {cards.map((card, index) => (
        <button
          key={card.key}
          type="button"
          disabled={!card.affordable}
          onClick={() => onPlay(index)}
          className={`retro flex min-h-28 min-w-0 flex-1 basis-0 flex-col border-2 bg-[#101024] p-1.5 text-left transition-transform sm:p-2 ${
            card.affordable
              ? 'cursor-pointer border-white/70 hover:-translate-y-2 hover:border-white active:-translate-y-1'
              : 'border-white/20 opacity-40'
          }`}
        >
          <span className="flex items-start justify-between gap-1">
            <span className="min-w-0 text-[9px] leading-tight text-white [overflow-wrap:anywhere] sm:text-[10px]">
              {card.name}
            </span>
            <span className="shrink-0 bg-[#e94560] px-1 text-[9px] leading-4 text-white sm:text-[11px]">
              {card.apCost}
            </span>
          </span>
          <span className="mt-1 text-[8px] leading-snug text-white/70 sm:text-[10px]">
            {card.text}
          </span>
          {card.exhaust && (
            <span className="mt-auto pt-1 text-[8px] text-[#e94560]/90 sm:text-[9px]">Exhaust</span>
          )}
        </button>
      ))}
    </div>
  );
}
