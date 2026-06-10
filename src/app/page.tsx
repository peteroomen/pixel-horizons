'use client';

import { useCallback, useRef, useState } from 'react';

import CombatHand from '@/components/CombatHand';
import GameCanvas from '@/components/GameCanvas';
import HUD from '@/components/HUD';
import { Button } from '@/components/ui/8bit/button';
import type { CombatView, GameHandle } from '@/game/main';

export default function Home() {
  const [view, setView] = useState<CombatView | null>(null);
  const handleRef = useRef<GameHandle | null>(null);

  const onReady = useCallback((handle: GameHandle) => {
    handleRef.current = handle;
  }, []);

  return (
    <main className="fixed inset-0 touch-none select-none bg-[#050508]">
      <GameCanvas onCombatUpdate={setView} onReady={onReady} />

      {view !== null && (
        <>
          <HUD view={view} onEndTurn={() => handleRef.current?.endTurn()} />
          <div className="absolute inset-x-0 bottom-2 flex justify-center sm:bottom-4">
            <CombatHand cards={view.hand} onPlay={(index) => handleRef.current?.playCard(index)} />
          </div>

          {view.outcome !== 'ongoing' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-black/70">
              <span
                className={`retro text-3xl sm:text-5xl ${
                  view.outcome === 'victory' ? 'text-[#4fc3f7]' : 'text-[#e94560]'
                }`}
              >
                {view.outcome === 'victory' ? 'VICTORY' : 'DEFEAT'}
              </span>
              {view.outcome === 'victory' ? (
                <Button font="retro" onClick={() => handleRef.current?.nextFight()}>
                  Fight Again
                </Button>
              ) : (
                <Button font="retro" onClick={() => handleRef.current?.restartRun()}>
                  New Run
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </main>
  );
}
