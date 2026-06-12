'use client';

import type { CombatView } from '@/game/main';
import FoundryButton from '@/components/foundry/FoundryButton';

interface ButtonBarProps {
  view: CombatView;
  onEndTurn: () => void;
  onInnate: () => void;
  innateArmed: boolean;
  onPayToll: () => void;
}

export default function ButtonBar({
  view,
  onEndTurn,
  onInnate,
  innateArmed,
  onPayToll,
}: ButtonBarProps) {
  return (
    // Mobile: fixed-width vertical stack, every button stretched to the same width,
    // End Turn last (closest to thumb). Desktop: auto-width row.
    <div className="flex w-48 shrink-0 flex-col items-stretch gap-2.5 sm:w-auto sm:flex-row sm:items-end sm:gap-3">
      {view.anchor !== null && (
        <FoundryButton
          variant="secondary"
          className="w-full sm:w-auto"
          disabled={!view.anchor.payable}
          onClick={onPayToll}
          cost={{ amount: view.anchor.tollScrap, resource: 'scrap' }}
        >
          Pay Toll
        </FoundryButton>
      )}
      {!view.innate.passive && (
        <FoundryButton
          variant="secondary"
          className="w-full sm:w-auto"
          armed={innateArmed}
          disabled={!view.innate.usable}
          title={view.innate.description}
          onClick={onInnate}
          cost={view.innate.apCost > 0 ? { amount: view.innate.apCost, resource: 'ap' } : undefined}
        >
          {innateArmed ? 'Pick a card…' : view.innate.name}
        </FoundryButton>
      )}
      <FoundryButton
        variant="primary"
        className="w-full sm:w-auto"
        disabled={view.outcome !== 'ongoing'}
        onClick={onEndTurn}
      >
        End Turn
      </FoundryButton>
    </div>
  );
}
