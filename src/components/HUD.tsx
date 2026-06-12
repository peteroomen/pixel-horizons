'use client';

import type { CombatView } from '@/game/main';
import PlayerPlate from '@/components/PlayerPlate';
import EnemyPlate from '@/components/EnemyPlate';
import MetaStrip from '@/components/MetaStrip';
import ButtonBar from '@/components/ButtonBar';

interface HUDProps {
  view: CombatView;
  onEndTurn: () => void;
  onInnate: () => void;
  innateArmed: boolean;
  onPayToll: () => void;
}

export default function HUD({ view, onEndTurn, onInnate, innateArmed, onPayToll }: HUDProps) {
  return (
    <>
      {/* Top: hero plates — content-sized at the screen edges, not full-width columns */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-2 sm:p-6">
        <PlayerPlate view={view} />
        <EnemyPlate view={view} />
      </div>

      {/* Bottom: meta strip + button bar, above the hand */}
      {/* Hand heights: 142px mobile + 8px bottom inset + 8px breathing = 158px; 210px desktop + 16px bottom + 16px breathing = 242px */}
      <div className="pointer-events-none absolute inset-x-0 bottom-[158px] sm:bottom-[242px] flex items-end justify-between gap-2 px-2 sm:gap-3 sm:px-6">
        <MetaStrip view={view} />
        <ButtonBar
          view={view}
          onEndTurn={onEndTurn}
          onInnate={onInnate}
          innateArmed={innateArmed}
          onPayToll={onPayToll}
        />
      </div>
    </>
  );
}
