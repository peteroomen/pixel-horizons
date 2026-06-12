'use client';

import type { CardView } from '@/game/main';
import CombatCard from '@/components/CombatCard';

interface CombatHandProps {
  cards: CardView[];
  onPlay: (handIndex: number) => void;
  discardMode?: boolean;
  onDiscard?: (handIndex: number) => void;
}

export default function CombatHand({
  cards,
  onPlay,
  discardMode = false,
  onDiscard,
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

        return (
          <CombatCard
            key={card.key}
            card={card}
            state={state}
            disabled={disabled}
            onClick={() => (discardMode ? onDiscard?.(index) : onPlay(index))}
          />
        );
      })}
    </div>
  );
}
