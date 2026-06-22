'use client';

import { useCallback, useRef, useState } from 'react';

import BossReward from '@/components/BossReward';
import CombatHand from '@/components/CombatHand';
import CoreBreakerHud from '@/components/CoreBreakerHud';
import EventScreen from '@/components/EventScreen';
import GameCanvas from '@/components/GameCanvas';
import HUD from '@/components/HUD';
import SectorMap from '@/components/SectorMap';
import StationScreen from '@/components/StationScreen';
import TitleOverlay from '@/components/TitleOverlay';
import Workbench from '@/components/Workbench';
import FoundryButton from '@/components/foundry/FoundryButton';
import type {
  CombatView,
  CoreBreakerHudState,
  EventView,
  GameHandle,
  GamePhase,
  MapView,
  OrbitView,
  ShipView,
  StationView,
} from '@/game/main';

const OUTCOME_COLOR: Record<string, string> = {
  victory: 'text-fd-orange',
  escaped: 'text-fd-amber',
};

function outcomeLabel(view: CombatView): string {
  if (view.outcome === 'victory') return 'VICTORY';
  return 'ARRIVED';
}

const RESOURCE_LABELS: ReadonlyArray<[keyof MapView['resources'], string]> = [
  ['scrap', 'SCRAP'],
  ['biominerals', 'BIO'],
  ['coreCrystals', 'CRYSTAL'],
  ['blueprints', 'BLUEPRINT'],
];

