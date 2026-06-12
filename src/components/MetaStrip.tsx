'use client';

import type { CombatView } from '@/game/main';

interface MetaStripProps {
  view: CombatView;
}

export default function MetaStrip({ view }: MetaStripProps) {
  const line2Parts: string[] = [];
  if (view.travel !== null) {
    line2Parts.push(`TRAVEL +${view.travel.progress}`);
  }

  return (
    <div className="font-readout text-[12px] sm:text-fd-readout text-fd-muted">
      <div>
        TURN {view.turn} · DRAW {view.drawCount} · DISCARD {view.discardCount}
      </div>
      <div className="flex gap-2">
        {view.travel !== null && <span>TRAVEL +{view.travel.progress}</span>}
        {view.scrapGained > 0 && <span className="text-fd-amber">SCRAP +{view.scrapGained}</span>}
        {view.innate.passive && <span>{view.innate.name.toUpperCase()} · PASSIVE</span>}
      </div>
    </div>
  );
}
