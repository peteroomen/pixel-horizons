'use client';

import type { CardView } from '@/game/main';

interface CombatHandProps {
  cards: CardView[];
  onPlay: (handIndex: number) => void;
  /** Armed by a card-targeted innate (Slipstream): the next card tap discards instead. */
  discardMode?: boolean;
  onDiscard?: (handIndex: number) => void;
}

/**
 * DOM card hand (ADR 001). Tap/click a card to play it; unaffordable cards are
 * disabled. Malfunction cards (GDD §5.6) render flipped — amber, playable as repairs;
 * the flip *animation* is the 6.6 juice pass, only the state renders here. In discard
 * mode every card is selectable regardless of cost. Five cards share the row on any
 * viewport width — phones included — so everything stays reachable without scrolling.
 * Hover-lift is CSS-only cosmetics; nothing depends on hover.
 */
export default function CombatHand({
  cards,
  onPlay,
  discardMode = false,
  onDiscard,
}: CombatHandProps) {
  return (
    <div className="pointer-events-auto flex w-full max-w-2xl items-end justify-center gap-1 px-1 sm:gap-2 sm:px-2">
      {cards.map((card, index) => {
        const selectable = discardMode || card.affordable;
        const border = discardMode
          ? 'cursor-pointer border-[#4fc3f7] hover:-translate-y-2 active:-translate-y-1'
          : card.affordable
            ? card.malfunction
              ? 'cursor-pointer border-[#ffd166] hover:-translate-y-2 hover:border-[#ffe9b0] active:-translate-y-1'
              : 'cursor-pointer border-white/70 hover:-translate-y-2 hover:border-white active:-translate-y-1'
            : card.malfunction
              ? 'border-[#ffd166]/30 opacity-40'
              : 'border-white/20 opacity-40';
        return (
          <button
            key={card.key}
            type="button"
            disabled={!selectable}
            onClick={() => (discardMode ? onDiscard?.(index) : onPlay(index))}
            className={`retro flex min-h-28 min-w-0 flex-1 basis-0 flex-col border-2 p-1.5 text-left transition-transform sm:p-2 ${
              card.malfunction ? 'bg-[#241410]' : 'bg-[#101024]'
            } ${border}`}
          >
            <span className="flex items-start justify-between gap-1">
              <span
                className={`min-w-0 text-[9px] leading-tight [overflow-wrap:anywhere] sm:text-[10px] ${
                  card.malfunction ? 'text-[#ffd166]' : 'text-white'
                }`}
              >
                {card.name}
              </span>
              <span className="shrink-0 bg-[#e94560] px-1 text-[9px] leading-4 text-white sm:text-[11px]">
                {card.apCost}
              </span>
            </span>
            <span
              className={`mt-1 text-[8px] leading-snug sm:text-[10px] ${
                card.malfunction ? 'text-[#ffd166]/80' : 'text-white/70'
              }`}
            >
              {card.text}
            </span>
            {card.exhaust && (
              <span className="mt-auto pt-1 text-[8px] text-[#e94560]/90 sm:text-[9px]">
                Exhaust
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
