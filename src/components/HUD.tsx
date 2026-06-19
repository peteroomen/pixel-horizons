'use client';

import type { CombatView } from '@/game/main';
import PlayerPlate from '@/components/PlayerPlate';
import EnemyPlate from '@/components/EnemyPlate';
import MetaStrip from '@/components/MetaStrip';
import ButtonBar from '@/components/ButtonBar';
import { InfoChipProvider } from '@/components/foundry/InfoChip';

/**
 * Lane progress bar (4.13): a thin segmented strip of `distance` pips, the first
 * `progress` of which are filled. Visible only inside a lane (travel !== null).
 * FOUNDRY colour: filled pips are fd-orange, empty are fd-steel/40.
 */
function LaneProgressBar({ travel }: { travel: NonNullable<CombatView['travel']> }) {
  const { progress, distance } = travel;
  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 flex gap-0.5 px-1 pt-0.5 sm:gap-1 sm:px-2 sm:pt-1"
      aria-label={`Lane progress: ${progress} of ${distance}`}
    >
      {Array.from({ length: distance }, (_, i) => (
        <div
          key={i}
          className={`h-[6px] flex-1 sm:h-[8px] ${
            i < progress ? 'bg-fd-orange' : 'bg-fd-steel/40'
          }`}
        />
      ))}
    </div>
  );
}

interface HUDProps {
  view: CombatView;
  onEndTurn: () => void;
  onInnate: () => void;
  innateArmed: boolean;
  onSelectTarget: (target: number | null) => void;
}

export default function HUD({ view, onEndTurn, onInnate, innateArmed, onSelectTarget }: HUDProps) {
  return (
    <InfoChipProvider>
      {/* Lane progress bar — only shown inside a hyperspace lane (4.13) */}
      {view.travel !== null && <LaneProgressBar travel={view.travel} />}

      {/* Top: hero plates — content-sized at the screen edges, not full-width columns */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-2 sm:p-6">
        <PlayerPlate view={view} />
        <EnemyPlate view={view} onSelectTarget={onSelectTarget} />
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
        />
      </div>
    </InfoChipProvider>
  );
}
