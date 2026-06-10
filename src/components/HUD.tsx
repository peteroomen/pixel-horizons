'use client';

import type { CombatView } from '@/game/main';
import { Button } from '@/components/ui/8bit/button';

interface HUDProps {
  view: CombatView;
  onEndTurn: () => void;
}

/**
 * Combat HUD (GDD §5.2): hull HP, shield layers with recharge countdowns, AP, enemy
 * HP, intent telegraph (hidden until Deep Scan reveals it), turn and pile counts.
 * Pure presentation — every number arrives in the CombatView.
 */
export default function HUD({ view, onEndTurn }: HUDProps) {
  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2 sm:p-4">
        <div className="retro space-y-1 text-[10px] text-white sm:text-xs">
          <div>
            HULL {view.hullHp}/{view.hullMaxHp}
          </div>
          <Bar value={view.hullHp} max={view.hullMaxHp} color="#4fc3f7" />
          <div className="flex items-center gap-1">
            <span className="text-white/60">SHIELDS</span>
            {view.shields.length === 0 && view.tempShieldLayers === 0 && (
              <span className="text-white/40">none</span>
            )}
            {view.shields.map((layer, i) => (
              <span
                key={i}
                className={`inline-block size-3 border ${
                  layer.up ? 'border-[#4fc3f7] bg-[#4fc3f7]' : 'border-white/40 bg-transparent'
                } text-center text-[7px] leading-3 text-white/80`}
              >
                {layer.up ? '' : layer.turnsUntilUp}
              </span>
            ))}
            {Array.from({ length: view.tempShieldLayers }, (_, i) => (
              <span
                key={`temp-${i}`}
                className="inline-block size-3 border border-[#ffd166] bg-[#ffd166]"
              />
            ))}
          </div>
          <div className="flex items-center gap-1">
            <span className="text-white/60">AP</span>
            {Array.from({ length: view.apPerTurn }, (_, i) => (
              <span
                key={i}
                className={`inline-block size-3 ${i < view.ap ? 'bg-[#e94560]' : 'border border-white/40'}`}
              />
            ))}
          </div>
        </div>

        <div className="retro space-y-1 text-right text-[10px] text-white sm:text-xs">
          <div>
            {view.enemyName.toUpperCase()} {view.enemyHp}/{view.enemyMaxHp}
          </div>
          <div className="flex justify-end">
            <Bar value={view.enemyHp} max={view.enemyMaxHp} color="#e94560" />
          </div>
          <div className="text-white/60">
            INTENT:{' '}
            {view.intent === null ? (
              <span className="text-white/40">???</span>
            ) : (
              <span className="text-[#e94560]">
                {view.intent.name} {view.intent.amount}
                {view.intent.hits > 1 ? `×${view.intent.hits}` : ''}
                {view.intent.piercing ? ' PIERCE' : ''}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-32 flex items-end justify-between px-2 sm:bottom-36 sm:px-4">
        <div className="retro text-[9px] text-white/60 sm:text-[11px]">
          <div>TURN {view.turn}</div>
          <div>
            DRAW {view.drawCount} · DISCARD {view.discardCount}
          </div>
          {view.travelProgress > 0 && <div>TRAVEL +{view.travelProgress}</div>}
          {view.scrapGained > 0 && <div>SCRAP +{view.scrapGained}</div>}
        </div>
        <Button
          className="pointer-events-auto"
          font="retro"
          size="sm"
          disabled={view.outcome !== 'ongoing'}
          onClick={onEndTurn}
        >
          End Turn
        </Button>
      </div>
    </>
  );
}

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="h-2 w-28 border border-white/50 sm:w-36">
      <div className="h-full" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}
