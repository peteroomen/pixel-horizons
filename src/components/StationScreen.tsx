'use client';

import type { GameHandle, MerchantView, EngineerView, StationView } from '@/game/main';
import FoundryButton from '@/components/foundry/FoundryButton';

interface StationScreenProps {
  view: StationView;
  handle: GameHandle;
}

function MerchantScreen({ view, handle }: { view: MerchantView; handle: GameHandle }) {
  return (
    <div className="absolute inset-0 flex flex-col bg-fd-void/95">
      <div className="flex items-center justify-between px-3 py-2 sm:px-6 sm:py-3">
        <div className="font-label text-[10px] uppercase text-fd-orange sm:text-sm">Merchant</div>
        <div className="font-readout text-[10px] text-fd-amber sm:text-xs">
          SCRAP {view.resources.scrap} · BIO {view.resources.biominerals}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-24 sm:px-6">
        <div className="mb-3 font-label text-[8px] uppercase text-white/60 sm:text-[10px]">
          Modules for sale
        </div>
        <div className="flex flex-col gap-2">
          {view.offers.map((offer, i) => (
            <div
              key={offer.moduleId}
              className={`flex items-center justify-between border-2 px-3 py-2 ${
                offer.owned
                  ? 'border-[#4a4a6a]/50 bg-fd-plate/30 opacity-50'
                  : 'border-[#4a4a6a] bg-fd-plate'
              }`}
            >
              <div>
                <div className="font-label text-[9px] uppercase text-white sm:text-xs">
                  {offer.moduleName}
                </div>
                <div className="font-readout text-[8px] text-fd-amber sm:text-[10px]">
                  {offer.price} SCRAP
                </div>
              </div>
              {offer.owned ? (
                <span className="font-label text-[7px] uppercase text-white/40 sm:text-[9px]">
                  Owned
                </span>
              ) : (
                <FoundryButton
                  variant="secondary"
                  disabled={!offer.canBuy}
                  onClick={() => handle.buyModule(i)}
                >
                  Buy
                </FoundryButton>
              )}
            </div>
          ))}
        </div>

        {view.resources.biominerals > 0 && (
          <div className="mt-4">
            <div className="mb-2 font-label text-[8px] uppercase text-white/60 sm:text-[10px]">
              Sell biominerals
            </div>
            <div className="flex items-center gap-3 border-2 border-[#4a4a6a] bg-fd-plate px-3 py-2">
              <div>
                <div className="font-label text-[9px] uppercase text-white sm:text-xs">
                  1 Biomineral = {view.sellRate} Scrap
                </div>
                <div className="font-readout text-[8px] text-white/60 sm:text-[10px]">
                  You have {view.resources.biominerals}
                </div>
              </div>
              <FoundryButton
                variant="secondary"
                disabled={!view.canSellBiominerals}
                onClick={() => handle.sellBiominerals(1)}
              >
                Sell 1
              </FoundryButton>
            </div>
          </div>
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 flex justify-center pb-4">
        <FoundryButton variant="primary" onClick={() => handle.leaveStation()}>
          Leave
        </FoundryButton>
      </div>
    </div>
  );
}

function EngineerScreen({ view, handle }: { view: EngineerView; handle: GameHandle }) {
  return (
    <div className="absolute inset-0 flex flex-col bg-fd-void/95">
      <div className="flex items-center justify-between px-3 py-2 sm:px-6 sm:py-3">
        <div className="font-label text-[10px] uppercase text-fd-orange sm:text-sm">Engineer</div>
        <div className="font-readout text-[10px] text-fd-amber sm:text-xs">
          SCRAP {view.resources.scrap} · BIO {view.resources.biominerals}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-24 sm:px-6">
        <div className="mb-2 flex items-center justify-between border-2 border-[#4a4a6a] bg-fd-plate px-3 py-2">
          <div>
            <div className="font-label text-[9px] uppercase text-white sm:text-xs">Hull repair</div>
            <div className="font-readout text-[8px] text-white/60 sm:text-[10px]">
              {view.hullHp}/{view.hullMaxHp} HP · {view.repairCost.scrap} Scrap per{' '}
              {view.repairCost.hp} HP
            </div>
          </div>
          <FoundryButton
            variant="secondary"
            disabled={!view.canRepair}
            onClick={() => handle.repairHull()}
          >
            Repair
          </FoundryButton>
        </div>

        <div className="mb-3 mt-4 font-label text-[8px] uppercase text-white/60 sm:text-[10px]">
          Mk II upgrades ({view.upgradeCost.scrap} Scrap + {view.upgradeCost.biominerals} Bio)
        </div>
        <div className="flex flex-col gap-2">
          {view.upgrades.map((u) => (
            <div
              key={u.moduleIndex}
              className="flex items-center justify-between border-2 border-[#4a4a6a] bg-fd-plate px-3 py-2"
            >
              <div>
                <div className="font-label text-[9px] uppercase text-white sm:text-xs">
                  {u.moduleName}
                </div>
                <div className="font-readout text-[8px] text-white/40 sm:text-[10px]">
                  {u.tier === 2 ? 'Mk II' : u.hasMk2 ? 'Mk I → Mk II' : 'No upgrade available'}
                </div>
              </div>
              {u.hasMk2 && u.tier < 2 && (
                <FoundryButton
                  variant="secondary"
                  disabled={!u.canUpgrade}
                  onClick={() => handle.upgradeModule(u.moduleIndex)}
                >
                  Upgrade
                </FoundryButton>
              )}
              {u.tier === 2 && (
                <span className="font-label text-[7px] uppercase text-fd-orange sm:text-[9px]">
                  Mk II
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 flex justify-center pb-4">
        <FoundryButton variant="primary" onClick={() => handle.leaveStation()}>
          Leave
        </FoundryButton>
      </div>
    </div>
  );
}

export default function StationScreen({ view, handle }: StationScreenProps) {
  if (view.kind === 'merchant') return <MerchantScreen view={view} handle={handle} />;
  return <EngineerScreen view={view} handle={handle} />;
}
