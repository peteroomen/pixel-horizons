'use client';

import { useState } from 'react';

import FoundryButton from '@/components/foundry/FoundryButton';
import { InfoChipProvider } from '@/components/foundry/InfoChip';
import ModuleCardList from '@/components/foundry/ModuleCardList';
import { SLOT_LABELS } from '@/components/slot-labels';
import type {
  GameHandle,
  MerchantView,
  EngineerView,
  OfferBlock,
  ShopOfferView,
  SlotUsage,
  StationView,
} from '@/game/main';

interface StationScreenProps {
  view: StationView;
  handle: GameHandle;
  onOpenWorkbench: () => void;
}

/** Full block-reason copy (4.8): the slot picture or the scrap shortfall, not just a label. */
function blockReasonText(block: OfferBlock): string {
  if (block.kind === 'need-slot') {
    return `${SLOT_LABELS[block.slot]} ${block.used}/${block.limit} full`;
  }
  return `Need ${block.price} scrap · have ${block.have}`;
}

/** A compact "WEAPONS 1/3 · UTILITY 2/2 · …" overview of the whole loadout. */
function SlotPicture({ slots }: { slots: SlotUsage[] }) {
  return (
    <div className="mb-3 flex flex-wrap gap-x-3 gap-y-1 font-readout text-[8px] text-white/50 sm:text-[10px]">
      {slots.map((s) => (
        <span key={s.slot} className={s.used >= s.limit ? 'text-fd-orange' : undefined}>
          {SLOT_LABELS[s.slot]} {s.used}/{s.limit}
        </span>
      ))}
    </div>
  );
}

function OfferRow({
  offer,
  index,
  expanded,
  onToggle,
  onBuy,
}: {
  offer: ShopOfferView;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  onBuy: (index: number) => void;
}) {
  return (
    <div
      className={`border-2 ${
        offer.owned
          ? 'border-[#4a4a6a]/50 bg-fd-plate/30 opacity-50'
          : 'border-[#4a4a6a] bg-fd-plate'
      }`}
    >
      <div className="flex items-center justify-between px-3 py-2">
        <button
          type="button"
          onClick={onToggle}
          className="flex flex-1 flex-col items-start text-left touch-manipulation"
        >
          <div className="flex items-center gap-1.5">
            <span className="font-readout text-[8px] text-white/40 sm:text-[10px]">
              {expanded ? '▾' : '▸'}
            </span>
            <span className="font-label text-[9px] uppercase text-white sm:text-xs">
              {offer.moduleName}
            </span>
          </div>
          <div className="ml-3 font-readout text-[8px] text-fd-amber sm:text-[10px]">
            {offer.price} SCRAP · {SLOT_LABELS[offer.slot]}
          </div>
        </button>
        {offer.owned ? (
          <span className="font-label text-[7px] uppercase text-white/40 sm:text-[9px]">Owned</span>
        ) : (
          <div className="flex flex-col items-end gap-1">
            <FoundryButton
              variant="secondary"
              disabled={!offer.canBuy}
              onClick={() => onBuy(index)}
            >
              Buy
            </FoundryButton>
            {offer.blockReason !== null && (
              <span
                className={`font-label text-[7px] uppercase sm:text-[9px] ${
                  offer.blockReason.kind === 'need-slot' ? 'text-fd-orange' : 'text-fd-amber'
                }`}
              >
                {blockReasonText(offer.blockReason)}
              </span>
            )}
          </div>
        )}
      </div>
      {expanded && (
        <div className="px-3 pb-2">
          <ModuleCardList cards={offer.cards} />
        </div>
      )}
    </div>
  );
}

function MerchantScreen({ view, handle }: { view: MerchantView; handle: GameHandle }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  return (
    <div className="absolute inset-0 flex flex-col bg-fd-void/95">
      <div className="flex items-center justify-between px-3 py-2 sm:px-6 sm:py-3">
        <div className="font-label text-[10px] uppercase text-fd-orange sm:text-sm">Merchant</div>
        <div className="font-readout text-[10px] text-fd-amber sm:text-xs">
          SCRAP {view.resources.scrap} · BIO {view.resources.biominerals}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-24 sm:px-6">
        <SlotPicture slots={view.slots} />
        <div className="mb-3 font-label text-[8px] uppercase text-white/60 sm:text-[10px]">
          Modules for sale
        </div>
        <div className="flex flex-col gap-2">
          {view.offers.map((offer, i) => (
            <OfferRow
              key={offer.moduleId}
              offer={offer}
              index={i}
              expanded={expanded === i}
              onToggle={() => setExpanded((cur) => (cur === i ? null : i))}
              onBuy={(idx) => handle.buyModule(idx)}
            />
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
    </div>
  );
}

export default function StationScreen({ view, handle, onOpenWorkbench }: StationScreenProps) {
  return (
    <InfoChipProvider>
      {view.kind === 'merchant' ? (
        <MerchantScreen view={view} handle={handle} />
      ) : (
        <EngineerScreen view={view} handle={handle} />
      )}

      {/* Workbench reachable from the station (4.8) + Leave */}
      <div className="absolute inset-x-0 bottom-0 flex justify-center gap-3 pb-4">
        <FoundryButton variant="secondary" onClick={onOpenWorkbench}>
          Workbench
        </FoundryButton>
        <FoundryButton variant="primary" onClick={() => handle.leaveStation()}>
          Leave
        </FoundryButton>
      </div>
    </InfoChipProvider>
  );
}
