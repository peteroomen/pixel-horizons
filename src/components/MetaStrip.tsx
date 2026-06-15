'use client';

import type { CombatView } from '@/game/main';
import Plate from '@/components/foundry/Plate';
import InfoChip from '@/components/foundry/InfoChip';
import { KEYWORD_GLOSSARY } from '@/components/combat-keywords';

/** Distinct keywords across the current hand, in glossary order, for the explainer chips. */
function handKeywords(view: CombatView): string[] {
  const present = new Set<string>();
  for (const card of view.hand) {
    if (card.exhaust) present.add('EXHAUST');
    for (const keyword of card.keywords) present.add(keyword);
  }
  return Object.keys(KEYWORD_GLOSSARY).filter((k) => present.has(k));
}

export default function MetaStrip({ view }: { view: CombatView }) {
  const keywords = handKeywords(view);
  return (
    <Plate
      chamfer="chamfer-5 sm:chamfer-8"
      fillClassName="bg-fd-plate px-2.5 py-1.5 sm:px-4 sm:py-2.5"
      className="pointer-events-none"
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 sm:gap-x-5 font-readout text-[12px] sm:text-fd-readout text-fd-muted">
        <span className="text-fd-ink">TURN {view.turn}</span>
        <span>
          DRAW {view.drawCount} · DISCARD {view.discardCount}
        </span>
        {view.travel !== null && (
          <span>
            TRAVEL {view.travel.progress}/{view.travel.distance}
          </span>
        )}
        <span className="text-fd-amber">SCRAP {view.scrap}</span>
        {view.innate.passive && <span>{view.innate.name.toUpperCase()} · PASSIVE</span>}
      </div>
      {/* Keyword glossary (GDD §5.10) — tap to explain a keyword that's in your hand */}
      {keywords.length > 0 && (
        <div className="pointer-events-auto mt-1 flex flex-wrap items-center gap-1">
          {keywords.map((keyword) => (
            <InfoChip
              key={keyword}
              label={keyword}
              description={KEYWORD_GLOSSARY[keyword]}
              tone="neutral"
            />
          ))}
        </div>
      )}
    </Plate>
  );
}
