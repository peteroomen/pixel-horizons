'use client';

import { useMemo } from 'react';

import BallGlyphIcon from '@/components/foundry/BallGlyphIcon';
import type { BallType } from '@/game/surface/core-breaker';
import { BALL_GLYPH } from '@/game/data/core-breaker';
import { ballSpriteDataUrls } from '@/renderer/core-breaker/ball-sprites';
import type { CoreBreakerHudState } from '@/renderer/core-breaker-renderer';

import Plate from './foundry/Plate';
import FoundryButton from './foundry/FoundryButton';

interface CoreBreakerHudProps {
  state: CoreBreakerHudState;
  onReprint: () => void;
  onReturn: () => void;
}

const BALL_LABEL: Record<BallType, string> = {
  standard: 'STANDARD',
  heavy: 'HEAVY',
  split: 'SPLIT',
  drill: 'DRILL',
  ghost: 'GHOST',
};

// Cosmetic pip count per ball type (prototype BMETA.maxB) — decorative, the v2 sim has no
// bounce budget.
const BALL_PIPS: Record<BallType, number> = {
  standard: 8,
  heavy: 5,
  split: 6,
  drill: 4,
  ghost: 10,
};

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Core Breaker HUD (ADR 001 — UI is React DOM, the canvas owns the world). Presentational: every
 * value arrives in `state`, emitted by the renderer on discrete change. The renderer reserves the
 * header/tray bands of the portrait column, and this overlay sits over them (`headerFrac`/`trayFrac`).
 */
export default function CoreBreakerHud({ state, onReprint, onReturn }: CoreBreakerHudProps) {
  const ballUrls = useMemo(() => ballSpriteDataUrls(), []);
  const queuePreview = state.queue.slice(0, 3);
  const overflow = Math.max(0, state.queue.length - 3);

  // Count each ball type remaining in the full queue (not just the preview slice).
  const queueCounts = useMemo(() => {
    const counts = new Map<BallType, number>();
    for (const t of state.queue) counts.set(t, (counts.get(t) ?? 0) + 1);
    return counts;
  }, [state.queue]);

  return (
    <div className="retro pointer-events-none absolute inset-0 flex flex-col justify-between">
      {/* ── Header: biome + timer | haul ─────────────────────────────────── */}
      <div
        className="flex w-full items-stretch gap-1 p-1"
        style={{ height: `${state.headerFrac * 100}%` }}
      >
        <Plate fillClassName="bg-fd-plate flex flex-col justify-center px-3" className="flex-1">
          <div className="flex items-center gap-2">
            <div className="font-label text-[7px] uppercase tracking-wider text-fd-muted">
              {state.biome}
            </div>
            {state.bloomThreat > 0 && (
              <div className="font-label animate-pulse text-[7px] uppercase tracking-wider text-[#e94560]">
                BLOOM ▲{state.bloomThreat}
              </div>
            )}
          </div>
          <div className="font-readout text-lg leading-none text-fd-ink">
            {formatTimer(state.timerSecs)}
          </div>
        </Plate>
        <Plate
          fillClassName="bg-fd-plate flex flex-col justify-center gap-0.5 px-3"
          className="flex-1"
        >
          <HaulRow color="#9aa0ad" shape="square" value={state.haul.scrap} />
          <HaulRow color="#8ac926" shape="pentagon" value={state.haul.biominerals} />
          <HaulRow color="#6ad1e3" shape="diamond" value={state.haul.coreCrystals} />
        </Plate>
      </div>

      {/* ── Roster tray ───────────────────────────────────────────────────── */}
      <div className="w-full p-1" style={{ height: `${state.trayFrac * 100}%` }}>
        <Plate fillClassName="bg-fd-plate flex h-full flex-col gap-2 p-2" className="h-full">
          {/* Armed + queue */}
          <div className="flex flex-1 items-center gap-3 overflow-hidden">
            <div className="flex items-center gap-2">
              <BallPreview url={state.armed ? ballUrls[state.armed] : null} size={44} />
              <div className="flex flex-col gap-1">
                <div className="font-label text-[7px] uppercase tracking-wider text-fd-orange">
                  Armed
                </div>
                <div className="flex items-center gap-1">
                  <div className="font-label text-[10px] uppercase text-fd-ink">
                    {state.armed ? BALL_LABEL[state.armed] : 'RUN COMPLETE'}
                  </div>
                  {state.armed && (
                    <BallGlyphIcon
                      glyph={BALL_GLYPH[state.armed]}
                      size={10}
                      className="text-fd-cyan"
                    />
                  )}
                </div>
                {state.armed && <Pips count={BALL_PIPS[state.armed]} />}
              </div>
            </div>

            <div className="h-10 w-px bg-fd-strip" />

            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="font-label text-[7px] uppercase tracking-wider text-fd-muted">
                Roster ▸ {state.remaining} probes
              </div>
              <div className="flex items-center gap-1">
                {queuePreview.map((type, i) => (
                  <div key={i} className="relative bg-fd-strip p-0.5">
                    <BallPreview url={ballUrls[type]} size={26} />
                    <CountBadge count={queueCounts.get(type) ?? 1} />
                  </div>
                ))}
                {overflow > 0 && (
                  <span className="font-readout text-sm text-fd-muted">+{overflow}</span>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-stretch gap-2">
            <FoundryButton
              variant="primary"
              className="flex-1"
              disabled={state.reprint === null || !state.reprint.enabled}
              onClick={onReprint}
            >
              {state.reprint === null ? 'Reprint ▸ Max' : `Reprint ▸ ${state.reprint.cost} Scrap`}
            </FoundryButton>
            <FoundryButton variant="secondary" className="flex-1" onClick={onReturn}>
              Return ▸ Keep Haul
            </FoundryButton>
          </div>
        </Plate>
      </div>
    </div>
  );
}

function BallPreview({ url, size }: { url: string | null; size: number }) {
  return (
    <div
      className="flex items-center justify-center bg-fd-ink-dark"
      style={{ width: size, height: size }}
    >
      {url && (
        // Inline data-URL pixel sprite — next/image would only add overhead and break nearest scaling.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          className="[image-rendering:pixelated]"
          style={{ width: size * 0.7, height: size * 0.7, objectFit: 'contain' }}
        />
      )}
    </div>
  );
}

function Pips({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="h-[7px] w-[3px] bg-fd-orange" />
      ))}
    </div>
  );
}

function CountBadge({ count }: { count: number }) {
  if (count <= 1) return null;
  return (
    <span className="font-readout absolute right-0 top-0 bg-fd-orange px-[2px] text-[6px] leading-tight text-fd-ink-dark">
      ×{count}
    </span>
  );
}

const CLIP: Record<string, string | undefined> = {
  square: undefined,
  pentagon: 'polygon(50% 0, 100% 38%, 82% 100%, 18% 100%, 0 38%)',
  diamond: 'polygon(50% 0, 100% 50%, 50% 100%, 0 50%)',
};

function HaulRow({ color, shape, value }: { color: string; shape: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="inline-block h-[9px] w-[9px] shrink-0"
        style={{ backgroundColor: color, clipPath: CLIP[shape] }}
        aria-hidden
      />
      <span className="font-readout text-sm leading-none text-fd-ink">{value}</span>
    </div>
  );
}
