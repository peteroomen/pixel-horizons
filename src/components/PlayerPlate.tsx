'use client';

import type { CombatView } from '@/game/main';
import Plate from '@/components/foundry/Plate';
import StatBar from '@/components/foundry/StatBar';

interface PlayerPlateProps {
  view: CombatView;
}

export default function PlayerPlate({ view }: PlayerPlateProps) {
  return (
    <Plate
      chamfer="chamfer-6 sm:chamfer-10"
      fillClassName="bg-fd-plate p-2.5 sm:p-4"
      className="pointer-events-none"
    >
      <div className="space-y-1.5 sm:space-y-2.5">
        {/* Hull row */}
        <div className="flex items-baseline justify-between">
          <span className="font-label text-[8px] sm:text-fd-label text-fd-muted uppercase">
            Hull
          </span>
          <span className="font-readout text-[18px] sm:text-fd-numeral text-fd-ink">
            {view.hullHp}/{view.hullMaxHp}
          </span>
        </div>

        {/* Hull bar */}
        <StatBar value={view.hullHp} max={view.hullMaxHp} fillClassName="bg-fd-orange" />

        {/* AP row */}
        <div className="flex items-center gap-1">
          <span className="font-label text-[8px] sm:text-fd-label text-fd-muted uppercase">AP</span>
          {Array.from({ length: Math.max(view.apPerTurn, view.ap) }, (_, i) => (
            <span
              key={i}
              className={`inline-block size-2.5 sm:size-3 ${i < view.ap ? 'bg-fd-orange' : 'bg-fd-strip'}`}
            />
          ))}
        </div>

        {/* Shields row */}
        <div className="flex items-center gap-1">
          <span className="font-label text-[8px] sm:text-fd-label text-fd-muted uppercase">
            <span className="sm:hidden">SHLD</span>
            <span className="hidden sm:inline">SHIELDS</span>
          </span>
          {view.shields.length === 0 && view.tempShieldLayers === 0 && (
            <span className="font-readout text-fd-muted">none</span>
          )}
          {view.shields.map((layer, i) => (
            <span
              key={i}
              className={`inline-flex items-center justify-center size-3 ${
                layer.up ? 'bg-fd-cyan' : 'bg-fd-strip'
              }`}
            >
              {!layer.up && (
                <span className="font-readout text-[10px] text-fd-muted">{layer.turnsUntilUp}</span>
              )}
            </span>
          ))}
          {Array.from({ length: view.tempShieldLayers }, (_, i) => (
            <span key={`temp-${i}`} className="inline-block size-3 bg-fd-amber" />
          ))}
        </div>

        {/* Malfunction warnings */}
        {view.modules
          .filter((m) => m.malfunctioning)
          .map((m, i) => (
            <div key={i} className="font-readout text-[13px] sm:text-fd-body text-fd-amber">
              ⚠ {m.name.toUpperCase()} OFFLINE
            </div>
          ))}
      </div>
    </Plate>
  );
}
