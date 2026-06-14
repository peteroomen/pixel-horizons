'use client';

import type { GameHandle, ShipView } from '@/game/main';
import FoundryButton from '@/components/foundry/FoundryButton';

interface WorkbenchProps {
  view: ShipView;
  handle: GameHandle;
  onClose: () => void;
}

const SLOT_LABELS: Record<string, string> = {
  weapon: 'WEAPONS',
  utility: 'UTILITY',
  engine: 'ENGINES',
  'clone-bay': 'CLONE BAY',
};

const SLOT_ORDER = ['weapon', 'utility', 'engine', 'clone-bay'] as const;

export default function Workbench({ view, handle, onClose }: WorkbenchProps) {
  const groupedModules = SLOT_ORDER.map((slot) => ({
    slot,
    modules: view.modules.filter((m) => m.slot === slot),
  }));

  return (
    <div className="absolute inset-0 flex flex-col bg-fd-void/95">
      <div className="flex items-center justify-between px-3 py-2 sm:px-6 sm:py-3">
        <div className="font-label text-[10px] uppercase text-fd-orange sm:text-sm">Workbench</div>
        <div className="font-readout flex gap-3 text-[10px] text-fd-amber sm:text-xs">
          <span>SCRAP {view.resources.scrap}</span>
          <span>BIO {view.resources.biominerals}</span>
          <span>BP {view.resources.blueprints}</span>
          <span>CRYSTAL {view.resources.coreCrystals}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-24 sm:px-6">
        {/* Installed modules by slot */}
        {groupedModules.map(({ slot, modules }) => (
          <div key={slot} className="mb-3">
            <div className="mb-1 font-label text-[8px] uppercase text-white/40 sm:text-[10px]">
              {SLOT_LABELS[slot]}
            </div>
            {modules.length === 0 ? (
              <div className="retro text-[8px] text-white/20 sm:text-[10px]">Empty</div>
            ) : (
              <div className="flex flex-col gap-1">
                {modules.map((mod, i) => {
                  const moduleIndex = view.modules.indexOf(mod);
                  return (
                    <div
                      key={`${mod.id}-${i}`}
                      className="flex items-center justify-between border border-[#4a4a6a]/60 bg-fd-plate/50 px-2 py-1.5"
                    >
                      <div>
                        <span className="font-label text-[8px] uppercase text-white sm:text-[10px]">
                          {mod.name}
                        </span>
                        {mod.tier === 2 && (
                          <span className="ml-1.5 font-readout text-[7px] text-fd-orange sm:text-[9px]">
                            Mk II
                          </span>
                        )}
                      </div>
                      {mod.canUninstall && (
                        <button
                          type="button"
                          onClick={() => handle.uninstallModule(moduleIndex)}
                          className="retro text-[7px] text-white/50 hover:text-white/80 sm:text-[9px]"
                        >
                          UNINSTALL
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}

        {/* Cargo */}
        {view.cargo.length > 0 && (
          <div className="mb-3 mt-4">
            <div className="mb-1 font-label text-[8px] uppercase text-white/40 sm:text-[10px]">
              Cargo
            </div>
            <div className="flex flex-col gap-1">
              {view.cargo.map((mod, i) => (
                <div
                  key={`cargo-${mod.id}-${i}`}
                  className="flex items-center justify-between border border-[#4a4a6a]/60 bg-fd-plate/50 px-2 py-1.5"
                >
                  <div>
                    <span className="font-label text-[8px] uppercase text-white sm:text-[10px]">
                      {mod.name}
                    </span>
                    {mod.tier === 2 && (
                      <span className="ml-1.5 font-readout text-[7px] text-fd-orange sm:text-[9px]">
                        Mk II
                      </span>
                    )}
                  </div>
                  <FoundryButton
                    variant="secondary"
                    disabled={!mod.canInstall}
                    onClick={() => handle.installModule(i)}
                  >
                    Install
                  </FoundryButton>
                </div>
              ))}
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
  );
}
