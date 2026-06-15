'use client';

import { KEYWORD_GLOSSARY } from '@/components/combat-keywords';
import InfoChip from '@/components/foundry/InfoChip';
import type { ModuleCardView } from '@/game/main';

/**
 * Renders the cards a module contributes to the deck (GDD §5.3) so it can be inspected
 * before buying/installing (Slice 4.8). Keyword chips reuse the combat glossary + the
 * 4.7 InfoChip tooltip so explanations match a fight. Presentational only — the card
 * data is projected in the view layer (`describeModuleCards`).
 */
export default function ModuleCardList({ cards }: { cards: ModuleCardView[] }) {
  if (cards.length === 0) {
    return <div className="retro pl-2 text-[8px] text-white/30 sm:text-[10px]">No cards</div>;
  }
  return (
    <div className="flex flex-col gap-1.5 border-l border-fd-steel/40 pl-2">
      {cards.map((card, i) => {
        const keywords = [...(card.exhaust ? ['EXHAUST'] : []), ...card.keywords];
        return (
          <div key={`${card.name}-${i}`} className="flex flex-col gap-0.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-label text-[8px] uppercase text-white/80 sm:text-[10px]">
                {card.name}
              </span>
              <span className="font-readout text-[7px] text-fd-amber sm:text-[9px]">
                {card.apCost} AP
              </span>
            </div>
            <span className="font-readout text-[8px] text-white/50 sm:text-[10px]">
              {card.text}
            </span>
            {keywords.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {keywords.map((kw) => (
                  <InfoChip
                    key={kw}
                    label={kw}
                    description={KEYWORD_GLOSSARY[kw] ?? kw}
                    tone="neutral"
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
