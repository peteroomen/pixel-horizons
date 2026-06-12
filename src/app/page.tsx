'use client';

import { useCallback, useRef, useState } from 'react';

import CombatHand from '@/components/CombatHand';
import GameCanvas from '@/components/GameCanvas';
import HUD from '@/components/HUD';
import SurfaceHUD from '@/components/SurfaceHUD';
import TouchControls from '@/components/TouchControls';
import { Button } from '@/components/ui/8bit/button';
import type { CombatView, GameHandle, SurfaceView } from '@/game/main';

const OUTCOME_COLOR: Record<string, string> = {
  victory: 'text-[#4fc3f7]',
  escaped: 'text-[#ffd166]',
  defeat: 'text-[#e94560]',
};

/** 'escaped' covers both ways a fight ends without a kill — lane progress tells which. */
function outcomeLabel(view: CombatView): string {
  if (view.outcome === 'victory') return 'VICTORY';
  if (view.outcome === 'defeat') return 'DEFEAT';
  const arrived = view.travel !== null && view.travel.progress >= view.travel.distance;
  return arrived ? 'ARRIVED' : 'TOLL PAID';
}

const SURFACE_RESOURCE_LABELS: ReadonlyArray<[keyof SurfaceView['backpack'], string]> = [
  ['scrap', 'SCRAP'],
  ['biominerals', 'BIO'],
  ['coreCrystals', 'CRYSTAL'],
  ['blueprints', 'BLUEPRINT'],
];

/** One "LABEL n" line per non-zero resource, or a dash when there is nothing. */
function ResourceLines({ resources }: { resources: SurfaceView['backpack'] }) {
  const lines = SURFACE_RESOURCE_LABELS.filter(([key]) => resources[key] > 0);
  if (lines.length === 0) {
    return <div className="text-white/40">—</div>;
  }
  return (
    <>
      {lines.map(([key, label]) => (
        <div key={key}>
          {label} {resources[key]}
        </div>
      ))}
    </>
  );
}

export default function Home() {
  const [view, setView] = useState<CombatView | null>(null);
  // Card-targeted innate (Slipstream) armed: the next card tap discards instead of plays.
  const [innateArmed, setInnateArmed] = useState(false);
  const [mode, setMode] = useState<'combat' | 'surface' | null>(null);
  const [surfaceView, setSurfaceView] = useState<SurfaceView | null>(null);
  const handleRef = useRef<GameHandle | null>(null);

  const onCombatUpdate = useCallback((next: CombatView) => {
    setView(next);
    setInnateArmed(false);
  }, []);

  const onReady = useCallback((handle: GameHandle) => {
    handleRef.current = handle;
  }, []);

  const onModeChange = useCallback((m: 'combat' | 'surface') => {
    setMode(m);
  }, []);

  const onSurfaceUpdate = useCallback((next: SurfaceView) => {
    setSurfaceView(next);
  }, []);

  // Plain innates fire immediately; card-targeted ones (Slipstream) toggle arming.
  const onInnate = () => {
    if (view === null || handleRef.current === null) return;
    if (!view.innate.requiresCardTarget) {
      handleRef.current.useInnate();
      return;
    }
    setInnateArmed((armed) => !armed);
  };

  return (
    <main className="fixed inset-0 touch-none select-none bg-[#050508]">
      <GameCanvas
        onCombatUpdate={onCombatUpdate}
        onReady={onReady}
        onModeChange={onModeChange}
        onSurfaceUpdate={onSurfaceUpdate}
      />

      {/* Surface mode: HUD + touch controls + launch outcome overlay */}
      {mode === 'surface' && (
        <>
          {surfaceView !== null && <SurfaceHUD view={surfaceView} />}
          <TouchControls
            onInput={(action, pressed) => handleRef.current?.surfaceInput(action, pressed)}
          />

          {surfaceView !== null && surfaceView.outcome !== 'ongoing' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-black/70">
              <span className="retro text-3xl text-white sm:text-5xl">POD LAUNCHED</span>
              {surfaceView.outcome === 'aboard' ? (
                <span className="retro text-sm text-[#4fc3f7] sm:text-base">CLONE ABOARD</span>
              ) : (
                <span className="retro text-sm text-[#e94560] sm:text-base">
                  CLONE STRANDED — CONSCIOUSNESS RECALLED
                </span>
              )}
              <div className="retro flex gap-10 text-[10px] text-white sm:text-xs">
                <div className="space-y-1 text-center">
                  <div className="text-[#4fc3f7]">BANKED</div>
                  <ResourceLines resources={surfaceView.deposited} />
                </div>
                {surfaceView.lostBackpack !== null && (
                  <div className="space-y-1 text-center">
                    <div className="text-[#e94560]">LOST</div>
                    <ResourceLines resources={surfaceView.lostBackpack} />
                  </div>
                )}
              </div>
              <Button font="retro" onClick={() => handleRef.current?.restartRun()}>
                Drop Again
              </Button>
            </div>
          )}
        </>
      )}

      {/* Combat mode: HUD, card hand, outcome overlays */}
      {mode === 'combat' && view !== null && (
        <>
          <HUD
            view={view}
            onEndTurn={() => handleRef.current?.endTurn()}
            onInnate={onInnate}
            innateArmed={innateArmed}
            onPayToll={() => handleRef.current?.payToll()}
          />
          <div className="absolute inset-x-0 bottom-2 flex justify-center sm:bottom-4">
            <CombatHand
              cards={view.hand}
              onPlay={(index) => handleRef.current?.playCard(index)}
              discardMode={innateArmed}
              onDiscard={(index) => handleRef.current?.useInnate(index)}
            />
          </div>

          {view.outcome !== 'ongoing' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-black/70">
              <span className={`retro text-3xl sm:text-5xl ${OUTCOME_COLOR[view.outcome]}`}>
                {outcomeLabel(view)}
              </span>
              {view.outcome === 'defeat' ? (
                <Button font="retro" onClick={() => handleRef.current?.restartRun()}>
                  New Run
                </Button>
              ) : (
                <Button font="retro" onClick={() => handleRef.current?.continueTravel()}>
                  Continue
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </main>
  );
}
