'use client';

import { useState } from 'react';

import BallGlyphIcon from '@/components/foundry/BallGlyphIcon';
import ModuleCardList from '@/components/foundry/ModuleCardList';
import FoundryButton from '@/components/foundry/FoundryButton';
import { InfoChipProvider } from '@/components/foundry/InfoChip';
import { SLOT_LABELS, SLOT_ORDER } from '@/components/slot-labels';
import type { BallGlyph } from '@/game/ship-view';
import type { BallType } from '@/game/surface/core-breaker';
import type { GameHandle, ModuleCardView, ShipView } from '@/game/main';

interface WorkbenchProps {
  view: ShipView;
  handle: GameHandle;
  onClose: () => void;
}

const BALL_LABEL: Record<BallType, string> = {
  standard: 'Standard',
  heavy: 'Heavy',
  split: 'Split',
  drill: 'Drill',
  ghost: 'Ghost',
};

/** A module row that expands to reveal the cards it adds to the deck. Shows both combat + surface faces (§6.4). */
function ModuleRow({
  name,
  tier,
  cards,
  ballFace,
  expanded,
  onToggle,
  action,
}: {
  name: string;
  tier: 1 | 2;
  cards: ModuleCardView[];
  ballFace: { type: BallType; glyph: BallGlyph } | null;
  expanded: boolean;
  onToggle: () => void;
  action?: React.ReactNode;
}) {
  return (
    <div className="border border-[#4a4a6a]/60 bg-fd-plate/50">
      <div className="flex items-center justify-between px-2 py-1.5">
        <button
          type="button"
          onClick={onToggle}
          className="flex flex-1 items-center gap-1.5 text-left touch-manipulation"
        >
          <span className="font-readout text-[8px] text-white/40 sm:text-[10px]">
            {expanded ? '▾' : '▸'}
          </span>
          <span className="font-label text-[8px] uppercase text-white sm:text-[10px]">{name}</span>
          {tier === 2 && (
            <span className="font-readout text-[7px] text-fd-orange sm:text-[9px]">Mk II</span>
          )}
        </button>
        {/* Surface face chip (§6.4 UI law) */}
        {ballFace !== null && (
          <span className="flex items-center gap-1 px-1.5 py-0.5 text-fd-cyan">
            <BallGlyphIcon glyph={ballFace.glyph} size={10} />
            <span className="font-readout text-[7px] uppercase">{BALL_LABEL[ballFace.type]}</span>
          </span>
        )}
        {action}
      </div>
      {expanded && (
        <div className="px-2 pb-2">
          <ModuleCardList cards={cards} />
        </div>
      )}
    </div>
  );
}

