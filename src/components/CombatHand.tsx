'use client';

import type { CardView } from '@/game/main';
import CombatCard from '@/components/CombatCard';

interface CombatHandProps {
  cards: CardView[];
  onPlay: (handIndex: number) => void;
  discardMode?: boolean;
  onDiscard?: (handIndex: number) => void;
  onJettison?: (handIndex: number) => void;
}

export default function CombatHand({
  cards,
  onPlay,
  discardMode = false,
  onDiscard,
  onJettison,
}: CombatHandProps) {
  return (
    <div className="pointer-events-auto flex w-full items-end justify-center gap-[5px] px-1 sm:w-auto sm:gap-3.5 sm:px-0">
      {cards.map((card, index) => {
        const state = discardMode
          ? ('discard' as const)
          : card.infested
            ? ('infested' as const)
            : card.malfunction
              ? ('malfunction' as const)
              : ('normal' as const);

        const disabled = !(discardMode || card.affordable);
        const showJettison = !discardMode && card.jettisonable;

        return (
          <div key={card.key} className="relative flex-1 basis-0 min-w-0 sm:w-[200px] sm:flex-none">
            <CombatCard
              card={card}
              state={state}
              disabled={disabled}
              onClick={() => (discardMode ? onDiscard?.(index) : onPlay(index))}
            />
            {showJettison && (
              <button
                type="button"
                aria-label="Jettison card"
                title="Jettison"
                onClick={() => onJettison?.(index)}
                className="chamfer absolute bottom-1 right-1 z-10 size-5 bg-fd-cyan font-label text-[11px] leading-none text-fd-ink-dark sm:size-7 sm:text-[15px]"
              >
                ⤓
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
