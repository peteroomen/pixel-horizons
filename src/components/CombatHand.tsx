'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

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
  const reduced = useReducedMotion() ?? false;
  // Stable per-card key by id + occurrence ordinal. The view's own key embeds the hand
  // index, which shifts for the whole tail when a card leaves — using that, every card
  // after the played one would re-animate. Occurrence ordinals only shift same-id
  // duplicates after the removed card, so most cards keep their identity across a play
  // and AnimatePresence animates just the card that left.
  const seen = new Map<string, number>();

  return (
    <div className="pointer-events-auto flex w-full items-end justify-center gap-[5px] px-1 sm:w-auto sm:gap-3.5 sm:px-0">
      <AnimatePresence mode="popLayout" initial={false}>
        {cards.map((card, index) => {
          const ordinal = (seen.get(card.id) ?? 0) + 1;
          seen.set(card.id, ordinal);
          const fxKey = `${card.id}#${ordinal}`;

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
            <motion.div
              key={fxKey}
              layout={!reduced}
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 28, scale: 0.85 }}
              animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: -44, scale: 0.6 }}
              transition={{ type: 'spring', stiffness: 500, damping: 32 }}
              className="relative flex-1 basis-0 min-w-0 sm:w-[200px] sm:flex-none"
            >
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
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