export default function Workbench({ view, handle, onClose }: WorkbenchProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const slotUsageFor = (slot: string) => view.slots.find((s) => s.slot === slot);

  const groupedModules = SLOT_ORDER.map((slot) => ({
    slot,
    modules: view.modules.filter((m) => m.slot === slot),
  }));

  return (
    <InfoChipProvider>
      <div className="absolute inset-0 flex flex-col bg-fd-void/95">
        <div className="flex items-center justify-between px-3 py-2 sm:px-6 sm:py-3">
          <div className="font-label text-[10px] uppercase text-fd-orange sm:text-sm">
            Workbench
          </div>
          <div className="font-readout flex gap-3 text-[10px] text-fd-amber sm:text-xs">
            <span>SCRAP {view.resources.scrap}</span>
            <span>BIO {view.resources.biominerals}</span>
            <span>BP {view.resources.blueprints}</span>
            <span>CRYSTAL {view.resources.coreCrystals}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-24 sm:px-6">
          {/* Installed modules by slot, with the slot's used / limit picture */}
          {groupedModules.map(({ slot, modules }) => {
            const usage = slotUsageFor(slot);
            return (
              <div key={slot} className="mb-3">
                <div className="mb-1 flex items-baseline justify-between">
                  <span className="font-label text-[8px] uppercase text-white/40 sm:text-[10px]">
                    {SLOT_LABELS[slot]}
                  </span>
                  {usage !== undefined && (
                    <span
                      className={`font-readout text-[8px] sm:text-[10px] ${
                        usage.used >= usage.limit ? 'text-fd-orange' : 'text-white/40'
                      }`}
                    >
                      {usage.used}/{usage.limit}
                    </span>
                  )}
                </div>
                {modules.length === 0 ? (
                  <div className="retro text-[8px] text-white/20 sm:text-[10px]">Empty</div>
                ) : (
                  <div className="flex flex-col gap-1">
                    {modules.map((mod) => {
                      const moduleIndex = view.modules.indexOf(mod);
                      const key = `mod-${moduleIndex}`;
                      return (
                        <ModuleRow
                          key={key}
                          name={mod.name}
                          tier={mod.tier}
                          cards={mod.cards}
                          ballFace={mod.ballFace}
                          expanded={expanded.has(key)}
                          onToggle={() => toggle(key)}
                          action={
                            mod.canUninstall ? (
                              <button
                                type="button"
                                onClick={() => handle.uninstallModule(moduleIndex)}
                                className="retro touch-manipulation text-[7px] text-white/50 hover:text-white/80 sm:text-[9px]"
                              >
                                UNINSTALL
                              </button>
                            ) : undefined
                          }
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* Cargo */}
          {view.cargo.length > 0 && (
            <div className="mb-3 mt-4">
              <div className="mb-1 font-label text-[8px] uppercase text-white/40 sm:text-[10px]">
                Cargo
              </div>
              <div className="flex flex-col gap-1">
                {view.cargo.map((mod, i) => {
                  const key = `cargo-${i}`;
                  const usage = slotUsageFor(mod.slot);
                  return (
                    <ModuleRow
                      key={key}
                      name={mod.name}
                      tier={mod.tier}
                      cards={mod.cards}
                      ballFace={mod.ballFace}
                      expanded={expanded.has(key)}
                      onToggle={() => toggle(key)}
                      action={
                        <div className="flex items-center gap-2">
                          <span className="font-readout text-[7px] text-white/40 sm:text-[9px]">
                            {SLOT_LABELS[mod.slot]}
                            {usage !== undefined ? ` ${usage.used}/${usage.limit}` : ''}
                          </span>
                          <FoundryButton
                            variant="secondary"
                            disabled={!mod.canInstall}
                            onClick={() => handle.installModule(i)}
                          >
                            Install
                          </FoundryButton>
                        </div>
                      }
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Reactor */}
          <div className="mb-3 mt-4">
            <div className="mb-1 font-label text-[8px] uppercase text-white/40 sm:text-[10px]">
              Reactor (Level {view.reactorLevel})
            </div>
            <div className="flex items-center justify-between border border-[#4a4a6a]/60 bg-fd-plate/50 px-2 py-1.5">
              <div className="retro text-[8px] text-white/60 sm:text-[10px]">
                {view.canUpgradeReactor
                  ? 'Spend 1 Core Crystal to upgrade'
                  : 'Need a Core Crystal to upgrade'}
              </div>
              <FoundryButton
                variant="secondary"
                disabled={!view.canUpgradeReactor}
                onClick={() => handle.upgradeReactor()}
              >
                Upgrade
              </FoundryButton>
            </div>
          </div>

          {/* Craft */}
          <div className="mt-4">
            <div className="mb-1 font-label text-[8px] uppercase text-white/40 sm:text-[10px]">
              Craft ({view.craftCost.blueprints} BP + {view.craftCost.biominerals} Bio +{' '}
              {view.craftCost.scrap} Scrap)
            </div>
            <div className="retro text-[8px] text-white/30 sm:text-[10px]">
              Crafting requires Blueprints — find them on planets or from boss rewards.
            </div>
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 flex justify-center pb-4">
          <FoundryButton variant="primary" onClick={onClose}>
            Close
          </FoundryButton>
        </div>
      </div>
    </InfoChipProvider>
  );
}
