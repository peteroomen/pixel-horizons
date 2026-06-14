'use client';

import { useState } from 'react';

import type { EventView, ShipView } from '@/game/main';

interface EventScreenProps {
  view: EventView;
  shipView: ShipView | null;
  onChoose: (choiceIndex: number, moduleIndex?: number) => void;
}

export default function EventScreen({ view, shipView, onChoose }: EventScreenProps) {
  // Non-null while a module-target choice waits for the player to pick an installed module.
  const [targeting, setTargeting] = useState<number | null>(null);

  const modules = shipView?.modules ?? [];

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-black/85 px-4">
      <span className="font-label text-xl uppercase text-fd-orange sm:text-3xl">{view.title}</span>
      <p className="retro max-w-md text-center text-[10px] leading-relaxed text-white/70 sm:text-xs">
        {view.body}
      </p>

      {targeting === null ? (
        <div className="flex w-full max-w-md flex-col gap-3">
          {view.choices.map((choice, index) => (
            <button
              key={choice.label}
              type="button"
              disabled={!choice.affordable}
              onClick={() => (choice.requiresModuleTarget ? setTargeting(index) : onChoose(index))}
              className={`flex flex-col gap-1 border-2 px-4 py-3 text-left ${
                choice.affordable
                  ? 'border-[#4a4a6a] bg-fd-plate hover:border-fd-orange active:bg-fd-plate/80'
                  : 'cursor-not-allowed border-[#33334a] bg-fd-plate/40 opacity-50'
              }`}
            >
              <div className="font-label text-[10px] uppercase text-fd-orange sm:text-xs">
                {choice.label}
              </div>
              <div className="retro text-[8px] text-white/60 sm:text-[10px]">
                {choice.outcomes.join(' · ')}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="flex w-full max-w-md flex-col gap-3">
          <span className="retro text-center text-[10px] text-white/60 sm:text-xs">
            CHOOSE A MODULE
          </span>
          {modules.map((mod, index) => (
            <button
              key={`${mod.name}-${index}`}
              type="button"
              onClick={() => {
                onChoose(targeting, index);
                setTargeting(null);
              }}
              className="border-2 border-[#4a4a6a] bg-fd-plate px-4 py-2 text-left font-label text-[10px] uppercase text-white/80 hover:border-fd-orange active:bg-fd-plate/80 sm:text-xs"
            >
              {mod.name}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setTargeting(null)}
            className="retro text-[9px] text-white/40 underline hover:text-white/70 sm:text-[10px]"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
