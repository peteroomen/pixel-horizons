'use client';

import type { BossRewardOption, GameHandle, MapView } from '@/game/main';

interface BossRewardProps {
  mapView: MapView | null;
  handle: GameHandle;
}

const REWARDS: ReadonlyArray<{
  option: BossRewardOption;
  label: string;
  description: string;
}> = [
  {
    option: 'core-crystal',
    label: 'Core Crystal',
    description: '+1 AP in space, +1 active item slot planetside',
  },
  {
    option: 'mk2-module',
    label: 'Mk II Module',
    description: 'A random Mk II copy of one of your installed modules',
  },
  {
    option: 'blueprint-cache',
    label: 'Blueprint Cache',
    description: '2 Blueprints + 15 Scrap',
  },
];

export default function BossReward({ mapView, handle }: BossRewardProps) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-black/85">
      <span className="font-label text-2xl uppercase text-fd-orange sm:text-4xl">
        Gate Destroyed
      </span>
      <span className="retro text-[10px] text-white/60 sm:text-xs">
        SECTOR {mapView?.sector ?? 1} CLEARED — CHOOSE YOUR REWARD
      </span>

      <div className="flex flex-col gap-3 px-4 sm:flex-row sm:gap-4">
        {REWARDS.map((r) => (
          <button
            key={r.option}
            type="button"
            onClick={() => handle.chooseBossReward(r.option)}
            className="flex flex-col items-center gap-2 border-2 border-[#4a4a6a] bg-fd-plate px-4 py-3 text-center hover:border-fd-orange active:bg-fd-plate/80 sm:w-48 sm:px-6 sm:py-4"
          >
            <div className="font-label text-[10px] uppercase text-fd-orange sm:text-xs">
              {r.label}
            </div>
            <div className="retro text-[8px] text-white/70 sm:text-[10px]">{r.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
