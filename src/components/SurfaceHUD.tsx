'use client';

import type { SurfaceView } from '@/game/main';

interface SurfaceHUDProps {
  view: SurfaceView;
}

const RESOURCE_LABELS: ReadonlyArray<[keyof SurfaceView['backpack'], string]> = [
  ['scrap', 'SCRAP'],
  ['biominerals', 'BIO'],
  ['coreCrystals', 'CRYSTAL'],
  ['blueprints', 'BLUEPRINT'],
];

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Surface-run HUD (GDD §6.2): pod launch countdown, backpack load, and banked
 * (pod-deposited) resources. Pure presentation — every number arrives in the
 * SurfaceView; updates only when main.ts emits a changed view.
 */
export default function SurfaceHUD({ view }: SurfaceHUDProps) {
  const carried = RESOURCE_LABELS.filter(([key]) => view.backpack[key] > 0);
  const banked = RESOURCE_LABELS.filter(([key]) => view.deposited[key] > 0);

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2 sm:p-4">
      <div className="retro space-y-1 text-[10px] text-white sm:text-xs">
        {view.podSecondsLeft !== null && (
          <div className={view.podWarning ? 'text-[#e94560]' : undefined}>
            POD T-{formatTimer(view.podSecondsLeft)}
          </div>
        )}
      </div>

      <div className="retro space-y-1 text-right text-[10px] text-white sm:text-xs">
        <div>
          PACK {view.backpackUsed}/{view.backpackCapacity}
        </div>
        {carried.map(([key, label]) => (
          <div key={key} className="text-white/80">
            {label} {view.backpack[key]}
          </div>
        ))}
        {banked.length > 0 && (
          <>
            <div className="text-[#4fc3f7]">BANKED</div>
            {banked.map(([key, label]) => (
              <div key={key} className="text-[#4fc3f7]/80">
                {label} {view.deposited[key]}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
