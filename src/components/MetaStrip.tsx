'use client';

import type { CombatView } from '@/game/main';
import Plate from '@/components/foundry/Plate';

export default function MetaStrip({ view }: { view: CombatView }) {
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
    </Plate>
  );
}
