'use client';

import { useCallback, useRef, useState } from 'react';

import CombatHand from '@/components/CombatHand';
import GameCanvas from '@/components/GameCanvas';
import HUD from '@/components/HUD';
import TouchControls from '@/components/TouchControls';
import FoundryButton from '@/components/foundry/FoundryButton';
import type { CombatView, GameHandle } from '@/game/main';

const OUTCOME_COLOR: Record<string, string> = {
  victory: 'text-fd-orange',
  escaped: 'text-fd-amber',
  defeat: 'text-fd-red',
};

function outcomeLabel(view: CombatView): string {
  if (view.outcome === 'victory') return 'VICTORY';
  if (view.outcome === 'defeat') return 'DEFEAT';
  const arrived = view.travel !== null && view.travel.progress >= view.travel.distance;
  return arrived ? 'ARRIVED' : 'TOLL PAID';
}

export default function Home() {
  const [view, setView] = useState<CombatView | null>(null);
  const [innateArmed, setInnateArmed] = useState(false);
  const [mode, setMode] = useState<'combat' | 'surface' | null>(null);
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

  const onInnate = () => {
    if (view === null || handleRef.current === null) return;
    if (!view.innate.requiresCardTarget) {
      handleRef.current.useInnate();
      return;
    }
    setInnateArmed((armed) => !armed);
  };

  return (
    <main className="fixed inset-0 touch-none select-none bg-fd-void">
      <GameCanvas onCombatUpdate={onCombatUpdate} onReady={onReady} onModeChange={onModeChange} />

      {mode === 'surface' && (
        <TouchControls
          onInput={(action, pressed) => handleRef.current?.surfaceInput(action, pressed)}
        />
      )}

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
              <span
                className={`font-label text-3xl uppercase sm:text-5xl ${OUTCOME_COLOR[view.outcome]}`}
              >
                {outcomeLabel(view)}
              </span>
              {view.outcome === 'defeat' ? (
                <FoundryButton variant="primary" onClick={() => handleRef.current?.restartRun()}>
                  New Run
                </FoundryButton>
              ) : (
                <FoundryButton
                  variant="primary"
                  onClick={() => handleRef.current?.continueTravel()}
                >
                  Continue
                </FoundryButton>
              )}
            </div>
          )}
        </>
      )}
    </main>
  );
}