/** One "LABEL n" line per non-zero resource, or a dash when there is nothing. */
function ResourceLines({ resources }: { resources: MapView['resources'] }) {
  const lines = RESOURCE_LABELS.filter(([key]) => resources[key] > 0);
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

/** Run-total summary for the end screens, fed by the last MapView emission. */
function RunSummary({ view }: { view: MapView }) {
  return (
    <div className="retro flex flex-col items-center gap-1 text-[10px] text-white sm:text-xs">
      <div className="text-white/60">
        {view.hullName.toUpperCase()} · HULL {view.hullHp}
      </div>
      <ResourceLines resources={view.resources} />
    </div>
  );
}

export default function Home() {
  const [view, setView] = useState<CombatView | null>(null);
  const [innateArmed, setInnateArmed] = useState(false);
  const [phase, setPhase] = useState<GamePhase | null>(null);
  const [miningView, setMiningView] = useState<CoreBreakerHudState | null>(null);
  const [orbitView, setOrbitView] = useState<OrbitView | null>(null);
  const [mapView, setMapView] = useState<MapView | null>(null);
  const [shipView, setShipView] = useState<ShipView | null>(null);
  const [stationView, setStationView] = useState<StationView | null>(null);
  const [eventView, setEventView] = useState<EventView | null>(null);
  const [workbenchOpen, setWorkbenchOpen] = useState(false);
  const [handle, setHandle] = useState<GameHandle | null>(null);
  const handleRef = useRef<GameHandle | null>(null);

  const onCombatUpdate = useCallback((next: CombatView) => {
    setView(next);
    setInnateArmed(false);
  }, []);

  const onReady = useCallback((h: GameHandle) => {
    handleRef.current = h;
    setHandle(h);
  }, []);

  const onPhaseChange = useCallback((next: GamePhase) => {
    setPhase(next);
    // The workbench is an explicit per-screen open (map "Ship" / station "Workbench"),
    // so it should never carry across a phase change.
    setWorkbenchOpen(false);
  }, []);

  const onMiningUpdate = useCallback((next: CoreBreakerHudState) => {
    setMiningView(next);
  }, []);

  const onOrbitUpdate = useCallback((next: OrbitView) => {
    setOrbitView(next);
  }, []);

  const onMapUpdate = useCallback((next: MapView) => {
    setMapView(next);
  }, []);

  const onShipUpdate = useCallback((next: ShipView) => {
    setShipView(next);
  }, []);

  const onStationUpdate = useCallback((next: StationView) => {
    setStationView(next);
  }, []);

  const onEventUpdate = useCallback((next: EventView) => {
    setEventView(next);
  }, []);

  // Discard-keyword cards auto-pay with the rightmost other cards (GDD §5.9); the rest
  // play straight. Rightmost-first keeps freshly-drawn cards as the fodder, not the hand
  // you've been holding.
  const onPlayCard = (index: number) => {
    if (view === null || handleRef.current === null) return;
    const card = view.hand[index];
    if (card === undefined) return;
    if (card.discardCost > 0) {
      const targets: number[] = [];
      for (let i = view.hand.length - 1; i >= 0 && targets.length < card.discardCost; i--) {
        if (i !== index) targets.push(i);
      }
      handleRef.current.playCard(index, targets);
      return;
    }
    handleRef.current.playCard(index);
  };

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
    <main className="fixed inset-0 select-none bg-fd-void">
      <GameCanvas
        onCombatUpdate={onCombatUpdate}
        onReady={onReady}
        onPhaseChange={onPhaseChange}
        onMiningUpdate={onMiningUpdate}
        onOrbitUpdate={onOrbitUpdate}
        onMapUpdate={onMapUpdate}
        onShipUpdate={onShipUpdate}
        onStationUpdate={onStationUpdate}
        onEventUpdate={onEventUpdate}
      />

      {/* World framing (World Art Direction §6): the canvas runs full-bleed under the
          FOUNDRY plates; a vignette sinks it into the void and a 1px scanline lives on
          the world only. Both are pointer-events-none and paint under every overlay. */}
      {(phase === 'lane' || phase === 'transition' || phase === 'orbit' || phase === 'mining') && (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(120% 90% at 50% 45%, rgba(11,13,24,0) 55%, rgba(11,13,24,0.55) 82%, rgba(11,13,24,0.9) 100%)',
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'repeating-linear-gradient(0deg, rgba(0,0,0,0.18) 0, rgba(0,0,0,0.18) 1px, rgba(0,0,0,0) 1px, rgba(0,0,0,0) 3px)',
            }}
          />
        </>
      )}

      {/* Title: a saved expedition exists */}
      {phase === 'title' && mapView !== null && (
        <TitleOverlay
          view={mapView}
          onResume={() => handleRef.current?.resumeRun()}
          onNew={() => handleRef.current?.newRun()}
        />
      )}

      {/* Sector map: pick the next node */}
      {phase === 'map' && mapView !== null && (
        <>
          <SectorMap view={mapView} onSelect={(id) => handleRef.current?.selectNode(id)} />
          <div className="absolute right-2 top-12 sm:right-6 sm:top-16">
            <FoundryButton
              variant="secondary"
              onClick={() => {
                handleRef.current?.openWorkbench();
                setWorkbenchOpen(true);
              }}
            >
              Ship
            </FoundryButton>
          </div>
          {workbenchOpen && shipView !== null && handle !== null && (
            <Workbench
              view={shipView}
              handle={handle}
              onClose={() => {
                handle.closeWorkbench();
                setWorkbenchOpen(false);
              }}
            />
          )}
        </>
      )}

      {/* Orbit (6.1): the runtime-generated planet, then drop the clone to the surface */}
      {phase === 'orbit' && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-between py-8 sm:py-12">
          <div className="flex flex-col items-center gap-1">
            <span className="retro text-[8px] text-white/50 sm:text-[10px]">IN ORBIT</span>
            {orbitView !== null && (
              <span className="retro text-lg text-fd-orange sm:text-2xl">
                {orbitView.name.toUpperCase()}
              </span>
            )}
          </div>
          <FoundryButton variant="primary" onClick={() => handleRef.current?.dropToSurface()}>
            Drop to Surface
          </FoundryButton>
        </div>
      )}

      {/* Mining (Core Breaker): React HUD over the portrait canvas (ADR 001) */}
      {phase === 'mining' && miningView !== null && (
        <CoreBreakerHud
          state={miningView}
          onReprint={() => handleRef.current?.miningReprint()}
          onReturn={() => handleRef.current?.miningReturn()}
        />
      )}

      {/* Lane: combat HUD + hand + between-encounter overlay */}
      {phase === 'lane' && view !== null && (
        <>
          <HUD
            view={view}
            onEndTurn={() => handleRef.current?.endTurn()}
            onInnate={onInnate}
            innateArmed={innateArmed}
            onSelectTarget={(target) => handleRef.current?.selectTarget(target)}
          />
          <div className="absolute inset-x-0 bottom-2 flex justify-center sm:bottom-4">
            <CombatHand
              cards={view.hand}
              onPlay={(index) => onPlayCard(index)}
              discardMode={innateArmed}
              onDiscard={(index) => handleRef.current?.useInnate(index)}
              onJettison={(index) => handleRef.current?.jettisonCard(index)}
            />
          </div>

          {(view.outcome === 'victory' || view.outcome === 'escaped') && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-black/70">
              <span
                className={`font-label text-3xl uppercase sm:text-5xl ${OUTCOME_COLOR[view.outcome]}`}
              >
                {outcomeLabel(view)}
              </span>
              <FoundryButton variant="primary" onClick={() => handleRef.current?.continueTravel()}>
                Continue
              </FoundryButton>
            </div>
          )}
        </>
      )}

      {/* Shop / Engineer station screens — Workbench is reachable from here (4.8) */}
      {(phase === 'shop' || phase === 'engineer') && stationView !== null && handle !== null && (
        <>
          <StationScreen
            view={stationView}
            handle={handle}
            onOpenWorkbench={() => {
              handle.openWorkbench();
              setWorkbenchOpen(true);
            }}
          />
          {workbenchOpen && shipView !== null && (
            <Workbench
              view={shipView}
              handle={handle}
              onClose={() => {
                handle.closeWorkbench();
                setWorkbenchOpen(false);
              }}
            />
          )}
        </>
      )}

      {/* Event: text node with choices (GDD §4.4) */}
      {phase === 'event' && eventView !== null && (
        <EventScreen
          view={eventView}
          shipView={shipView}
          onChoose={(choiceIndex, moduleIndex) =>
            handleRef.current?.chooseEventChoice(choiceIndex, moduleIndex)
          }
        />
      )}

      {/* Boss reward: three-choice pick after the gate guardian dies */}
      {phase === 'boss-reward' && handle !== null && (
        <BossReward mapView={mapView} handle={handle} />
      )}

      {/* Run over: ship destroyed (GDD §6.4 — space risks are fatal) */}
      {phase === 'run-over' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-black/80">
          <span className="font-label text-3xl uppercase text-fd-red sm:text-5xl">
            Ship Destroyed
          </span>
          {mapView !== null && <RunSummary view={mapView} />}
          <FoundryButton variant="primary" onClick={() => handleRef.current?.newRun()}>
            New Run
          </FoundryButton>
        </div>
      )}

      {/* Sector complete: gate guardian defeated */}
      {phase === 'sector-complete' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-black/80">
          <span className="font-label text-3xl uppercase text-fd-orange sm:text-5xl">
            Sector Clear
          </span>
          <span className="retro text-[10px] text-white/60 sm:text-xs">
            SECTOR {mapView?.sector ?? 1} — BLOOM GATE DESTROYED
          </span>
          {mapView !== null && <RunSummary view={mapView} />}
          <FoundryButton variant="primary" onClick={() => handleRef.current?.newRun()}>
            New Run
          </FoundryButton>
        </div>
      )}
    </main>
  );
}
