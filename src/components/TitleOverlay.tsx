'use client';

import FoundryButton from '@/components/foundry/FoundryButton';
import type { MapView } from '@/game/main';

interface TitleOverlayProps {
  /** The saved run's situation — shown so resuming is an informed choice. */
  view: MapView;
  onResume: () => void;
  onNew: () => void;
}

/**
 * Shown at boot when a saved run exists (ADR 003: saves at node boundaries).
 * RESUME continues the stored expedition; NEW RUN discards it.
 */
export default function TitleOverlay({ view, onResume, onNew }: TitleOverlayProps) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-6 bg-fd-void/95 px-4">
      <span className="font-label text-2xl uppercase text-white sm:text-4xl">Pixel Horizons</span>
      <div className="flex flex-col items-center gap-1 text-center">
        <span className="font-label text-[10px] uppercase text-fd-orange sm:text-xs">
          Expedition in progress
        </span>
        <span className="font-readout text-[10px] text-white/80 sm:text-xs">
          Sector {view.sector} · {view.hullName} · Hull {view.hullHp} · Scrap {view.resources.scrap}{' '}
          · Bio {view.resources.biominerals}
        </span>
      </div>
      <div className="flex flex-col items-stretch gap-3 sm:flex-row">
        <FoundryButton variant="primary" onClick={onResume}>
          Resume Run
        </FoundryButton>
        <FoundryButton variant="secondary" onClick={onNew}>
          New Run
        </FoundryButton>
      </div>
    </div>
  );
}
